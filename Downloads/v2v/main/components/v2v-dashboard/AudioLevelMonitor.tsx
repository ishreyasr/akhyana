'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface AudioLevelMonitorProps {
    stream: MediaStream | null;
    label: string;
}

export function AudioLevelMonitor({ stream, label }: AudioLevelMonitorProps) {
    const [audioLevel, setAudioLevel] = useState(0);
    const [peakLevel, setPeakLevel] = useState(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (!stream || typeof window === 'undefined') return;

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.log(`⚠️ ${label}: No audio tracks`);
            return;
        }

        console.log(`📊 ${label}: Starting audio monitoring`);

        try {
            const audioContext = new AudioContext();
            const analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaStreamSource(stream);

            source.connect(analyser);
            analyser.fftSize = 256;

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            let frameId: number;

            const checkLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const normalized = Math.min(100, (average / 128) * 100);

                setAudioLevel(normalized);
                setPeakLevel(prev => Math.max(prev, normalized));
                setIsSpeaking(normalized > 5);

                frameId = requestAnimationFrame(checkLevel);
            };

            checkLevel();

            return () => {
                cancelAnimationFrame(frameId);
                source.disconnect();
                audioContext.close();
                console.log(`📊 ${label}: Stopped monitoring`);
            };
        } catch (err) {
            console.error(`❌ ${label}: Audio monitoring error:`, err);
        }
    }, [stream, label]);

    if (!stream) return null;

    const audioTracks = stream.getAudioTracks();
    const track = audioTracks[0];

    return (
        <Card className="p-3 bg-slate-900/50">
            <div className="text-xs font-medium mb-2">{label}</div>

            {/* Track status */}
            <div className="text-xs text-muted-foreground mb-2">
                {track ? (
                    <>
                        {track.enabled ? '✅ Enabled' : '❌ Disabled'} |
                        {track.muted ? ' 🔇 Muted' : ' 🔊 Unmuted'} |
                        {track.readyState}
                    </>
                ) : (
                    'No track'
                )}
            </div>

            {/* Audio level bar */}
            <div className="relative h-6 bg-slate-800 rounded overflow-hidden mb-1">
                <div
                    className={`h-full transition-all duration-100 ${isSpeaking ? 'bg-green-500' : 'bg-slate-600'
                        }`}
                    style={{ width: `${audioLevel}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-mono">
                    {Math.round(audioLevel)}%
                </div>
            </div>

            {/* Stats */}
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Peak: {Math.round(peakLevel)}%</span>
                <span className={isSpeaking ? 'text-green-400 font-bold' : ''}>
                    {isSpeaking ? '🎤 SPEAKING' : '🔇 Silent'}
                </span>
            </div>
        </Card>
    );
}
