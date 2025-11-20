// Custom hook for managing vehicle status state

import { useState, useEffect, useCallback } from 'react';
import { VehicleStatus } from '../types/v2v.types';
import { webSocketService } from '../utils/websocketService';

// Mock initial vehicle status
const INITIAL_VEHICLE_STATUS: VehicleStatus = {
  isOnline: false,
  lastConnected: new Date(),
  vehicleId: 'my-vehicle-123',
  signalStrength: null,
  batteryLevel: null,
  gpsStatus: 'searching',
  signalSource: 'unknown',
  batterySource: 'unknown'
};

export function useVehicleStatus() {
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>(INITIAL_VEHICLE_STATUS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize vehicle status and set up real-time updates
   */
  useEffect(() => {
    let mounted = true;

    const initializeStatus = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate initial status check
        await new Promise(resolve => setTimeout(resolve, 500));

        if (mounted) {
          // Simulate vehicle coming online
          const initialStatus: VehicleStatus = {
            ...INITIAL_VEHICLE_STATUS,
            isOnline: true,
            signalStrength: null, // hidden until real or simulated decided
            batteryLevel: null,
            gpsStatus: 'locked',
            lastConnected: new Date(),
            signalSource: 'unknown',
            batterySource: 'unknown'
          };

          setVehicleStatus(initialStatus);
          setIsLoading(false);

          // Broadcast initial status
          webSocketService.broadcastStatusUpdate(initialStatus);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize vehicle status');
          setIsLoading(false);
        }
      }
    };

    initializeStatus();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Set up WebSocket subscription for status updates
   */
  useEffect(() => {
    const handleStatusUpdate = (payload: VehicleStatus) => {
      setVehicleStatus(payload);
    };

    webSocketService.subscribe('status_update', handleStatusUpdate);

    return () => {
      webSocketService.unsubscribe('status_update', handleStatusUpdate);
    };
  }, []);

  /**
   * Update vehicle online status
   */
  const setOnlineStatus = useCallback((isOnline: boolean) => {
    setVehicleStatus(prev => {
      const updated: VehicleStatus = {
        ...prev,
        isOnline,
        lastConnected: isOnline ? new Date() : prev.lastConnected,
        signalStrength: isOnline ? (prev.signalStrength ?? null) : null,
        batteryLevel: prev.batteryLevel,
        signalSource: prev.signalSource ?? 'unknown',
        batterySource: prev.batterySource ?? 'unknown'
      };

      // Broadcast status change
      webSocketService.broadcastStatusUpdate(updated);

      return updated;
    });
  }, []);

  /**
   * Update signal strength
   */
  const updateSignalStrength = useCallback((strength: number | null, source: VehicleStatus['signalSource'] = 'simulated') => {
    setVehicleStatus(prev => {
      const updated: VehicleStatus = {
        ...prev,
        signalStrength: strength == null ? null : Math.max(0, Math.min(100, strength)),
        signalSource: strength == null ? 'unknown' : source,
        telemetryUpdatedAt: Date.now()
      };

      webSocketService.broadcastStatusUpdate(updated);
      return updated;
    });
  }, []);

  /**
   * Update GPS status
   */
  const updateGpsStatus = useCallback((gpsStatus: VehicleStatus['gpsStatus']) => {
    setVehicleStatus(prev => {
      const updated: VehicleStatus = {
        ...prev,
        gpsStatus
      };

      webSocketService.broadcastStatusUpdate(updated);
      return updated;
    });
  }, []);

  /**
   * Update battery level
   */
  const updateBatteryLevel = useCallback((batteryLevel: number | null, source: VehicleStatus['batterySource'] = 'simulated') => {
    setVehicleStatus(prev => {
      const updated: VehicleStatus = {
        ...prev,
        batteryLevel: batteryLevel == null ? null : Math.max(0, Math.min(100, batteryLevel)),
        batterySource: batteryLevel == null ? 'unknown' : source,
        telemetryUpdatedAt: Date.now()
      };

      webSocketService.broadcastStatusUpdate(updated);
      return updated;
    });
  }, []);

  /**
   * Refresh vehicle status
   */
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate status refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

      setVehicleStatus(prev => {
        const simulatedSignal = Math.floor(Math.random() * 40) + 60; // 60-100
        const simulatedBattery = Math.max((prev.batteryLevel ?? 80) - Math.floor(Math.random() * 5), 20);
        const updated: VehicleStatus = {
          ...prev,
          lastConnected: new Date(),
          signalStrength: simulatedSignal,
          batteryLevel: simulatedBattery,
          signalSource: 'simulated',
          batterySource: 'simulated',
          telemetryUpdatedAt: Date.now()
        };

        webSocketService.broadcastStatusUpdate(updated);
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    vehicleStatus,
    isLoading,
    error,
    setOnlineStatus,
    updateSignalStrength,
    updateGpsStatus,
    updateBatteryLevel,
    refreshStatus
  };
}