"use client";
import { useEffect, useState } from 'react';
import { connectionService } from '@/utils/connectionService';

/**
 * Hook to monitor browser online/offline state and toggle hardware mode.
 * Hardware mode becomes active when window.navigator.onLine === false.
 */
export function useHardwareMode() {
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [hardwareMode, setHardwareMode] = useState<boolean>(!isOnline);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            connectionService.setHardwareMode(false);
            setHardwareMode(false);
        };
        const handleOffline = () => {
            setIsOnline(false);
            connectionService.setHardwareMode(true);
            setHardwareMode(true);
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        // Initialize current state
        if (!navigator.onLine) handleOffline();
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, hardwareMode };
}