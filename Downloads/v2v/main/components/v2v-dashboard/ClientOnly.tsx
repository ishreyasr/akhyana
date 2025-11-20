import React from 'react';
import { useIsClient } from '../../hooks/useIsClient';

interface ClientOnlyProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Component that only renders its children on the client side
 * Useful for preventing SSR hydration mismatches
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
    const isClient = useIsClient();

    if (!isClient) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
