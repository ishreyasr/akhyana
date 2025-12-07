import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { MediaConnection } from 'peerjs';

interface CallState {
    status: 'idle' | 'ringing' | 'calling' | 'connecting' | 'active' | 'ended' | 'error';
    remotePeerId?: string;
    error?: string;
    incomingCall?: boolean;
}

/**
 * PeerJS-based voice calling hook
 * Features:
 * - Automatic peer connection with free PeerJS cloud server
 * - Room-based calling (both peers join the same "room" via peer IDs)
 * - Automatic cleanup on disconnect
 * - No backend signaling server needed
 */
export function usePeerJSCall(localVehicleId: string | undefined) {
    const [callState, setCallState] = useState<CallState>({ status: 'idle' });
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMicMuted, setIsMicMuted] = useState(true);

    const peerRef = useRef<Peer | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const activeCallRef = useRef<MediaConnection | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const isCallerRef = useRef<boolean>(false);
    const callInProgressRef = useRef<boolean>(false);
    const pendingCallRef = useRef<MediaConnection | null>(null);

    // Initialize PeerJS connection
    useEffect(() => {
        if (!localVehicleId) return;

        console.log('🔵 Initializing PeerJS with ID:', localVehicleId);

        // Create peer with custom ID (using vehicleId as peer ID)
        const peer = new Peer(localVehicleId, {
            // Use environment variables or fallback to local
            host: process.env.NEXT_PUBLIC_PEERJS_HOST || 'localhost',
            port: parseInt(process.env.NEXT_PUBLIC_PEERJS_PORT || '9000', 10),
            path: process.env.NEXT_PUBLIC_PEERJS_PATH || '/peerjs',
            secure: process.env.NEXT_PUBLIC_PEERJS_PORT === '443', // True if port 443 (HTTPS)
            debug: 2, // Enable debug logging
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    // Free TURN servers
                    {
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('========== PEERJS READY ==========');
            console.log('My Peer ID:', id);
            console.log('Expected Vehicle ID:', localVehicleId);
            console.log('IDs Match:', id === localVehicleId);
            console.log('Now listening for incoming calls...');
            console.log('==================================');
            setCallState({ status: 'idle' });
        });

        peer.on('error', (error) => {
            console.error('🔴 PeerJS error:', error);
            setCallState({ status: 'error', error: error.message });
        });

        peer.on('disconnected', () => {
            console.log('🟡 PeerJS disconnected, attempting to reconnect...');
            peer.reconnect();
        });

        peer.on('close', () => {
            console.log('🔴 PeerJS connection closed');
            setCallState({ status: 'idle' });
        });

        // Handle incoming calls
        console.log('Registering incoming call handler for peer:', localVehicleId);
        peer.on('call', async (call) => {
            console.log('📞 ==================== INCOMING CALL ====================');
            console.log('📞 Incoming call from peer ID:', call.peer);
            console.log('📞 My peer ID:', localVehicleId);
            console.log('📞 Already in call?', callInProgressRef.current);
            console.log('📞 Active call exists?', !!activeCallRef.current);
            console.log('📞 =======================================================');

            // Prevent accepting if we're already in a call or trying to make one
            if (callInProgressRef.current || activeCallRef.current) {
                console.log('📞 Already in a call, rejecting incoming call');
                call.close();
                return;
            }

            // Store the pending call for manual acceptance
            pendingCallRef.current = call;

            // Show incoming call state - user must manually accept
            setCallState({
                status: 'ringing',
                remotePeerId: call.peer,
                incomingCall: true
            });

            console.log('📞 Call state set to RINGING - waiting for user to accept call...');
        });

        peerRef.current = peer;

        // Cleanup on unmount
        return () => {
            if (activeCallRef.current) {
                activeCallRef.current.close();
            }
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (peer) {
                peer.destroy();
            }
        };
    }, [localVehicleId]);

    // Get local audio stream
    const getLocalStream = useCallback(async (): Promise<MediaStream> => {
        if (localStreamRef.current) {
            return localStreamRef.current;
        }

        console.log('🎤 Requesting microphone access...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            // Start muted
            stream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });

            localStreamRef.current = stream;
            console.log('🎤 Microphone access granted, starting muted');
            return stream;
        } catch (error) {
            console.error('🔴 Failed to get microphone:', error);
            throw error;
        }
    }, []);

    // Start a call to another peer
    const startCall = useCallback(async (remotePeerId: string) => {
        if (!peerRef.current) {
            console.error('🔴 PeerJS not initialized');
            return;
        }

        if (callState.status !== 'idle' && callState.status !== 'ended') {
            console.log('🔴 Already in a call');
            return;
        }

        if (callInProgressRef.current) {
            console.log('� Call already in progress');
            return;
        }

        console.log(' Starting call to:', remotePeerId);

        // Mark that we're the caller
        isCallerRef.current = true;
        callInProgressRef.current = true;

        setCallState({ status: 'calling', remotePeerId, incomingCall: false });

        try {
            // Get local stream
            const localStream = await getLocalStream();

            // Wait a bit to ensure the other peer is ready to receive
            await new Promise(resolve => setTimeout(resolve, 100));

            // Make the call
            console.log('📞 Calling peer:', remotePeerId);
            const call = peerRef.current.call(remotePeerId, localStream);

            if (!call) {
                throw new Error('Failed to initiate call');
            }

            activeCallRef.current = call;

            // Handle when remote peer answers
            call.on('stream', (remoteStream) => {
                console.log('📞 Received remote stream');
                remoteStreamRef.current = remoteStream;
                setRemoteStream(remoteStream);
                setCallState({ status: 'active', remotePeerId });
            });

            call.on('close', () => {
                console.log('📞 Call closed');
                handleCallEnd();
            });

            call.on('error', (error) => {
                console.error('🔴 Call error:', error);
                setCallState({ status: 'error', error: error.message });
                handleCallEnd();
            });

        } catch (error) {
            console.error('🔴 Failed to start call:', error);
            callInProgressRef.current = false;
            setCallState({
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to start call'
            });
        }
    }, [callState.status, getLocalStream]);

    // Answer an incoming call (called manually by user)
    const acceptCall = useCallback(async () => {
        const call = pendingCallRef.current;

        if (!call) {
            console.error('🔴 No pending call to accept');
            return;
        }

        console.log('📞 User accepted call from:', call.peer);

        // Mark that we're the callee
        isCallerRef.current = false;
        callInProgressRef.current = true;

        setCallState({ status: 'connecting', remotePeerId: call.peer, incomingCall: false });

        try {
            // Get local stream
            const localStream = await getLocalStream();

            // Answer the call with our stream
            call.answer(localStream);

            // Store as active call
            activeCallRef.current = call;
            pendingCallRef.current = null;

            // Handle remote stream
            call.on('stream', (remoteStream) => {
                console.log('📞 Received remote stream');
                remoteStreamRef.current = remoteStream;
                setRemoteStream(remoteStream);
                setCallState({ status: 'active', remotePeerId: call.peer, incomingCall: false });
            });

            call.on('close', () => {
                console.log('📞 Call closed');
                handleCallEnd();
            });

            call.on('error', (error) => {
                console.error('🔴 Call error:', error);
                setCallState({ status: 'error', error: error.message, incomingCall: false });
                handleCallEnd();
            });

        } catch (error) {
            console.error('🔴 Failed to answer call:', error);
            callInProgressRef.current = false;
            pendingCallRef.current = null;
            setCallState({
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to answer call',
                incomingCall: false
            });
        }
    }, [getLocalStream]);

    // Reject an incoming call
    const rejectCall = useCallback(() => {
        const call = pendingCallRef.current;

        if (call) {
            console.log('📞 User rejected call from:', call.peer);
            call.close();
            pendingCallRef.current = null;
        }

        setCallState({ status: 'idle' });
    }, []);

    // End the current call
    const endCall = useCallback(() => {
        console.log('📞 Ending call');
        handleCallEnd();
    }, []);

    // Internal call cleanup
    const handleCallEnd = () => {
        console.log('📞 Cleaning up call');

        // Reset flags
        isCallerRef.current = false;
        callInProgressRef.current = false;

        // Close the call
        if (activeCallRef.current) {
            activeCallRef.current.close();
            activeCallRef.current = null;
        }

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Clear remote stream
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(track => track.stop());
            remoteStreamRef.current = null;
        }
        setRemoteStream(null);

        // Update state
        setCallState({ status: 'ended' });

        // Reset to idle after a moment
        setTimeout(() => {
            setCallState({ status: 'idle' });
        }, 1000);
    };

    // Toggle microphone mute
    const toggleMute = useCallback(() => {
        if (!localStreamRef.current) {
            console.warn('🔴 No local stream to toggle');
            return;
        }

        const audioTracks = localStreamRef.current.getAudioTracks();

        if (audioTracks.length === 0) {
            console.warn('🔴 No audio tracks found');
            return;
        }

        const currentState = audioTracks[0].enabled;
        const newState = !currentState;

        audioTracks.forEach(track => {
            track.enabled = newState;
            console.log('🎤 Track', track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
        });

        setIsMicMuted(!newState);
        console.log('🎤 Microphone toggled:', newState ? 'UNMUTED (speaking)' : 'MUTED (silent)');
        console.log('🎤 Track details:', {
            enabled: audioTracks[0].enabled,
            readyState: audioTracks[0].readyState,
            muted: audioTracks[0].muted,
            label: audioTracks[0].label
        });
    }, []);

    // Monitor audio levels from remote stream
    useEffect(() => {
        if (!remoteStream) return;

        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length === 0) return;

        console.log('📊 Starting audio level monitoring for remote stream');

        if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
            console.log('⚠️ AudioContext not available');
            return;
        }

        try {
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(remoteStream);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            microphone.connect(analyser);
            analyser.fftSize = 256;

            let checkCount = 0;
            const checkAudioLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                checkCount++;

                if (average > 5) {
                    console.log('🔊 REMOTE AUDIO DETECTED! Level:', Math.round(average));
                } else if (checkCount % 25 === 0) {
                    console.log('🔇 Remote audio silent (level:', Math.round(average), ')');
                }
            };

            const intervalId = setInterval(checkAudioLevel, 200);

            return () => {
                clearInterval(intervalId);
                microphone.disconnect();
                audioContext.close();
                console.log('📊 Stopped audio level monitoring');
            };
        } catch (err) {
            console.error('❌ Error setting up audio monitoring:', err);
        }
    }, [remoteStream]);

    return {
        callState,
        remoteStream,
        localStream: localStreamRef.current,
        isMicMuted,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        isReady: peerRef.current?.id === localVehicleId
    };
}
