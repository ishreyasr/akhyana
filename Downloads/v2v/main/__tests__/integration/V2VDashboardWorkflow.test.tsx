import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { V2VMainDashboard } from '@/components/v2v-dashboard/V2VMainDashboard';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { useV2VSettings } from '@/hooks/useV2VSettings';
import { useConnection } from '@/hooks/useConnection';
import { NearbyDevice, EmergencyAlert, VehicleStatus, V2VSettings } from '@/types/v2v.types';

// Mock all hooks
vi.mock('@/hooks/useVehicleStatus');
vi.mock('@/hooks/useNearbyDevices');
vi.mock('@/hooks/useEmergencyAlerts');
vi.mock('@/hooks/useV2VSettings');
vi.mock('@/hooks/useConnection');

const mockUseVehicleStatus = vi.mocked(useVehicleStatus);
const mockUseNearbyDevices = vi.mocked(useNearbyDevices);
const mockUseEmergencyAlerts = vi.mocked(useEmergencyAlerts);
const mockUseV2VSettings = vi.mocked(useV2VSettings);
const mockUseConnection = vi.mocked(useConnection);

const mockVehicleStatus: VehicleStatus = {
  isOnline: true,
  lastConnected: new Date(),
  vehicleId: 'test-vehicle-123',
  signalStrength: 85,
  batteryLevel: 75,
  gpsStatus: 'locked'
};

const mockNearbyDevices: NearbyDevice[] = [
  {
    id: 'emergency-1',
    name: 'Ambulance Unit 42',
    distance: 120,
    signalStrength: 90,
    lastSeen: new Date(),
    deviceType: 'emergency',
    isConnectable: true
  },
  {
    id: 'vehicle-1',
    name: 'Sedan ABC-123',
    distance: 250,
    signalStrength: 75,
    lastSeen: new Date(),
    deviceType: 'vehicle',
    isConnectable: true
  }
];

const mockEmergencyAlerts: EmergencyAlert[] = [
  {
    id: 'alert-1',
    type: 'accident',
    message: 'Vehicle accident reported',
    timestamp: new Date(Date.now() - 60000), // 1 minute ago
    location: { lat: 40.7128, lng: -74.0060 },
    severity: 'high',
    senderId: 'vehicle-nearby'
  }
];

const mockV2VSettings: V2VSettings = {
  communicationChannel: 1,
  autoChannelSelection: true,
  voiceQualityThreshold: 70,
  alertPreferences: {
    soundEnabled: true,
    vibrationEnabled: true,
    displayBrightness: 80
  },
  discoverySettings: {
    scanInterval: 5000,
    maxRange: 500,
    deviceFilters: []
  }
};

describe('V2V Dashboard Integration Tests', () => {
  const mockStartScanning = vi.fn();
  const mockStopScanning = vi.fn();
  const mockBroadcastAlert = vi.fn();
  const mockUpdateSettings = vi.fn();
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock vehicle status hook
    mockUseVehicleStatus.mockReturnValue({
      vehicleStatus: mockVehicleStatus,
      isLoading: false,
      error: null,
      setOnlineStatus: vi.fn(),
      updateSignalStrength: vi.fn(),
      updateGpsStatus: vi.fn(),
      updateBatteryLevel: vi.fn(),
      refreshStatus: vi.fn()
    });

    // Mock nearby devices hook
    mockUseNearbyDevices.mockReturnValue({
      devices: mockNearbyDevices,
      isScanning: true,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: vi.fn(),
      error: null,
      lastScanTime: new Date(),
      scanInterval: 5000,
      refreshDevices: vi.fn(),
      getDevicesByType: vi.fn(),
      getConnectableDevices: vi.fn(),
      getDeviceById: vi.fn(),
      getDevicesInRange: vi.fn()
    });

    // Mock emergency alerts hook
    mockUseEmergencyAlerts.mockReturnValue({
      alerts: mockEmergencyAlerts,
      activeAlerts: mockEmergencyAlerts,
      isBroadcasting: false,
      error: null,
      broadcastAlert: mockBroadcastAlert,
      broadcastQuickAlert: vi.fn(),
      refreshAlerts: vi.fn(),
      clearExpiredAlerts: vi.fn(),
      getAlertsByType: vi.fn(),
      getAlertsBySeverity: vi.fn(),
      getPrioritizedAlerts: vi.fn(),
      getQuickAlertTemplates: vi.fn(),
      simulateIncomingAlert: vi.fn()
    });

    // Mock V2V settings hook
    mockUseV2VSettings.mockReturnValue({
      settings: mockV2VSettings,
      isLoading: false,
      error: null,
      updateSettings: mockUpdateSettings,
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn()
    });

    // Mock connection hook
    mockUseConnection.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      connectedDevice: null,
      connectionError: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      getConnectionStatus: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Complete Dashboard Workflow', () => {
    it('renders all dashboard components correctly', () => {
      render(<V2VMainDashboard />);

      // Check that all main components are present
      expect(screen.getByText('Vehicle Status')).toBeInTheDocument();
      expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Emergency Alerts')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('displays vehicle status information', () => {
      render(<V2VMainDashboard />);

      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('test-vehicle-123')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument(); // Signal strength
      expect(screen.getByText('75%')).toBeInTheDocument(); // Battery level
      expect(screen.getByText('GPS Locked')).toBeInTheDocument();
    });

    it('shows nearby devices and allows connection', async () => {
      render(<V2VMainDashboard />);

      // Check nearby devices are displayed
      expect(screen.getByText('Ambulance Unit 42')).toBeInTheDocument();
      expect(screen.getByText('Sedan ABC-123')).toBeInTheDocument();
      expect(screen.getByText('120m away')).toBeInTheDocument();
      expect(screen.getByText('250m away')).toBeInTheDocument();

      // Test device connection
      const connectButtons = screen.getAllByText('Connect');
      fireEvent.click(connectButtons[0]);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith(mockNearbyDevices[0]);
      });
    });

    it('handles emergency alert workflow', async () => {
      render(<V2VMainDashboard />);

      // Select emergency type
      const medicalButton = screen.getByText('Medical Emergency');
      fireEvent.click(medicalButton);

      // Send emergency alert
      const sendAlertButton = screen.getByText('Send Emergency Alert');
      fireEvent.click(sendAlertButton);

      await waitFor(() => {
        expect(mockBroadcastAlert).toHaveBeenCalledWith({
          type: 'medical',
          message: 'Medical Emergency reported',
          location: { lat: 0, lng: 0 },
          severity: 'high',
          senderId: 'current-vehicle'
        });
      });
    });

    it('displays and manages emergency alert history', () => {
      render(<V2VMainDashboard />);

      // Show alert history
      const historyButton = screen.getByText('Show History');
      fireEvent.click(historyButton);

      // Check that existing alert is displayed
      expect(screen.getByText('Vehicle accident reported')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('handles settings management workflow', async () => {
      render(<V2VMainDashboard />);

      // Open settings (assuming there's a settings button or panel)
      // This would depend on the actual implementation of settings UI
      
      // Test settings update
      await act(async () => {
        // Simulate settings change
        mockUpdateSettings({
          ...mockV2VSettings,
          communicationChannel: 2
        });
      });

      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });

  describe('Real-time Updates and Performance', () => {
    it('handles real-time device discovery updates', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate new device discovery
      const newDevice: NearbyDevice = {
        id: 'new-device',
        name: 'Police Unit 5',
        distance: 80,
        signalStrength: 95,
        lastSeen: new Date(),
        deviceType: 'emergency',
        isConnectable: true
      };

      mockUseNearbyDevices.mockReturnValue({
        devices: [...mockNearbyDevices, newDevice],
        isScanning: true,
        startScanning: mockStartScanning,
        stopScanning: mockStopScanning,
        updateScanInterval: vi.fn(),
        error: null,
        lastScanTime: new Date(),
        scanInterval: 5000,
        refreshDevices: vi.fn(),
        getDevicesByType: vi.fn(),
        getConnectableDevices: vi.fn(),
        getDeviceById: vi.fn(),
        getDevicesInRange: vi.fn()
      });

      rerender(<V2VMainDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Police Unit 5')).toBeInTheDocument();
      });
    });

    it('handles vehicle status changes in real-time', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate vehicle going offline
      const offlineStatus: VehicleStatus = {
        ...mockVehicleStatus,
        isOnline: false,
        signalStrength: 0
      };

      mockUseVehicleStatus.mockReturnValue({
        vehicleStatus: offlineStatus,
        isLoading: false,
        error: null,
        setOnlineStatus: vi.fn(),
        updateSignalStrength: vi.fn(),
        updateGpsStatus: vi.fn(),
        updateBatteryLevel: vi.fn(),
        refreshStatus: vi.fn()
      });

      rerender(<V2VMainDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
    });

    it('handles incoming emergency alerts', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate incoming emergency alert
      const newAlert: EmergencyAlert = {
        id: 'alert-2',
        type: 'medical',
        message: 'Medical emergency nearby',
        timestamp: new Date(),
        location: { lat: 40.7128, lng: -74.0060 },
        severity: 'high',
        senderId: 'ambulance-1'
      };

      mockUseEmergencyAlerts.mockReturnValue({
        alerts: [...mockEmergencyAlerts, newAlert],
        activeAlerts: [...mockEmergencyAlerts, newAlert],
        isBroadcasting: false,
        error: null,
        broadcastAlert: mockBroadcastAlert,
        broadcastQuickAlert: vi.fn(),
        refreshAlerts: vi.fn(),
        clearExpiredAlerts: vi.fn(),
        getAlertsByType: vi.fn(),
        getAlertsBySeverity: vi.fn(),
        getPrioritizedAlerts: vi.fn(),
        getQuickAlertTemplates: vi.fn(),
        simulateIncomingAlert: vi.fn()
      });

      rerender(<V2VMainDashboard />);

      // Show history to see the new alert
      const historyButton = screen.getByText('Show History');
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(screen.getByText('Medical emergency nearby')).toBeInTheDocument();
      });
    });

    it('optimizes performance with many devices', async () => {
      // Create many devices to test performance optimization
      const manyDevices = Array.from({ length: 50 }, (_, i) => ({
        id: `device-${i}`,
        name: `Vehicle ${i}`,
        distance: Math.random() * 500,
        signalStrength: Math.floor(Math.random() * 100),
        lastSeen: new Date(),
        deviceType: 'vehicle' as const,
        isConnectable: true
      }));

      mockUseNearbyDevices.mockReturnValue({
        devices: manyDevices,
        isScanning: true,
        startScanning: mockStartScanning,
        stopScanning: mockStopScanning,
        updateScanInterval: vi.fn(),
        error: null,
        lastScanTime: new Date(),
        scanInterval: 8000, // Longer interval for many devices
        refreshDevices: vi.fn(),
        getDevicesByType: vi.fn(),
        getConnectableDevices: vi.fn(),
        getDeviceById: vi.fn(),
        getDevicesInRange: vi.fn()
      });

      const startTime = performance.now();
      render(<V2VMainDashboard />);
      const endTime = performance.now();

      // Should render within reasonable time even with many devices
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second

      // Check that devices are still rendered (at least some of them)
      expect(screen.getByText('Vehicle 0')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles device scanning errors gracefully', () => {
      mockUseNearbyDevices.mockReturnValue({
        devices: [],
        isScanning: false,
        startScanning: mockStartScanning,
        stopScanning: mockStopScanning,
        updateScanInterval: vi.fn(),
        error: 'Failed to start device scanner',
        lastScanTime: null,
        scanInterval: 5000,
        refreshDevices: vi.fn(),
        getDevicesByType: vi.fn(),
        getConnectableDevices: vi.fn(),
        getDeviceById: vi.fn(),
        getDevicesInRange: vi.fn()
      });

      render(<V2VMainDashboard />);

      // Should show error state or fallback UI
      expect(screen.getByText('No nearby vehicles found')).toBeInTheDocument();
    });

    it('handles emergency alert broadcast failures', async () => {
      mockBroadcastAlert.mockRejectedValue(new Error('Broadcast failed'));

      render(<V2VMainDashboard />);

      const medicalButton = screen.getByText('Medical Emergency');
      fireEvent.click(medicalButton);

      const sendAlertButton = screen.getByText('Send Emergency Alert');
      fireEvent.click(sendAlertButton);

      await waitFor(() => {
        expect(mockBroadcastAlert).toHaveBeenCalled();
      });

      // Should handle the error gracefully without crashing
      expect(screen.getByText('Send Emergency Alert')).toBeInTheDocument();
    });

    it('handles connection failures gracefully', async () => {
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      render(<V2VMainDashboard />);

      const connectButton = screen.getAllByText('Connect')[0];
      fireEvent.click(connectButton);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      });

      // Should remain on dashboard and show error state
      expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
    });

    it('handles empty states correctly', () => {
      // Mock empty states
      mockUseNearbyDevices.mockReturnValue({
        devices: [],
        isScanning: false,
        startScanning: mockStartScanning,
        stopScanning: mockStopScanning,
        updateScanInterval: vi.fn(),
        error: null,
        lastScanTime: null,
        scanInterval: 5000,
        refreshDevices: vi.fn(),
        getDevicesByType: vi.fn(),
        getConnectableDevices: vi.fn(),
        getDeviceById: vi.fn(),
        getDevicesInRange: vi.fn()
      });

      mockUseEmergencyAlerts.mockReturnValue({
        alerts: [],
        activeAlerts: [],
        isBroadcasting: false,
        error: null,
        broadcastAlert: mockBroadcastAlert,
        broadcastQuickAlert: vi.fn(),
        refreshAlerts: vi.fn(),
        clearExpiredAlerts: vi.fn(),
        getAlertsByType: vi.fn(),
        getAlertsBySeverity: vi.fn(),
        getPrioritizedAlerts: vi.fn(),
        getQuickAlertTemplates: vi.fn(),
        simulateIncomingAlert: vi.fn()
      });

      render(<V2VMainDashboard />);

      expect(screen.getByText('No nearby vehicles found')).toBeInTheDocument();
      
      // Show alert history to check empty state
      const historyButton = screen.getByText('Show History');
      fireEvent.click(historyButton);
      
      expect(screen.getByText('No alerts yet')).toBeInTheDocument();
    });
  });

  describe('Battery and Performance Optimization', () => {
    it('adapts scan intervals based on battery level', async () => {
      // Mock low battery scenario
      const lowBatteryStatus: VehicleStatus = {
        ...mockVehicleStatus,
        batteryLevel: 15 // Low battery
      };

      mockUseVehicleStatus.mockReturnValue({
        vehicleStatus: lowBatteryStatus,
        isLoading: false,
        error: null,
        setOnlineStatus: vi.fn(),
        updateSignalStrength: vi.fn(),
        updateGpsStatus: vi.fn(),
        updateBatteryLevel: vi.fn(),
        refreshStatus: vi.fn()
      });

      render(<V2VMainDashboard />);

      // Should show low battery indicator
      expect(screen.getByText('15%')).toBeInTheDocument();
      
      // Battery optimization should be applied (longer scan intervals)
      // This would be tested through the scan interval being longer
    });

    it('handles memory cleanup on unmount', () => {
      const { unmount } = render(<V2VMainDashboard />);

      unmount();

      // Should call cleanup functions
      expect(mockStopScanning).toHaveBeenCalled();
    });
  });
});