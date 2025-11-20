// Custom hook for managing V2V device connections

import { useState, useEffect, useCallback } from 'react';
import { NearbyDevice, ConnectionStatus } from '../types/v2v.types';
import { connectionService, ConnectionResult } from '../utils/connectionService';

export function useConnection() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ state: 'idle' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<NearbyDevice | null>(null);

  /**
   * Subscribe to connection status changes
   */
  useEffect(() => {
    const unsubscribe = connectionService.onConnectionStateChange((status) => {
      setConnectionStatus(status);
      setIsConnecting(status.state === 'connecting');
      
      if (status.state === 'error') {
        setConnectionError(status.error || 'Connection failed');
      } else {
        setConnectionError(null);
      }
    });

    // Get initial status
    setConnectionStatus(connectionService.getConnectionStatus());

    return unsubscribe;
  }, []);

  /**
   * Connect to a device
   */
  const connectToDevice = useCallback(async (device: NearbyDevice): Promise<ConnectionResult> => {
    try {
      setConnectionError(null);
      setConnectedDevice(device);
      
      const result = await connectionService.connectToDevice(device);
      
      if (!result.success) {
        setConnectedDevice(null);
        setConnectionError(result.error || 'Connection failed');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      setConnectedDevice(null);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }, []);

  /**
   * Disconnect from current device
   */
  const disconnect = useCallback(async (): Promise<boolean> => {
    try {
      const success = await connectionService.disconnect();
      if (success) {
        setConnectedDevice(null);
        setConnectionError(null);
      }
      return success;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  }, []);

  /**
   * Cancel ongoing connection
   */
  const cancelConnection = useCallback(() => {
    connectionService.cancelConnection();
    setConnectedDevice(null);
    setConnectionError(null);
  }, []);

  /**
   * Test current connection quality
   */
  const testConnection = useCallback(async () => {
    return await connectionService.testConnection();
  }, []);

  /**
   * Check if connected to specific device
   */
  const isConnectedToDevice = useCallback((deviceId: string): boolean => {
    return connectionService.isConnectedToDevice(deviceId);
  }, []);

  /**
   * Get connection statistics
   */
  const getConnectionStats = useCallback(() => {
    return connectionService.getConnectionStats();
  }, []);

  /**
   * Clear connection error
   */
  const clearError = useCallback(() => {
    setConnectionError(null);
  }, []);

  /**
   * Get connected device info
   */
  const getConnectedDeviceInfo = useCallback(() => {
    const stats = connectionService.getConnectionStats();
    return {
      ...stats,
      device: connectedDevice
    };
  }, [connectedDevice]);

  return {
    // State
    connectionStatus,
    isConnecting,
    connectionError,
    connectedDevice,
    isConnected: connectionStatus.state === 'connected',
    isIdle: connectionStatus.state === 'idle',
    hasError: connectionStatus.state === 'error',

    // Actions
    connectToDevice,
    disconnect,
    cancelConnection,
    testConnection,
    clearError,

    // Utilities
    isConnectedToDevice,
    getConnectionStats,
    getConnectedDeviceInfo
  };
}