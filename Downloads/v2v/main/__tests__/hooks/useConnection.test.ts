import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useConnection } from '../../hooks/useConnection';
import { connectionService } from '../../utils/connectionService';
import { NearbyDevice } from '../../types/v2v.types';

// Mock the connection service
vi.mock('../../utils/connectionService', () => ({
  connectionService: {
    onConnectionStateChange: vi.fn(),
    getConnectionStatus: vi.fn(),
    connectToDevice: vi.fn(),
    disconnect: vi.fn(),
    cancelConnection: vi.fn(),
    testConnection: vi.fn(),
    isConnectedToDevice: vi.fn(),
    getConnectionStats: vi.fn()
  }
}));

const mockConnectionService = vi.mocked(connectionService);

const mockDevice: NearbyDevice = {
  id: 'device-123',
  name: 'Test Vehicle',
  distance: 150,
  signalStrength: 85,
  lastSeen: new Date(),
  deviceType: 'vehicle',
  isConnectable: true
};

describe('useConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockConnectionService.getConnectionStatus.mockReturnValue({ state: 'idle' });
    mockConnectionService.onConnectionStateChange.mockReturnValue(() => {});
    mockConnectionService.connectToDevice.mockResolvedValue({ success: true, deviceId: 'device-123' });
    mockConnectionService.disconnect.mockResolvedValue(true);
    mockConnectionService.testConnection.mockResolvedValue({ success: true, latency: 100, quality: 85 });
    mockConnectionService.isConnectedToDevice.mockReturnValue(false);
    mockConnectionService.getConnectionStats.mockReturnValue({ isConnected: false });
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useConnection());
    
    expect(result.current.connectionStatus).toEqual({ state: 'idle' });
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.connectionError).toBe(null);
    expect(result.current.connectedDevice).toBe(null);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isIdle).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('subscribes to connection status changes on mount', () => {
    renderHook(() => useConnection());
    
    expect(mockConnectionService.onConnectionStateChange).toHaveBeenCalled();
    expect(mockConnectionService.getConnectionStatus).toHaveBeenCalled();
  });

  it('updates state when connection status changes', () => {
    let statusCallback: (status: any) => void = () => {};
    
    mockConnectionService.onConnectionStateChange.mockImplementation((callback) => {
      statusCallback = callback;
      return () => {};
    });
    
    const { result } = renderHook(() => useConnection());
    
    // Simulate connecting state
    act(() => {
      statusCallback({ state: 'connecting', deviceId: 'device-123' });
    });
    
    expect(result.current.connectionStatus).toEqual({ state: 'connecting', deviceId: 'device-123' });
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isIdle).toBe(false);
  });

  it('updates state when connection succeeds', () => {
    let statusCallback: (status: any) => void = () => {};
    
    mockConnectionService.onConnectionStateChange.mockImplementation((callback) => {
      statusCallback = callback;
      return () => {};
    });
    
    const { result } = renderHook(() => useConnection());
    
    // Simulate connected state
    act(() => {
      statusCallback({ state: 'connected', deviceId: 'device-123', connectedAt: new Date() });
    });
    
    expect(result.current.connectionStatus.state).toBe('connected');
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.connectionError).toBe(null);
  });

  it('updates state when connection fails', () => {
    let statusCallback: (status: any) => void = () => {};
    
    mockConnectionService.onConnectionStateChange.mockImplementation((callback) => {
      statusCallback = callback;
      return () => {};
    });
    
    const { result } = renderHook(() => useConnection());
    
    // Simulate error state
    act(() => {
      statusCallback({ state: 'error', deviceId: 'device-123', error: 'Connection failed' });
    });
    
    expect(result.current.connectionStatus.state).toBe('error');
    expect(result.current.hasError).toBe(true);
    expect(result.current.connectionError).toBe('Connection failed');
    expect(result.current.isConnecting).toBe(false);
  });

  describe('connectToDevice', () => {
    it('connects to device successfully', async () => {
      const { result } = renderHook(() => useConnection());
      
      let connectionResult;
      await act(async () => {
        connectionResult = await result.current.connectToDevice(mockDevice);
      });
      
      expect(mockConnectionService.connectToDevice).toHaveBeenCalledWith(mockDevice);
      expect(connectionResult).toEqual({ success: true, deviceId: 'device-123' });
      expect(result.current.connectedDevice).toBe(mockDevice);
    });

    it('handles connection failure', async () => {
      mockConnectionService.connectToDevice.mockResolvedValue({ 
        success: false, 
        error: 'Device not available' 
      });
      
      const { result } = renderHook(() => useConnection());
      
      let connectionResult;
      await act(async () => {
        connectionResult = await result.current.connectToDevice(mockDevice);
      });
      
      expect(connectionResult).toEqual({ success: false, error: 'Device not available' });
      expect(result.current.connectedDevice).toBe(null);
      expect(result.current.connectionError).toBe('Device not available');
    });

    it('handles connection service errors', async () => {
      mockConnectionService.connectToDevice.mockRejectedValue(new Error('Service error'));
      
      const { result } = renderHook(() => useConnection());
      
      let connectionResult;
      await act(async () => {
        connectionResult = await result.current.connectToDevice(mockDevice);
      });
      
      expect(connectionResult).toEqual({ success: false, error: 'Service error' });
      expect(result.current.connectionError).toBe('Service error');
    });
  });

  describe('disconnect', () => {
    it('disconnects successfully', async () => {
      const { result } = renderHook(() => useConnection());
      
      // Set connected device first
      act(() => {
        result.current.connectToDevice(mockDevice);
      });
      
      let disconnectResult;
      await act(async () => {
        disconnectResult = await result.current.disconnect();
      });
      
      expect(mockConnectionService.disconnect).toHaveBeenCalled();
      expect(disconnectResult).toBe(true);
      expect(result.current.connectedDevice).toBe(null);
      expect(result.current.connectionError).toBe(null);
    });

    it('handles disconnect failure', async () => {
      mockConnectionService.disconnect.mockResolvedValue(false);
      
      const { result } = renderHook(() => useConnection());
      
      let disconnectResult;
      await act(async () => {
        disconnectResult = await result.current.disconnect();
      });
      
      expect(disconnectResult).toBe(false);
    });
  });

  describe('cancelConnection', () => {
    it('cancels connection', () => {
      const { result } = renderHook(() => useConnection());
      
      act(() => {
        result.current.cancelConnection();
      });
      
      expect(mockConnectionService.cancelConnection).toHaveBeenCalled();
      expect(result.current.connectedDevice).toBe(null);
      expect(result.current.connectionError).toBe(null);
    });
  });

  describe('testConnection', () => {
    it('tests connection successfully', async () => {
      const { result } = renderHook(() => useConnection());
      
      let testResult;
      await act(async () => {
        testResult = await result.current.testConnection();
      });
      
      expect(mockConnectionService.testConnection).toHaveBeenCalled();
      expect(testResult).toEqual({ success: true, latency: 100, quality: 85 });
    });
  });

  describe('utility functions', () => {
    it('checks if connected to specific device', () => {
      mockConnectionService.isConnectedToDevice.mockReturnValue(true);
      
      const { result } = renderHook(() => useConnection());
      
      const isConnected = result.current.isConnectedToDevice('device-123');
      
      expect(mockConnectionService.isConnectedToDevice).toHaveBeenCalledWith('device-123');
      expect(isConnected).toBe(true);
    });

    it('gets connection stats', () => {
      const mockStats = { isConnected: true, deviceId: 'device-123', duration: 5000 };
      mockConnectionService.getConnectionStats.mockReturnValue(mockStats);
      
      const { result } = renderHook(() => useConnection());
      
      const stats = result.current.getConnectionStats();
      
      expect(mockConnectionService.getConnectionStats).toHaveBeenCalled();
      expect(stats).toBe(mockStats);
    });

    it('gets connected device info', () => {
      const mockStats = { isConnected: true, deviceId: 'device-123', duration: 5000 };
      mockConnectionService.getConnectionStats.mockReturnValue(mockStats);
      
      const { result } = renderHook(() => useConnection());
      
      // Set connected device
      act(() => {
        result.current.connectToDevice(mockDevice);
      });
      
      const deviceInfo = result.current.getConnectedDeviceInfo();
      
      expect(deviceInfo).toEqual({
        ...mockStats,
        device: mockDevice
      });
    });

    it('clears error', () => {
      let statusCallback: (status: any) => void = () => {};
      
      mockConnectionService.onConnectionStateChange.mockImplementation((callback) => {
        statusCallback = callback;
        return () => {};
      });
      
      const { result } = renderHook(() => useConnection());
      
      // Set error first by simulating error state
      act(() => {
        statusCallback({ state: 'error', error: 'Test error' });
      });
      
      expect(result.current.connectionError).toBe('Test error');
      
      act(() => {
        result.current.clearError();
      });
      
      expect(result.current.connectionError).toBe(null);
    });
  });

  it('unsubscribes from connection status changes on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockConnectionService.onConnectionStateChange.mockReturnValue(mockUnsubscribe);
    
    const { unmount } = renderHook(() => useConnection());
    
    unmount();
    
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});