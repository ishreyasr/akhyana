"use client";
import React, { useEffect, useState } from 'react';
import { webSocketService } from '@/utils/websocketService';
import { useIsClient } from '@/hooks/useIsClient';

type State = { state: string; attempt?: number; delay?: number };

export const ConnectionStateBanner: React.FC = () => {
    const isClient = useIsClient();
    const [conn, setConn] = useState<State>({ state: 'disconnected' }); // Start with consistent state

    useEffect(() => {
        if (!isClient) return;

        const handler = (payload: any) => setConn(payload);
        webSocketService.subscribe('connection_state', handler);

        // Set initial state only after client hydration
        setConn({ state: webSocketService.getConnectionStatus() });

        return () => webSocketService.unsubscribe('connection_state', handler);
    }, [isClient]);

    // Don't render during SSR to prevent hydration mismatch
    if (!isClient) {
        return null;
    }

    if (conn.state === 'connected') return null;

    let text = '';
    switch (conn.state) {
        case 'connecting': text = 'Connecting…'; break;
        case 'reconnecting': text = `Reconnecting (attempt ${conn.attempt}) in ${Math.round((conn.delay || 0) / 1000)}s…`; break;
        case 'disconnected': text = 'Disconnected'; break;
        case 'error': text = 'Connection Error'; break;
        default: text = conn.state;
    }

    return (
        <div className="w-full bg-amber-500 dark:bg-amber-600 text-black dark:text-white text-xs px-3 py-1 flex items-center justify-between animate-pulse">
            <span>{text}</span>
            <button
                onClick={() => webSocketService.connect()}
                className="text-[10px] underline"
            >Retry</button>
        </div>
    );
};
