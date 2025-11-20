import { useCallback, useEffect, useRef, useState } from 'react';
import { webSocketService } from '../utils/websocketService';

interface CallState {
  status: 'idle' | 'ringing' | 'calling' | 'connecting' | 'active' | 'ended' | 'error';
  callerId?: string;
  calleeId?: string;
  reason?: string;
  consent?: 'pending' | 'approved' | 'declined';
}

export function useWebRTCCall(localVehicleId: string | undefined) {
  const [callState, setCallState] = useState<CallState>({ status: 'idle' });
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const targetIdRef = useRef<string | null>(null);
  const callInitiatedRef = useRef<boolean>(false);
  const offerStartedRef = useRef<boolean>(false);

  const ensurePeer = useCallback(() => {
    if (!peerRef.current) {
      peerRef.current = new RTCPeerConnection({
        iceServers: [
          // Google's public STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Additional free STUN servers for redundancy
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:stun.voip.blackberry.com:3478' },
          // Free TURN server (limited usage)
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
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });

      // Send ICE candidates immediately - no batching
      // The server should handle rate limiting if needed
      peerRef.current.onicecandidate = (e) => {
        const target = targetIdRef.current;
        if (!target) return;

        if (e.candidate) {
          console.log('📞 Sending ICE candidate:', e.candidate.type);
          try {
            webSocketService.sendIceCandidate(target, e.candidate);
          } catch (err) {
            console.error('📞 Failed to send ICE candidate:', err);
          }
        } else {
          // End of candidates signal
          console.log('📞 ICE gathering complete');
          try {
            webSocketService.sendIceCandidate(target, null as any);
          } catch (err) {
            console.error('📞 Failed to send end-of-candidates:', err);
          }
        }
      };

      peerRef.current.ontrack = (e) => {
        console.log('📞 Received remote track:', e.track.kind, e.track.id);
        console.log('📞 Track readyState:', e.track.readyState);
        console.log('📞 Track enabled:', e.track.enabled);
        console.log('📞 Streams received:', e.streams.length);

        if (e.streams && e.streams.length > 0) {
          const remoteStream = e.streams[0];
          console.log('📞 Using first stream with tracks:', remoteStream.getTracks().length);

          // Ensure the track is enabled and active
          e.track.enabled = true;

          remoteStreamRef.current = remoteStream;
          setRemoteStream(remoteStream);

          console.log('📞 Remote stream set successfully');
        } else {
          // Fallback: create new stream with the track
          console.log('📞 No streams in event, creating new stream with track');
          const newRemoteStream = new MediaStream([e.track]);
          e.track.enabled = true;

          remoteStreamRef.current = newRemoteStream;
          setRemoteStream(newRemoteStream);
        }
      };

      peerRef.current.onconnectionstatechange = () => {
        const state = peerRef.current?.connectionState;
        const iceState = peerRef.current?.iceConnectionState;
        const signalingState = peerRef.current?.signalingState;

        console.log('📞 WebRTC states changed:', {
          connection: state,
          ice: iceState,
          signaling: signalingState
        });

        if (state === 'connected') {
          console.log('📞 WebRTC connection established successfully');
          setCallState(s => ({ ...s, status: 'active' }));
        }
        if (state === 'failed') {
          console.error('📞 WebRTC connection failed');
          setCallState(s => ({ ...s, status: 'ended', reason: 'connection_failed' }));
        }
        if (state === 'disconnected') {
          console.warn('📞 WebRTC connection disconnected');
          setCallState(s => ({ ...s, status: 'ended', reason: 'connection_disconnected' }));
        }
        if (state === 'connecting') {
          console.log('📞 WebRTC connection in progress...');
          setCallState(s => ({ ...s, status: 'connecting' }));
        }
      };

      peerRef.current.onsignalingstatechange = () => {
        const state = peerRef.current?.signalingState;
        console.log('📞 WebRTC signaling state changed:', state);
      };

      peerRef.current.oniceconnectionstatechange = () => {
        console.log('📞 ICE state:', peerRef.current?.iceConnectionState);
      };

      peerRef.current.onnegotiationneeded = () => {
        console.log('📞 negotiationneeded');
      };
    }
    return peerRef.current;
  }, []);

  const startCall = useCallback(async (calleeId: string) => {
    if (!localVehicleId) throw new Error('Not registered');

    // Prevent starting a call if we're already in a call state
    if (callState.status !== 'idle' && callState.status !== 'ended') {
      console.log('📞 Cannot start call - already in call state:', callState.status);
      return;
    }
    if (callInitiatedRef.current) {
      console.log('📞 Call already initiated, ignoring duplicate start');
      return;
    }

    console.log('📞 Starting call from', localVehicleId, 'to', calleeId);
    setCallState(s => ({ ...s, status: 'calling', callerId: localVehicleId, calleeId }));
    targetIdRef.current = calleeId;

    // Reset flags for new call
    callInitiatedRef.current = true;
    offerStartedRef.current = false;

    // Send call initiation message
    webSocketService.callInitiate(calleeId);
    console.log('📞 Sent call_initiate message');

    // Start the offer flow immediately
    try {
      await initiateOfferFlow();
    } catch (e) {
      console.error('Offer flow failed:', e);
      endCall('offer_failed');
    }
  }, [localVehicleId, callState.status]);
  const requestConnection = useCallback((targetId: string, purpose?: string) => {
    if (!localVehicleId) throw new Error('Not registered');
    targetIdRef.current = targetId;
    setCallState({ status: 'idle', callerId: localVehicleId, calleeId: targetId, consent: 'pending' });
    webSocketService.sendMessage('connect_request', { requesterId: localVehicleId, targetId, purpose });
  }, [localVehicleId]);

  const acceptCall = useCallback(async (callerId: string) => {
    console.log('📞 Accepting call from:', callerId);
    setCallState({ status: 'connecting', callerId, calleeId: localVehicleId });
    // Don't create offer here - wait for the caller's offer
  }, [localVehicleId]);

  async function attachLocalAudio() {
    if (!localStreamRef.current) {
      console.log('📞 Getting local audio stream...');
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1
          }
        });
        console.log('📞 Local audio stream obtained, tracks:', localStreamRef.current.getTracks().length);

        // Start all tracks as muted initially
        localStreamRef.current.getAudioTracks().forEach((track, index) => {
          track.enabled = false; // Start muted
          console.log(`📞 Local audio track ${index}:`, {
            id: track.id,
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label
          });
        });
      } catch (error) {
        console.error('📞 Failed to get local audio stream:', error);
        throw error;
      }
    }

    const pc = ensurePeer();

    // Remove existing audio tracks first
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track && sender.track.kind === 'audio') {
        try {
          console.log('📞 Removing existing audio track:', sender.track.id);
          pc.removeTrack(sender);
        } catch (e) {
          console.warn('Failed to remove track:', e);
        }
      }
    }

    // Add the local audio track
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        console.log('📞 Adding local audio track to peer connection:', {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState
        });

        // Track will remain in its current muted state (false)
        const sender = pc.addTrack(track, localStreamRef.current);
        console.log('📞 Local audio track added successfully, sender:', sender);
      } else {
        console.error('📞 No audio tracks found in local stream');
      }
    }
  }

  const handleOffer = useCallback(async (data: any) => {
    console.log('📞 Handling incoming offer from:', data.targetId || data.callerId);
    console.log('📞 Offer SDP:', data.sdp?.type, data.sdp?.sdp?.substring(0, 100) + '...');

    try {
      const pc = ensurePeer();
      await attachLocalAudio();
      targetIdRef.current = data.targetId || data.callerId;

      // Check if we're in the right state to handle this offer
      if (pc.signalingState !== 'stable') {
        console.warn('Received offer but peer connection is not in stable state:', pc.signalingState);
        // Attempt rollback then proceed
        try {
          await pc.setLocalDescription({ type: 'rollback' } as any);
          console.log('📞 Rollback successful, proceeding with offer');
        } catch (e) {
          console.warn('Rollback failed:', e);
        }
      }

      console.log('📞 Setting remote description...');
      await pc.setRemoteDescription(data.sdp);
      console.log('📞 Remote description set successfully');

      console.log('📞 Creating answer...');
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      console.log('📞 Answer created:', answer.type, answer.sdp?.substring(0, 100) + '...');

      console.log('📞 Setting local description (answer)...');
      await pc.setLocalDescription(answer);
      console.log('📞 Local description (answer) set successfully');

      console.log('📞 Sending answer to:', targetIdRef.current);
      webSocketService.sendAnswer(targetIdRef.current!, answer);
      setCallState(s => ({ ...s, status: 'connecting' }));
    } catch (error) {
      console.error('📞 Failed to handle offer:', error);
      console.error('📞 Error details:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
      endCall('offer_handling_failed');
    }
  }, [ensurePeer]);

  const handleAnswer = useCallback(async (data: any) => {
    console.log('📞 Handling incoming answer from:', data.targetId || data.callerId);
    console.log('📞 Answer SDP:', data.sdp?.type, data.sdp?.sdp?.substring(0, 100) + '...');

    try {
      const pc = ensurePeer();

      // Check if we're in the right state to handle this answer
      if (pc.signalingState !== 'have-local-offer') {
        console.warn('Received answer but peer connection is not in have-local-offer state:', pc.signalingState);
        console.log('📞 Current signaling state:', pc.signalingState);
        return;
      }

      console.log('📞 Setting remote description (answer)...');
      await pc.setRemoteDescription(data.sdp);
      console.log('📞 Remote description (answer) set successfully');
      setCallState(s => ({ ...s, status: 'connecting' }));
    } catch (error) {
      console.error('📞 Failed to handle answer:', error);
      console.error('📞 Error details:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
      endCall('answer_handling_failed');
    }
  }, [ensurePeer]);

  const handleIce = useCallback(async (data: any) => {
    try {
      const pc = ensurePeer();
      console.log('📞 Handling ICE candidate:', data.candidate ? 'valid candidate' : 'end-of-candidates');

      // Check if remote description is set before adding ICE candidates
      if (!pc.remoteDescription) {
        console.warn('📞 Cannot add ICE candidate - remote description not set yet');
        return;
      }

      // Some stacks send null candidates to signal end-of-candidates
      if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
        console.log('📞 Added ICE candidate successfully');
      } else {
        // End-of-candidates signal
        await pc.addIceCandidate();
        console.log('📞 End-of-candidates received');
      }
    } catch (e) {
      console.error('📞 ICE candidate handling failed:', e);
      // Don't end the call for ICE candidate errors as they're often non-critical
    }
  }, [ensurePeer]);

  async function initiateOfferFlow() {
    try {
      console.log('📞 Starting offer flow...');

      const pc = ensurePeer();

      // Ensure we're in stable state before creating offer
      if (pc.signalingState !== 'stable') {
        console.warn('Cannot create offer - peer connection not in stable state:', pc.signalingState);
        // Reset the peer connection and try again
        resetPeerConnection();
        const newPc = ensurePeer();

        if (newPc.signalingState !== 'stable') {
          throw new Error('Peer connection not in stable state after reset');
        }
      }

      // Get local audio stream and add tracks BEFORE creating offer
      await attachLocalAudio();

      console.log('📞 Creating WebRTC offer...');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      console.log('📞 Setting local description...');
      await pc.setLocalDescription(offer);

      if (targetIdRef.current) {
        console.log('📞 Sending offer to:', targetIdRef.current);
        webSocketService.sendOffer(targetIdRef.current, offer);
        setCallState(s => ({ ...s, status: 'connecting' }));
      }
    } catch (error) {
      console.error('Failed to initiate offer flow:', error);
      endCall('offer_failed');
    }
  }

  const endCall = useCallback((reason?: string) => {
    console.log('📞 Ending call, reason:', reason);
    setCallState(s => ({ ...s, status: 'ended', reason }));
  }, []);

  const resetPeerConnection = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
    }
    peerRef.current = null;
  }, []);

  // Handle call state changes and cleanup
  useEffect(() => {
    if (callState.status === 'ended') {
      console.log('📞 Call ended, cleaning up resources...');

      // Clean up peer connection
      if (peerRef.current) {
        try {
          peerRef.current.getSenders().forEach(s => {
            try {
              if (s.track) s.track.stop();
            } catch (_) { }
          });
          peerRef.current.close();
        } catch (e) {
          console.warn('Error closing peer connection:', e);
        }
      }
      peerRef.current = null;

      // Clean up local stream
      if (localStreamRef.current) {
        try {
          localStreamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {
          console.warn('Error stopping local stream tracks:', e);
        }
      }
      localStreamRef.current = null;

      // Clean up remote stream
      if (remoteStreamRef.current) {
        try {
          remoteStreamRef.current.getTracks().forEach(t => t.stop());
        } catch (e) {
          console.warn('Error stopping remote stream tracks:', e);
        }
      }
      remoteStreamRef.current = null;
      setRemoteStream(null);

      // Reset state
      targetIdRef.current = null;
      callInitiatedRef.current = false;
      offerStartedRef.current = false;
    }
  }, [callState.status]);

  // WebSocket event subscriptions
  useEffect(() => {
    const onCallInitiate = (d: any) => {
      console.log('📞 Received call_initiate:', d, 'localVehicleId:', localVehicleId);
      if (d.calleeId === localVehicleId) {
        // We are the callee - someone is calling us
        console.log('📞 We are the callee, setting status to ringing');
        setCallState({ status: 'ringing', callerId: d.callerId, calleeId: localVehicleId });
      } else if (d.callerId === localVehicleId) {
        // We are the caller - acknowledge initiate only
        setCallState(s => ({ ...s, status: 'calling' }));
      } else {
        console.log('📞 Call_initiate not for us - calleeId:', d.calleeId, 'callerId:', d.callerId, 'localVehicleId:', localVehicleId);
      }
    };
    const onConnectRequest = (d: any) => {
      if (d.targetId === localVehicleId) {
        // Show incoming consent request -> represent as ringing-like pre-call state
        setCallState({ status: 'idle', callerId: d.requesterId, calleeId: localVehicleId, consent: 'pending' });
      }
    };
    const onConnectResponse = (d: any) => {
      if (d.requesterId === localVehicleId && targetIdRef.current === d.targetId) {
        if (d.approved) {
          setCallState(s => ({ ...s, consent: 'approved' }));
          // Auto start call after approval
          startCall(d.targetId);
        } else {
          setCallState(s => ({ ...s, consent: 'declined', status: 'ended', reason: d.reason || 'declined' }));
        }
      }
    };
    const onOffer = (d: any) => handleOffer(d);
    const onAnswer = (d: any) => handleAnswer(d);
    const onIce = (d: any) => handleIce(d);

    webSocketService.subscribe('call_initiate', onCallInitiate);
    webSocketService.subscribe('connect_request', onConnectRequest);
    webSocketService.subscribe('connect_response', onConnectResponse);
    webSocketService.subscribe('webrtc_offer', onOffer);
    webSocketService.subscribe('webrtc_answer', onAnswer);
    webSocketService.subscribe('ice_candidate', onIce);
    return () => {
      webSocketService.unsubscribe('call_initiate', onCallInitiate);
      webSocketService.unsubscribe('webrtc_offer', onOffer);
      webSocketService.unsubscribe('webrtc_answer', onAnswer);
      webSocketService.unsubscribe('ice_candidate', onIce);
      webSocketService.unsubscribe('connect_request', onConnectRequest);
      webSocketService.unsubscribe('connect_response', onConnectResponse);
    };
  }, [localVehicleId, handleOffer, handleAnswer, handleIce, startCall]);

  return {
    callState,
    startCall,
    requestConnection,
    acceptCall,
    initiateOfferFlow,
    endCall,
    resetPeerConnection,
    localStream: localStreamRef.current,
    remoteStream
  };
}
