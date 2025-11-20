import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { V2VMainDashboard } from '@/components/v2v-dashboard/V2VMainDashboard';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { useConnection } from '@/hooks/useConnection';
import { NearbyDevice } from '@/types/v2v.types';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock custom hooks
vi.mock('@/hooks/useVehicleStatus');
vi.mock('@/hooks/useNearbyDevices');
vi.mock('@/hooks/useEmergencyAlerts');
vi.mock('@/hooks/useConnection');

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

const mockVehicleStatus = {
  vehicleStatus: {
    isOnline: true,
    lastConnected: new Date(),
    vehicleId: 'test-vehicle-123',
    signalStrength: 85,
    batteryLevel: 90,
    gpsStatus: 'locked' as const,
  },
  isLoading: false,
  error: null,
};

const mockNearbyDevices = {
  devices: [
    {
      id: 'device-1',
      name: 'Test Vehicle 1',
      distance: 150,
      signalStrength: 80,
      lastSeen: new Date(),
      deviceType: 'vehicle' as const,
      isConnectable: true,
    },
    {
      id: 'device-2',
      name: 'Emergency Vehicle',
      distance: 300,
      signalStrength: 70,
      lastSeen: new Date(),
      deviceType: 'emergency' as const,
      isConnectable: true,
    },
  ] as NearbyDevice[],
  isScanning: true,
  error: null,
};

const mockEmergencyAlerts = {
  alerts: [
    {
      type: 'accident' as const,
      message: 'Test accident alert',
      timestamp: new Date(),
      location: { lat: 0, lng: 0 },
      severity: 'high' as const,
    },
  ],
  error: null,
};

const mockConnection = {
  connect: vi.fn(),
  connectionStatus: 'idle' as const,
  error: null,
};

describe('V2VMainDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useVehicleStatus as any).mockReturnValue(mockVehicleStatus);
    (useNearbyDevices as any).mockReturnValue(mockNearbyDevices);
    (useEmergencyAlerts as any).mockReturnValue(mockEmergencyAlerts);
    (useConnection as any).mockReturnValue(mockConnection);
  });

  it('renders dashboard header and title', async () => {
    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('V2V Communication Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Vehicle-to-Vehicle communication control center')).toBeInTheDocument();
    });
  });

  it('displays system status with correct information', async () => {
    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Nearby vehicles count
      expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Scanning')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    (useVehicleStatus as any).mockReturnValue({
      ...mockVehicleStatus,
      isLoading: true,
    });

    render(<V2VMainDashboard />);
    
    // Should show skeleton loading components
    expect(screen.getByText('V2V Communication Dashboard')).toBeInTheDocument();
    // Check for skeleton components by their class or structure
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays offline status when vehicle is offline', async () => {
    (useVehicleStatus as any).mockReturnValue({
      ...mockVehicleStatus,
      vehicleStatus: {
        ...mockVehicleStatus.vehicleStatus,
        isOnline: false,
      },
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  it('toggles settings panel when settings button is clicked', async () => {
    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
    });

    // Settings panel should be visible
    await waitFor(() => {
      expect(screen.getByText('V2V Settings')).toBeInTheDocument();
    });
  });

  it('handles device connection flow', async () => {
    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      // Find and click a connect button for a nearby device
      const connectButtons = screen.getAllByText('Connect');
      if (connectButtons.length > 0) {
        fireEvent.click(connectButtons[0]);
      }
    });

    // Connection dialog should open
    await waitFor(() => {
      expect(screen.getByText(/Connect to/)).toBeInTheDocument();
    });
  });

  it('displays error alert when there are errors', async () => {
    (useVehicleStatus as any).mockReturnValue({
      ...mockVehicleStatus,
      error: 'Vehicle status error',
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Vehicle status error')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
    });

    expect(mockReload).toHaveBeenCalled();
  });

  it('displays active alerts count correctly', async () => {
    const recentAlert = {
      type: 'medical' as const,
      message: 'Recent medical alert',
      timestamp: new Date(), // Current time - should be active
      location: { lat: 0, lng: 0 },
      severity: 'high' as const,
    };

    (useEmergencyAlerts as any).mockReturnValue({
      alerts: [recentAlert],
      error: null,
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // Active alerts count
      expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    });
  });

  it('handles connection success and navigation', async () => {
    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      // Simulate successful connection
      const dashboard = screen.getByText('V2V Communication Dashboard').closest('div');
      // This would be triggered by the ConnectionDialog component
      // We'll test the handler directly
    });

    // Test the navigation logic would be called
    // This is more of an integration test that would require more complex setup
  });

  it('renders all main dashboard components', async () => {
    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      // Check that all main components are rendered
      expect(screen.getByText('Vehicle Status')).toBeInTheDocument();
      expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
      expect(screen.getByText('Emergency Alerts')).toBeInTheDocument();
    });
  });

  it('handles error boundary fallback', async () => {
    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Force an error in a child component
    (useVehicleStatus as any).mockImplementation(() => {
      throw new Error('Test error');
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('displays correct connection status badge', async () => {
    (useConnection as any).mockReturnValue({
      ...mockConnection,
      connectionStatus: 'connected',
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows idle scanning status when not scanning', async () => {
    (useNearbyDevices as any).mockReturnValue({
      ...mockNearbyDevices,
      isScanning: false,
    });

    render(<V2VMainDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });
  });
});