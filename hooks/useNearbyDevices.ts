// Custom hook for managing nearby devices state

import { useState, useEffect, useCallback, useRef } from 'react';
import { NearbyDevice } from '../types/v2v.types';
import { deviceScanner } from '../utils/deviceScanner';
import { webSocketService } from '../utils/websocketService';

export function useNearbyDevices() {
  const [devices, setDevices] = useState<NearbyDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const scanIntervalRef = useRef<number>(5000); // Fixed 5 second interval

  /**
   * Start device scanning (simplified)
   */
  const startScanning = useCallback(async (intervalMs?: number) => {
    if (isScanning) return;

    try {
      setError(null);
      setIsScanning(true);

      const interval = intervalMs || scanIntervalRef.current;
      await deviceScanner.startScanning(interval);
      setLastScanTime(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scanning');
      setIsScanning(false);
    }
  }, [isScanning]);

  /**
   * Stop device scanning
   */
  const stopScanning = useCallback(async () => {
    if (!isScanning) return;

    try {
      await deviceScanner.stopScanning();
      setIsScanning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop scanning');
    }
  }, [isScanning]);

  /**
   * Refresh device list manually
   */
  const refreshDevices = useCallback(() => {
    const currentDevices = deviceScanner.getCurrentDevices();
    setDevices(currentDevices);
    setLastScanTime(new Date());
  }, []);

  /**
   * Update scan interval
   */
  const updateScanInterval = useCallback((intervalMs: number) => {
    scanIntervalRef.current = intervalMs;
    // Don't restart scanning automatically to prevent loops
  }, []);

  /**
   * Set up device scanner event listeners (simplified for stability)
   */
  useEffect(() => {
    const handleDeviceDiscovered = (device: NearbyDevice) => {
      setDevices(prev => {
        // Check if device already exists
        const existingIndex = prev.findIndex(d => d.id === device.id);
        if (existingIndex >= 0) {
          // Update existing device
          const updated = [...prev];
          updated[existingIndex] = device;
          return updated.sort((a, b) => a.distance - b.distance);
        } else {
          // Add new device
          const updated = [...prev, device];
          return updated.sort((a, b) => a.distance - b.distance);
        }
      });

      // Simple WebSocket broadcast without debouncing
      webSocketService.broadcastDeviceDiscovery(device);
    };

    const handleDeviceLost = (deviceId: string) => {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      webSocketService.broadcastDeviceLost(deviceId);
    };

    deviceScanner.onDeviceDiscovered(handleDeviceDiscovered);
    deviceScanner.onDeviceLost(handleDeviceLost);

    // Initial device list
    refreshDevices();

    return () => {
      // Cleanup will be handled by the main useEffect
    };
  }, [refreshDevices]);

  /**
   * Set up WebSocket subscription for nearby vehicles from V2V backend
   */
  useEffect(() => {
    const handleNearbyVehicles = (payload: any) => {
      console.log('[useNearbyDevices] Received nearby_vehicles:', payload);

      if (payload && Array.isArray(payload.vehicles)) {
        const nearbyVehicles: NearbyDevice[] = payload.vehicles.map((vehicle: any) => ({
          id: vehicle.vehicleId || vehicle.id,
          name: vehicle.driverName || `Vehicle ${vehicle.vehicleId || vehicle.id}`,
          deviceType: 'vehicle' as const,
          distance: vehicle.distance || vehicle.distanceM || 0,
          signalStrength: vehicle.signalStrength || 85,
          isConnected: false,
          isConnectable: true,
          lastSeen: new Date(),
          capabilities: vehicle.capabilities || ['messaging', 'calling'],
          batteryLevel: vehicle.batteryLevel,
          vehicleInfo: {
            licensePlate: vehicle.licensePlate,
            model: vehicle.model,
            color: vehicle.color,
            speed: vehicle.speed,
            heading: vehicle.heading
          }
        }));

        setDevices(prevDevices => {
          // Merge with existing local devices, prioritizing V2V backend data
          const localDevices = prevDevices.filter(d => d.deviceType !== 'vehicle');
          const allDevices = [...localDevices, ...nearbyVehicles];
          return allDevices.sort((a, b) => a.distance - b.distance);
        });
      } else if (payload && Array.isArray(payload)) {
        // Handle direct array format
        const nearbyVehicles: NearbyDevice[] = payload.map((vehicle: any) => ({
          id: vehicle.vehicleId || vehicle.id,
          name: vehicle.driverName || `Vehicle ${vehicle.vehicleId || vehicle.id}`,
          deviceType: 'vehicle' as const,
          distance: vehicle.distance || vehicle.distanceM || 0,
          signalStrength: vehicle.signalStrength || 85,
          isConnected: false,
          isConnectable: true,
          lastSeen: new Date(),
          capabilities: vehicle.capabilities || ['messaging', 'calling'],
          batteryLevel: vehicle.batteryLevel,
          vehicleInfo: {
            licensePlate: vehicle.licensePlate,
            model: vehicle.model,
            color: vehicle.color,
            speed: vehicle.speed,
            heading: vehicle.heading
          }
        }));

        setDevices(prevDevices => {
          const localDevices = prevDevices.filter(d => d.deviceType !== 'vehicle');
          const allDevices = [...localDevices, ...nearbyVehicles];
          return allDevices.sort((a, b) => a.distance - b.distance);
        });
      }
    };

    const handleRemoteDeviceDiscovered = (payload: NearbyDevice) => {
      setDevices(prev => {
        const existingIndex = prev.findIndex(d => d.id === payload.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = payload;
          return updated.sort((a, b) => a.distance - b.distance);
        } else {
          const updated = [...prev, payload];
          return updated.sort((a, b) => a.distance - b.distance);
        }
      });
    };

    const handleRemoteDeviceLost = (payload: { deviceId: string }) => {
      setDevices(prev => prev.filter(d => d.id !== payload.deviceId));
    };

    // Subscribe to V2V backend nearby vehicles events
    webSocketService.subscribe('nearby_vehicles', handleNearbyVehicles);
    webSocketService.subscribe('device_discovered', handleRemoteDeviceDiscovered);
    webSocketService.subscribe('device_lost', handleRemoteDeviceLost);

    return () => {
      webSocketService.unsubscribe('nearby_vehicles', handleNearbyVehicles);
      webSocketService.unsubscribe('device_discovered', handleRemoteDeviceDiscovered);
      webSocketService.unsubscribe('device_lost', handleRemoteDeviceLost);
    };
  }, []);

  // Listen for manual refresh event from UI and trigger a device list refresh
  useEffect(() => {
    const handler = () => {
      try {
        refreshDevices();
        // Optionally signal backend by re-broadcasting discovered devices (lightweight)
        devices.forEach(d => webSocketService.broadcastDeviceDiscovery(d));
      } catch (e) {
        // ignore errors for manual refresh to remain silent
      }
    };
    window.addEventListener('v2v-manual-refresh', handler as EventListener);
    return () => window.removeEventListener('v2v-manual-refresh', handler as EventListener);
  }, [devices, refreshDevices]);

  /**
   * Filter devices by type
   */
  const getDevicesByType = useCallback((deviceType: NearbyDevice['deviceType']) => {
    return devices.filter(device => device.deviceType === deviceType);
  }, [devices]);

  /**
   * Get connectable devices only
   */
  const getConnectableDevices = useCallback(() => {
    return devices.filter(device => device.isConnectable);
  }, [devices]);

  /**
   * Get device by ID
   */
  const getDeviceById = useCallback((deviceId: string) => {
    return devices.find(device => device.id === deviceId);
  }, [devices]);

  /**
   * Get devices within specific range
   */
  const getDevicesInRange = useCallback((maxDistance: number) => {
    return devices.filter(device => device.distance <= maxDistance);
  }, [devices]);

  /**
   * Auto-start scanning on mount (only once)
   */
  useEffect(() => {
    let mounted = true;

    const initializeScanning = async () => {
      if (mounted && !isScanning) {
        try {
          await startScanning();
        } catch (error) {
          console.error('Failed to initialize scanning:', error);
        }
      }
    };

    initializeScanning();

    return () => {
      mounted = false;
      if (isScanning) {
        stopScanning().catch(console.error);
      }
    };
  }, []); // Empty dependency array to run only once

  return {
    devices,
    isScanning,
    error,
    lastScanTime,
    scanInterval: scanIntervalRef.current,
    startScanning,
    stopScanning,
    refreshDevices,
    updateScanInterval,
    getDevicesByType,
    getConnectableDevices,
    getDeviceById,
    getDevicesInRange
  };
}