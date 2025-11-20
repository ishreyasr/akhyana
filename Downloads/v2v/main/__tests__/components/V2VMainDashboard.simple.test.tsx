import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { V2VMainDashboard } from '@/components/v2v-dashboard/V2VMainDashboard';

// Mock all the hooks with minimal implementations
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/hooks/useVehicleStatus', () => ({
  useVehicleStatus: () => ({
    vehicleStatus: {
      isOnline: true,
      lastConnected: new Date(),
      vehicleId: 'test-vehicle-123',
      signalStrength: 85,
      batteryLevel: 90,
      gpsStatus: 'locked',
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useNearbyDevices', () => ({
  useNearbyDevices: () => ({
    devices: [],
    isScanning: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useEmergencyAlerts', () => ({
  useEmergencyAlerts: () => ({
    alerts: [],
    error: null,
  }),
}));

vi.mock('@/hooks/useConnection', () => ({
  useConnection: () => ({
    connect: vi.fn(),
    connectionStatus: 'idle',
    error: null,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the child components to avoid complex rendering
vi.mock('@/components/v2v-dashboard/VehicleStatusCard', () => ({
  VehicleStatusCard: () => <div data-testid="vehicle-status-card">Vehicle Status</div>,
}));

vi.mock('@/components/v2v-dashboard/NearbyDevicesList', () => ({
  NearbyDevicesList: () => <div data-testid="nearby-devices-list">Nearby Devices</div>,
}));

vi.mock('@/components/v2v-dashboard/EmergencyAlertPanel', () => ({
  EmergencyAlertPanel: () => <div data-testid="emergency-alert-panel">Emergency Alerts</div>,
}));

vi.mock('@/components/v2v-dashboard/SettingsPanel', () => ({
  SettingsPanel: () => <div data-testid="settings-panel">Settings Panel</div>,
}));

vi.mock('@/components/v2v-dashboard/ConnectionDialog', () => ({
  ConnectionDialog: () => <div data-testid="connection-dialog">Connection Dialog</div>,
}));

describe('V2VMainDashboard', () => {
  it('renders the main dashboard structure', async () => {
    render(<V2VMainDashboard />);
    
    // Wait for the component to finish loading
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Check for main dashboard elements
    expect(screen.getByText('V2V Communication Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Vehicle-to-Vehicle communication control center')).toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('renders child components when not loading', async () => {
    render(<V2VMainDashboard />);
    
    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    // Check that child components are rendered
    expect(screen.getByTestId('vehicle-status-card')).toBeInTheDocument();
    expect(screen.getByTestId('nearby-devices-list')).toBeInTheDocument();
    expect(screen.getByTestId('emergency-alert-panel')).toBeInTheDocument();
  });

  it('has settings and refresh buttons', async () => {
    render(<V2VMainDashboard />);
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});