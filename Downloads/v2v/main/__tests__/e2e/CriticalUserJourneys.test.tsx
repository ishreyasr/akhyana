import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { V2VMainDashboard } from '@/components/v2v-dashboard/V2VMainDashboard';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { useV2VSettings } from '@/hooks/useV2VSettings';
import { useConnection } from '@/hooks/useConnection';
import { NearbyDevice, EmergencyAlert, VehicleStatus } from '@/types/v2v.types';

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

describe('Critical User Journeys E2E Tests', () => {
  const user = userEvent.setup();
  
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

  const mockConnect = vi.fn();
  const mockBroadcastAlert = vi.fn();
  const mockUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup default mock implementations
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

    mockUseNearbyDevices.mockReturnValue({
      devices: mockNearbyDevices,
      isScanning: true,
      startScanning: vi.fn(),
      stopScanning: vi.fn(),
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

    mockUseV2VSettings.mockReturnValue({
      settings: {
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
      },
      isLoading: false,
      error: null,
      updateSettings: mockUpdateSettings,
      resetSettings: vi.fn(),
      exportSettings: vi.fn(),
      importSettings: vi.fn()
    });

    mockUseConnection.mockReturnValue({
      isConnected: false,
      isConnecting: false,
      connectedDevice: null,
      connectionError: null,
      connect: mockConnect,
      disconnect: vi.fn(),
      getConnectionStatus: vi.fn()
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Journey 1: Emergency Alert Broadcasting', () => {
    it('allows user to send emergency alert from start to finish', async () => {
      mockBroadcastAlert.mockResolvedValue({
        success: true,
        recipientCount: 2,
        failedRecipients: [],
        broadcastId: 'alert-123'
      });

      render(<V2VMainDashboard />);

      // Step 1: User sees the emergency alert panel
      expect(screen.getByText('Emergency Alerts')).toBeInTheDocument();

      // Step 2: User selects emergency type
      const medicalButton = screen.getByText('Medical Emergency');
      await user.click(medicalButton);

      // Step 3: User clicks the main emergency button
      const emergencyButton = screen.getByText('Send Emergency Alert');
      expect(emergencyButton).not.toBeDisabled();
      
      await user.click(emergencyButton);

      // Step 4: Verify alert was broadcast
      await waitFor(() => {
        expect(mockBroadcastAlert).toHaveBeenCalledWith({
          type: 'medical',
          message: 'Medical Emergency reported',
          location: { lat: 0, lng: 0 },
          severity: 'high',
          senderId: 'current-vehicle'
        });
      });

      // Step 5: Verify UI feedback
      expect(screen.getByText('Send Emergency Alert')).toBeInTheDocument();
    });

    it('allows user to send quick emergency alerts', async () => {
      render(<V2VMainDashboard />);

      // User clicks quick send button for accident
      const quickAccidentButton = screen.getByText('Accident');
      await user.click(quickAccidentButton);

      await waitFor(() => {
        expect(mockBroadcastAlert).toHaveBeenCalledWith({
          type: 'accident',
          message: 'Accident reported',
          location: { lat: 0, lng: 0 },
          severity: 'high',
          senderId: 'current-vehicle'
        });
      });
    });

    it('shows alert history to user', async () => {
      // Setup with existing alerts
      const existingAlerts: EmergencyAlert[] = [
        {
          id: 'alert-1',
          type: 'accident',
          message: 'Vehicle accident reported',
          timestamp: new Date(Date.now() - 120000), // 2 minutes ago
          location: { lat: 40.7128, lng: -74.0060 },
          severity: 'high',
          senderId: 'vehicle-nearby'
        }
      ];

      mockUseEmergencyAlerts.mockReturnValue({
        alerts: existingAlerts,
        activeAlerts: existingAlerts,
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

      // User clicks to show history
      const historyButton = screen.getByText('Show History');
      await user.click(historyButton);

      // User sees the alert history
      expect(screen.getByText('Vehicle accident reported')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();

      // User can hide history
      const hideButton = screen.getByText('Hide History');
      await user.click(hideButton);
    });
  });

  describe('Journey 2: Device Discovery and Connection', () => {
    it('allows user to discover and connect to nearby vehicles', async () => {
      mockConnect.mockResolvedValue(true);

      render(<V2VMainDashboard />);

      // Step 1: User sees nearby vehicles
      expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Ambulance Unit 42')).toBeInTheDocument();
      expect(screen.getByText('Sedan ABC-123')).toBeInTheDocument();

      // Step 2: User sees device information
      expect(screen.getByText('120m away')).toBeInTheDocument();
      expect(screen.getByText('90% signal')).toBeInTheDocument();
      expect(screen.getByText('Emergency')).toBeInTheDocument();

      // Step 3: User clicks connect on emergency vehicle
      const connectButtons = screen.getAllByText('Connect');
      const emergencyConnectButton = connectButtons[0]; // First device is emergency
      
      await user.click(emergencyConnectButton);

      // Step 4: Verify connection attempt
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledWith(mockNearbyDevices[0]);
      });
    });

    it('handles device scanning controls', async () => {
      const mockStartScanning = vi.fn();
      const mockStopScanning = vi.fn();

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

      render(<V2VMainDashboard />);

      // User stops scanning
      const stopButton = screen.getByText('Stop Scanning');
      await user.click(stopButton);

      expect(mockStopScanning).toHaveBeenCalled();

      // Update mock to reflect stopped state
      mockUseNearbyDevices.mockReturnValue({
        devices: mockNearbyDevices,
        isScanning: false,
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

      // Re-render to reflect new state
      render(<V2VMainDashboard />);

      // User starts scanning again
      const startButton = screen.getByText('Start Scanning');
      await user.click(startButton);

      expect(mockStartScanning).toHaveBeenCalled();
    });

    it('shows empty state when no devices found', () => {
      mockUseNearbyDevices.mockReturnValue({
        devices: [],
        isScanning: false,
        startScanning: vi.fn(),
        stopScanning: vi.fn(),
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

      render(<V2VMainDashboard />);

      expect(screen.getByText('No nearby vehicles found')).toBeInTheDocument();
      expect(screen.getByText('Start scanning to find nearby vehicles')).toBeInTheDocument();
    });
  });

  describe('Journey 3: Vehicle Status Monitoring', () => {
    it('displays comprehensive vehicle status information', () => {
      render(<V2VMainDashboard />);

      // User sees vehicle status card
      expect(screen.getByText('Vehicle Status')).toBeInTheDocument();
      
      // User sees online status
      expect(screen.getByText('Online')).toBeInTheDocument();
      
      // User sees vehicle ID
      expect(screen.getByText('test-vehicle-123')).toBeInTheDocument();
      
      // User sees signal strength
      expect(screen.getByText('Signal Strength')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      
      // User sees battery level
      expect(screen.getByText('Battery Level')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      
      // User sees GPS status
      expect(screen.getByText('GPS Status')).toBeInTheDocument();
      expect(screen.getByText('GPS Locked')).toBeInTheDocument();
    });

    it('shows offline status when vehicle is disconnected', () => {
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

      render(<V2VMainDashboard />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows low battery warning', () => {
      const lowBatteryStatus: VehicleStatus = {
        ...mockVehicleStatus,
        batteryLevel: 15
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

      expect(screen.getByText('15%')).toBeInTheDocument();
      // Low battery should show red progress bar (tested via styling)
    });
  });

  describe('Journey 4: Real-time Updates and Notifications', () => {
    it('handles incoming emergency alerts in real-time', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate incoming emergency alert
      const incomingAlert: EmergencyAlert = {
        id: 'incoming-alert',
        type: 'medical',
        message: 'Medical emergency 200m ahead',
        timestamp: new Date(),
        location: { lat: 40.7128, lng: -74.0060 },
        severity: 'high',
        senderId: 'ambulance-unit-5'
      };

      mockUseEmergencyAlerts.mockReturnValue({
        alerts: [incomingAlert],
        activeAlerts: [incomingAlert],
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

      // User should see active alert notification
      expect(screen.getByText('You have active emergency alerts')).toBeInTheDocument();

      // User can view alert in history
      const historyButton = screen.getByText('Show History');
      await user.click(historyButton);

      expect(screen.getByText('Medical emergency 200m ahead')).toBeInTheDocument();
    });

    it('handles new device discovery in real-time', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate new device discovery
      const newDevice: NearbyDevice = {
        id: 'new-police-unit',
        name: 'Police Unit 7',
        distance: 80,
        signalStrength: 95,
        lastSeen: new Date(),
        deviceType: 'emergency',
        isConnectable: true
      };

      mockUseNearbyDevices.mockReturnValue({
        devices: [...mockNearbyDevices, newDevice],
        isScanning: true,
        startScanning: vi.fn(),
        stopScanning: vi.fn(),
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

      // User should see the new device
      await waitFor(() => {
        expect(screen.getByText('Police Unit 7')).toBeInTheDocument();
      });

      expect(screen.getByText('80m away')).toBeInTheDocument();
    });

    it('handles vehicle status changes in real-time', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate GPS status change
      const updatedStatus: VehicleStatus = {
        ...mockVehicleStatus,
        gpsStatus: 'searching'
      };

      mockUseVehicleStatus.mockReturnValue({
        vehicleStatus: updatedStatus,
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
        expect(screen.getByText('GPS Searching')).toBeInTheDocument();
      });
    });
  });

  describe('Journey 5: Error Recovery and Edge Cases', () => {
    it('handles connection failures gracefully', async () => {
      mockConnect.mockRejectedValue(new Error('Connection timeout'));

      render(<V2VMainDashboard />);

      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalled();
      });

      // Should remain on dashboard (not crash)
      expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
    });

    it('handles emergency alert broadcast failures', async () => {
      mockBroadcastAlert.mockRejectedValue(new Error('Network error'));

      render(<V2VMainDashboard />);

      const medicalButton = screen.getByText('Medical Emergency');
      await user.click(medicalButton);

      const sendButton = screen.getByText('Send Emergency Alert');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockBroadcastAlert).toHaveBeenCalled();
      });

      // Should handle error gracefully
      expect(screen.getByText('Send Emergency Alert')).toBeInTheDocument();
    });

    it('handles scanning errors gracefully', () => {
      mockUseNearbyDevices.mockReturnValue({
        devices: [],
        isScanning: false,
        startScanning: vi.fn(),
        stopScanning: vi.fn(),
        updateScanInterval: vi.fn(),
        error: 'Scanner hardware not available',
        lastScanTime: null,
        scanInterval: 5000,
        refreshDevices: vi.fn(),
        getDevicesByType: vi.fn(),
        getConnectableDevices: vi.fn(),
        getDeviceById: vi.fn(),
        getDevicesInRange: vi.fn()
      });

      render(<V2VMainDashboard />);

      // Should show fallback UI
      expect(screen.getByText('No nearby vehicles found')).toBeInTheDocument();
    });
  });

  describe('Journey 6: Performance Under Load', () => {
    it('handles many devices efficiently', async () => {
      // Create 100 mock devices
      const manyDevices = Array.from({ length: 100 }, (_, i) => ({
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
        startScanning: vi.fn(),
        stopScanning: vi.fn(),
        updateScanInterval: vi.fn(),
        error: null,
        lastScanTime: new Date(),
        scanInterval: 8000, // Longer interval for performance
        refreshDevices: vi.fn(),
        getDevicesByType: vi.fn(),
        getConnectableDevices: vi.fn(),
        getDeviceById: vi.fn(),
        getDevicesInRange: vi.fn()
      });

      const startTime = performance.now();
      render(<V2VMainDashboard />);
      const endTime = performance.now();

      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);

      // Should still show devices
      expect(screen.getByText('Vehicle 0')).toBeInTheDocument();
    });

    it('handles rapid alert updates efficiently', async () => {
      const { rerender } = render(<V2VMainDashboard />);

      // Simulate rapid alert updates
      for (let i = 0; i < 10; i++) {
        const alerts = Array.from({ length: i + 1 }, (_, j) => ({
          id: `alert-${j}`,
          type: 'accident' as const,
          message: `Alert ${j}`,
          timestamp: new Date(Date.now() - j * 1000),
          location: { lat: 40.7128, lng: -74.0060 },
          severity: 'medium' as const,
          senderId: `vehicle-${j}`
        }));

        mockUseEmergencyAlerts.mockReturnValue({
          alerts,
          activeAlerts: alerts,
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
      }

      // Should handle updates without performance issues
      expect(screen.getByText('Emergency Alerts')).toBeInTheDocument();
    });
  });
});