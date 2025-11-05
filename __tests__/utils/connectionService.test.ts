import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VehicleConnectionService } from '../../utils/connectionService';
import { NearbyDevice } from '../../types/v2v.types';

const mockDevice: NearbyDevice = {
  id: 'device-123',
  name: 'Test Vehicle',
  distance: 150,
  signalStrength: 85,
  lastSeen: new Date(),
  deviceType: 'vehicle',
  isConnectable: true
};

const mockUnavailableDevice: NearbyDevice = {
  id: 'device-456',
  name: 'Busy Vehicle',
  distance: 100,
  signalStrength: 75,
  lastSeen: new Date(),
  deviceType: 'vehicle',
  isConnectable: false
};

describe('VehicleConnectionService', () => {
  let service: VehicleConnectionService;

  beforeEach(() => {
    service = new VehicleConnectionService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with idle state', () => {
      const status = service.getConnectionStatus();
      expect(status.state).toBe('idle');
    });

    it('has no connected device initially', () => {
      expect(service.getConnectedDeviceId()).toBe(null);
      expect(service.isConnectedToDevice('any-device')).toBe(false);
    });

    it('returns correct initial stats', () => {
      const stats = service.getConnectionStats();
      expect(stats.isConnected).toBe(false);
      expect(stats.deviceId).toBeUndefined();
      expect(stats.connectedAt).toBeUndefined();
      expect(stats.duration).toBeUndefined();
    });
  });

  describe('connectToDevice', () => {
    it('connects to available device successfully', async () => {
      // Mock Math.random to ensure success
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const connectPromise = service.connectToDevice(mockDevice);
      
      // Fast-forward through connection process
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await connectPromise;
      
      expect(result.success).toBe(true);
      expect(result.deviceId).toBe('device-123');
      expect(result.connectionTime).toBeGreaterThan(0);
      
      const status = service.getConnectionStatus();
      expect(status.state).toBe('connected');
      expect(status.deviceId).toBe('device-123');
      expect(status.connectedAt).toBeInstanceOf(Date);
    });

    it('fails to connect to unavailable device', async () => {
      await expect(service.connectToDevice(mockUnavailableDevice))
        .rejects.toThrow('Device is not available for connection');
    });

    it('prevents multiple simultaneous connections', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Start first connection
      const firstConnection = service.connectToDevice(mockDevice);
      
      // Try to start second connection
      await expect(service.connectToDevice(mockDevice))
        .rejects.toThrow('Connection already in progress');
      
      // Complete first connection
      await vi.advanceTimersByTimeAsync(10000);
      await firstConnection;
    });

    it('handles connection failure during process', async () => {
      // Mock Math.random to force failure
      vi.spyOn(Math, 'random').mockReturnValue(0.01);

      const connectPromise = service.connectToDevice(mockDevice);
      
      // Fast-forward to trigger failure
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await connectPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed during');
      
      const status = service.getConnectionStatus();
      expect(status.state).toBe('error');
      expect(status.error).toBeDefined();
    });

    it('updates connection status during process', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const statusUpdates: any[] = [];
      service.onConnectionStateChange((status) => {
        statusUpdates.push({ ...status });
      });

      const connectPromise = service.connectToDevice(mockDevice);
      
      // Should immediately update to connecting
      expect(statusUpdates[0].state).toBe('connecting');
      expect(statusUpdates[0].deviceId).toBe('device-123');
      
      // Complete connection
      await vi.advanceTimersByTimeAsync(10000);
      await connectPromise;
      
      // Should update to connected
      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.state).toBe('connected');
    });
  });

  describe('disconnect', () => {
    it('disconnects from connected device', async () => {
      // First connect
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const connectPromise = service.connectToDevice(mockDevice);
      await vi.advanceTimersByTimeAsync(10000);
      await connectPromise;
      
      // Then disconnect
      const disconnectPromise = service.disconnect();
      await vi.advanceTimersByTimeAsync(1000);
      const result = await disconnectPromise;
      
      expect(result).toBe(true);
      expect(service.getConnectedDeviceId()).toBe(null);
      
      const status = service.getConnectionStatus();
      expect(status.state).toBe('idle');
    });

    it('returns false when not connected', async () => {
      const result = await service.disconnect();
      expect(result).toBe(false);
    });
  });

  describe('cancelConnection', () => {
    it('cancels ongoing connection', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Start connection
      service.connectToDevice(mockDevice);
      
      // Cancel connection
      service.cancelConnection();
      
      const status = service.getConnectionStatus();
      expect(status.state).toBe('idle');
    });

    it('does nothing when not connecting', () => {
      service.cancelConnection();
      
      const status = service.getConnectionStatus();
      expect(status.state).toBe('idle');
    });
  });

  describe('testConnection', () => {
    it('tests connected device successfully', async () => {
      // First connect
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const connectPromise = service.connectToDevice(mockDevice);
      await vi.advanceTimersByTimeAsync(10000);
      await connectPromise;
      
      // Test connection
      const testPromise = service.testConnection();
      await vi.advanceTimersByTimeAsync(500);
      const result = await testPromise;
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.quality).toBeGreaterThan(0);
      expect(result.quality).toBeLessThanOrEqual(100);
    });

    it('fails when not connected', async () => {
      const result = await service.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.latency).toBeUndefined();
      expect(result.quality).toBeUndefined();
    });
  });

  describe('connection status subscription', () => {
    it('notifies subscribers of status changes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      service.onConnectionStateChange(callback1);
      service.onConnectionStateChange(callback2);
      
      // Start connection to trigger status change
      service.connectToDevice(mockDevice);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      
      const calledStatus = callback1.mock.calls[0][0];
      expect(calledStatus.state).toBe('connecting');
    });

    it('allows unsubscribing from status changes', () => {
      const callback = vi.fn();
      
      const unsubscribe = service.onConnectionStateChange(callback);
      
      // Trigger status change
      service.connectToDevice(mockDevice);
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Unsubscribe and trigger another change
      unsubscribe();
      service.cancelConnection();
      
      // Should not be called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      service.onConnectionStateChange(errorCallback);
      service.onConnectionStateChange(normalCallback);
      
      // Should not throw despite callback error
      expect(() => {
        service.connectToDevice(mockDevice);
      }).not.toThrow();
      
      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('correctly identifies connected device', async () => {
      // Connect to device
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const connectPromise = service.connectToDevice(mockDevice);
      await vi.advanceTimersByTimeAsync(10000);
      await connectPromise;
      
      expect(service.isConnectedToDevice('device-123')).toBe(true);
      expect(service.isConnectedToDevice('other-device')).toBe(false);
      expect(service.getConnectedDeviceId()).toBe('device-123');
    });

    it('provides accurate connection stats', async () => {
      // Connect to device
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const connectPromise = service.connectToDevice(mockDevice);
      await vi.advanceTimersByTimeAsync(10000);
      await connectPromise;
      
      // Advance time to test duration
      await vi.advanceTimersByTimeAsync(5000);
      
      const stats = service.getConnectionStats();
      expect(stats.isConnected).toBe(true);
      expect(stats.deviceId).toBe('device-123');
      expect(stats.connectedAt).toBeInstanceOf(Date);
      expect(stats.duration).toBeGreaterThan(0);
    });

    it('returns correct stats when not connected', () => {
      const stats = service.getConnectionStats();
      expect(stats.isConnected).toBe(false);
      expect(stats.deviceId).toBeUndefined();
      expect(stats.connectedAt).toBeUndefined();
      expect(stats.duration).toBeUndefined();
    });
  });

  describe('connection timing', () => {
    it('measures connection time accurately', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const connectPromise = service.connectToDevice(mockDevice);
      
      // Advance by known amount
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await connectPromise;
      
      expect(result.connectionTime).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it('measures connection time on failure', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.01); // Force failure

      const connectPromise = service.connectToDevice(mockDevice);
      
      await vi.advanceTimersByTimeAsync(10000);
      
      const result = await connectPromise;
      
      expect(result.success).toBe(false);
      expect(result.connectionTime).toBeGreaterThan(0);
    });
  });
});