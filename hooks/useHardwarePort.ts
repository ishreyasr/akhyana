import { useCallback, useEffect, useRef, useState } from 'react';
import { hardwareTransportSingleton, HardwareTransportStatus } from '@/utils/hardwareTransport';

interface UseHardwarePortResult {
    status: HardwareTransportStatus;
    lastMessage: unknown;
    connect: () => Promise<void>;
    write: (data: unknown) => Promise<void>;
}

export function useHardwarePort(): UseHardwarePortResult {
    const [status, setStatus] = useState<HardwareTransportStatus>({
        connected: false,
        initializing: false,
        reconnecting: false,
        attempt: 0
    });
    const [lastMessage, setLastMessage] = useState<unknown>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        const transport = hardwareTransportSingleton;
        const handleStatus = (s: HardwareTransportStatus) => {
            if (mounted.current) setStatus(s);
        };
        const handleMessage = (msg: unknown) => {
            if (mounted.current) setLastMessage(msg);
        };
        transport.onStatus(handleStatus);
        transport.onMessage(handleMessage);

        // Attempt silent reconnect on mount
        if (typeof window !== 'undefined' && 'serial' in navigator) {
            // small delay so status listeners are attached
            setTimeout(() => {
                if (!transport['status'].connected) {
                    transport.connect(false);
                }
            }, 300);
        }

        return () => {
            mounted.current = false;
        };
    }, []);

    const connect = useCallback(async () => {
        await hardwareTransportSingleton.connect(true);
    }, []);

    const write = useCallback(async (data: unknown) => {
        try {
            await hardwareTransportSingleton.write(data);
        } catch (e) {
            console.warn('HW write failed', e);
        }
    }, []);

    return { status, lastMessage, connect, write };
}
