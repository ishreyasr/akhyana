import { useEffect, useState } from 'react';

/**
 * Hook to detect if component has hydrated on the client
 * Helps prevent SSR hydration mismatches
 */
export function useIsClient() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    return isClient;
}
