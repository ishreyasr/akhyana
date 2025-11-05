import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  navigateToConnectedDashboard, 
  navigateToMainDashboard, 
  getConnectedDeviceId, 
  isOnConnectedDashboard, 
  handleConnectionSuccess 
} from '../../utils/navigation';

// Mock window and sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

const mockLocation = {
  href: '',
  pathname: '/'
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('Navigation Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    mockLocation.pathname = '/';
  });

  describe('navigateToConnectedDashboard', () => {
    it('stores device ID and navigates to dashboard', () => {
      navigateToConnectedDashboard('device-123');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('connectedDeviceId', 'device-123');
      expect(mockLocation.href).toBe('/dashboard');
    });
  });

  describe('navigateToMainDashboard', () => {
    it('clears session data and navigates to main dashboard', () => {
      navigateToMainDashboard();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('connectedDeviceId');
      expect(mockLocation.href).toBe('/');
    });
  });

  describe('getConnectedDeviceId', () => {
    it('returns device ID from session storage', () => {
      mockSessionStorage.getItem.mockReturnValue('device-456');
      
      const deviceId = getConnectedDeviceId();
      
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('connectedDeviceId');
      expect(deviceId).toBe('device-456');
    });

    it('returns null when no device ID stored', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      const deviceId = getConnectedDeviceId();
      
      expect(deviceId).toBe(null);
    });
  });

  describe('isOnConnectedDashboard', () => {
    it('returns true when on dashboard with connected device', () => {
      mockLocation.pathname = '/dashboard';
      mockSessionStorage.getItem.mockReturnValue('device-123');
      
      const isConnected = isOnConnectedDashboard();
      
      expect(isConnected).toBe(true);
    });

    it('returns false when not on dashboard', () => {
      mockLocation.pathname = '/';
      mockSessionStorage.getItem.mockReturnValue('device-123');
      
      const isConnected = isOnConnectedDashboard();
      
      expect(isConnected).toBe(false);
    });

    it('returns false when on dashboard but no connected device', () => {
      mockLocation.pathname = '/dashboard';
      mockSessionStorage.getItem.mockReturnValue(null);
      
      const isConnected = isOnConnectedDashboard();
      
      expect(isConnected).toBe(false);
    });
  });

  describe('handleConnectionSuccess', () => {
    it('stores connection info and navigates to dashboard', () => {
      const deviceId = 'device-789';
      const deviceName = 'Test Vehicle';
      
      handleConnectionSuccess(deviceId, deviceName);
      
      // Should store connection info
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'connectionInfo',
        expect.stringContaining(deviceId)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'connectionInfo',
        expect.stringContaining(deviceName)
      );
      
      // Should store device ID
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('connectedDeviceId', deviceId);
      
      // Should navigate to dashboard
      expect(mockLocation.href).toBe('/dashboard');
    });

    it('handles connection success without device name', () => {
      const deviceId = 'device-999';
      
      handleConnectionSuccess(deviceId);
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'connectionInfo',
        expect.stringContaining(`Device ${deviceId}`)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('connectedDeviceId', deviceId);
      expect(mockLocation.href).toBe('/dashboard');
    });

    it('stores connection timestamp', () => {
      const deviceId = 'device-time';
      const beforeTime = new Date().toISOString();
      
      handleConnectionSuccess(deviceId);
      
      const connectionInfoCall = mockSessionStorage.setItem.mock.calls.find(
        call => call[0] === 'connectionInfo'
      );
      
      expect(connectionInfoCall).toBeDefined();
      const connectionInfo = JSON.parse(connectionInfoCall[1]);
      expect(connectionInfo.connectedAt).toBeDefined();
      expect(new Date(connectionInfo.connectedAt).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
    });
  });

  describe('error handling', () => {
    it('handles missing window object gracefully', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      delete (global as any).window;
      
      expect(() => {
        navigateToConnectedDashboard('device-123');
        navigateToMainDashboard();
        getConnectedDeviceId();
        isOnConnectedDashboard();
        handleConnectionSuccess('device-123');
      }).not.toThrow();
      
      // Restore window
      global.window = originalWindow;
    });
  });
});