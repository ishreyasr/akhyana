// Navigation utilities for V2V dashboard

/**
 * Navigate to the connected vehicle dashboard
 */
export function navigateToConnectedDashboard(deviceId: string): void {
  // In a real Next.js app, you would use next/navigation
  // For now, we'll simulate navigation by updating the URL
  if (typeof window !== 'undefined') {
    // Store the connected device ID for the dashboard to use
    sessionStorage.setItem('connectedDeviceId', deviceId);
    
    // Navigate to the connected dashboard
    // In a real app, this would be something like:
    // router.push(`/dashboard/connected/${deviceId}`);
    
    // For this implementation, we'll just reload to the dashboard
    window.location.href = '/connected-vehicle';
  }
}

/**
 * Navigate back to the main V2V dashboard
 */
export function navigateToMainDashboard(): void {
  if (typeof window !== 'undefined') {
    // Clear any connected device session data
    sessionStorage.removeItem('connectedDeviceId');
    
    // Navigate back to main dashboard
    // In a real app: router.push('/v2v-dashboard');
    window.location.href = '/';
  }
}

/**
 * Get the currently connected device ID from session
 */
export function getConnectedDeviceId(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('connectedDeviceId');
  }
  return null;
}

/**
 * Check if we're currently on the connected dashboard
 */
export function isOnConnectedDashboard(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.pathname.includes('/connected-vehicle') && 
           sessionStorage.getItem('connectedDeviceId') !== null;
  }
  return false;
}

/**
 * Handle connection success navigation
 */
export function handleConnectionSuccess(deviceId: string, deviceName?: string): void {
  // Store additional connection info
  if (typeof window !== 'undefined') {
    const connectionInfo = {
      deviceId,
      deviceName: deviceName || `Device ${deviceId}`,
      connectedAt: new Date().toISOString()
    };
    
    sessionStorage.setItem('connectionInfo', JSON.stringify(connectionInfo));
  }
  
  // Navigate to connected dashboard
  navigateToConnectedDashboard(deviceId);
}