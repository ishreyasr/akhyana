// Unit tests for useVehicleStatus hook

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVehicleStatus } from '../../hooks/useVehicleStatus';
import { webSocketService } from '../../utils/websocketService';

// Mock WebSocket service
vi.mock('../../utils/websocketService', () => ({
  webSocketService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    broadcastStatusUpdate: vi.fn()
  }
}));

const mockWebSocketService = webSocketService as any;

describe('useVehicleStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useVehicleStatus());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.vehicleStatus.isOnline).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should load initial vehicle status', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Fast-forward through the initialization delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Wait for the promise to resolve
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.vehicleStatus.isOnline).toBe(true);
    expect(result.current.vehicleStatus.signalStrength).toBe(75);
    expect(result.current.vehicleStatus.gpsStatus).toBe('locked');
  });

  it('should set up WebSocket subscription', () => {
    renderHook(() => useVehicleStatus());

    expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
      'status_update',
      expect.any(Function)
    );
  });

  it('should update online status', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.setOnlineStatus(false);
    });

    expect(result.current.vehicleStatus.isOnline).toBe(false);
    expect(result.current.vehicleStatus.signalStrength).toBe(0);
    expect(mockWebSocketService.broadcastStatusUpdate).toHaveBeenCalled();
  });

  it('should update signal strength', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateSignalStrength(90);
    });

    expect(result.current.vehicleStatus.signalStrength).toBe(90);
    expect(mockWebSocketService.broadcastStatusUpdate).toHaveBeenCalled();
  });

  it('should clamp signal strength to valid range', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateSignalStrength(150); // Above max
    });

    expect(result.current.vehicleStatus.signalStrength).toBe(100);

    act(() => {
      result.current.updateSignalStrength(-10); // Below min
    });

    expect(result.current.vehicleStatus.signalStrength).toBe(0);
  });

  it('should update GPS status', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateGpsStatus('searching');
    });

    expect(result.current.vehicleStatus.gpsStatus).toBe('searching');
    expect(mockWebSocketService.broadcastStatusUpdate).toHaveBeenCalled();
  });

  it('should update battery level', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateBatteryLevel(60);
    });

    expect(result.current.vehicleStatus.batteryLevel).toBe(60);
    expect(mockWebSocketService.broadcastStatusUpdate).toHaveBeenCalled();
  });

  it('should clamp battery level to valid range', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateBatteryLevel(150); // Above max
    });

    expect(result.current.vehicleStatus.batteryLevel).toBe(100);

    act(() => {
      result.current.updateBatteryLevel(-10); // Below min
    });

    expect(result.current.vehicleStatus.batteryLevel).toBe(0);
  });

  it('should refresh status', async () => {
    const { result } = renderHook(() => useVehicleStatus());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const initialTimestamp = result.current.vehicleStatus.lastConnected;

    act(() => {
      result.current.refreshStatus();
    });

    expect(result.current.isLoading).toBe(true);

    // Fast-forward through refresh delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.vehicleStatus.lastConnected.getTime()).toBeGreaterThan(
      initialTimestamp.getTime()
    );
  });

  it('should cleanup WebSocket subscription on unmount', () => {
    const { unmount } = renderHook(() => useVehicleStatus());

    unmount();

    expect(mockWebSocketService.unsubscribe).toHaveBeenCalledWith(
      'status_update',
      expect.any(Function)
    );
  });
});