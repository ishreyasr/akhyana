import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ConnectionDialog } from '../../components/v2v-dashboard/ConnectionDialog';
import { NearbyDevice } from '../../types/v2v.types';

// Mock the toast hook
vi.mock('../../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const mockDevice: NearbyDevice = {
  id: 'device-123',
  name: 'Test Vehicle',
  distance: 150,
  signalStrength: 85,
  lastSeen: new Date(),
  deviceType: 'vehicle',
  isConnectable: true
};

const mockEmergencyDevice: NearbyDevice = {
  id: 'emergency-456',
  name: 'Emergency Vehicle Alpha',
  distance: 200,
  signalStrength: 92,
  lastSeen: new Date(),
  deviceType: 'emergency',
  isConnectable: true
};

const mockUnavailableDevice: NearbyDevice = {
  id: 'device-789',
  name: 'Busy Vehicle',
  distance: 100,
  signalStrength: 75,
  lastSeen: new Date(),
  deviceType: 'vehicle',
  isConnectable: false
};

describe('ConnectionDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConnectionSuccess = vi.fn();
  const mockOnConnectionError = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    device: mockDevice,
    onConnectionSuccess: mockOnConnectionSuccess,
    onConnectionError: mockOnConnectionError
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders device information correctly', () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    expect(screen.getByText('Connect to Test Vehicle')).toBeInTheDocument();
    expect(screen.getByText('device-123')).toBeInTheDocument();
    expect(screen.getByText('150m')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('vehicle')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('renders emergency device with correct styling', () => {
    render(<ConnectionDialog {...defaultProps} device={mockEmergencyDevice} />);
    
    expect(screen.getByText('Connect to Emergency Vehicle Alpha')).toBeInTheDocument();
    expect(screen.getByText('emergency')).toBeInTheDocument();
    // Emergency badge should have destructive variant
    const emergencyBadge = screen.getByText('emergency');
    expect(emergencyBadge.closest('.badge')).toHaveClass('badge-destructive');
  });

  it('shows unavailable status for non-connectable devices', () => {
    render(<ConnectionDialog {...defaultProps} device={mockUnavailableDevice} />);
    
    expect(screen.getByText('Busy')).toBeInTheDocument();
    
    const connectButton = screen.getByText('Connect');
    expect(connectButton).toBeDisabled();
  });

  it('displays correct signal strength indicators', () => {
    // Test strong signal (>= 60%)
    render(<ConnectionDialog {...defaultProps} />);
    expect(screen.getByTestId('wifi-icon')).toBeInTheDocument();
    
    // Test weak signal (< 60%)
    const weakSignalDevice = { ...mockDevice, signalStrength: 45 };
    render(<ConnectionDialog {...defaultProps} device={weakSignalDevice} />);
    expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
  });

  it('starts connection process when connect button is clicked', async () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Should show connection progress
    expect(screen.getByText('Connection Progress')).toBeInTheDocument();
    expect(screen.getByText('Device Discovery')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows connection steps during connection process', async () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // All connection steps should be visible
    expect(screen.getByText('Device Discovery')).toBeInTheDocument();
    expect(screen.getByText('Initial Handshake')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Channel Setup')).toBeInTheDocument();
    expect(screen.getByText('Connection Test')).toBeInTheDocument();
  });

  it('updates progress during connection', async () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Progress bar should be visible
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    
    // Initially should be at 0%
    expect(progressBar).toHaveAttribute('aria-valuenow', '0');
  });

  it('shows connection timer during connection', async () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Advance timer
    vi.advanceTimersByTime(3000);
    
    await waitFor(() => {
      expect(screen.getByText('3s')).toBeInTheDocument();
    });
  });

  it('handles successful connection', async () => {
    // Mock Math.random to avoid random failures
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Fast-forward through all connection steps
    vi.advanceTimersByTime(10000);
    
    await waitFor(() => {
      expect(screen.getByText(/Successfully connected/)).toBeInTheDocument();
    });
    
    // Should call success callback after delay
    vi.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(mockOnConnectionSuccess).toHaveBeenCalledWith('device-123');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles connection failure', async () => {
    // Mock Math.random to force failure
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // Will trigger failure
    
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Fast-forward to trigger failure
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed at/)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
    
    expect(mockOnConnectionError).toHaveBeenCalled();
  });

  it('allows canceling connection', () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows retrying failed connection', async () => {
    // Mock Math.random to force failure first, then success
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      return callCount <= 5 ? 0.05 : 0.5; // Fail first few calls, then succeed
    });
    
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Wait for failure
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
    
    // Click retry
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    
    // Should restart connection process
    expect(screen.getByText('Connection Progress')).toBeInTheDocument();
  });

  it('closes dialog when close button is clicked', () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not render when device is null', () => {
    render(<ConnectionDialog {...defaultProps} device={null} />);
    
    expect(screen.queryByText('Connect to')).not.toBeInTheDocument();
  });

  it('does not render when dialog is closed', () => {
    render(<ConnectionDialog {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Connect to Test Vehicle')).not.toBeInTheDocument();
  });

  it('resets state when dialog reopens', () => {
    const { rerender } = render(<ConnectionDialog {...defaultProps} isOpen={false} />);
    
    // Open dialog and start connection
    rerender(<ConnectionDialog {...defaultProps} isOpen={true} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Close and reopen dialog
    rerender(<ConnectionDialog {...defaultProps} isOpen={false} />);
    rerender(<ConnectionDialog {...defaultProps} isOpen={true} />);
    
    // Should be back to initial state
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.queryByText('Connection Progress')).not.toBeInTheDocument();
  });

  it('formats connection time correctly', async () => {
    render(<ConnectionDialog {...defaultProps} />);
    
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Test seconds only
    vi.advanceTimersByTime(45000);
    await waitFor(() => {
      expect(screen.getByText('45s')).toBeInTheDocument();
    });
    
    // Test minutes and seconds
    vi.advanceTimersByTime(30000);
    await waitFor(() => {
      expect(screen.getByText('1m 15s')).toBeInTheDocument();
    });
  });

  it('shows correct device type icons', () => {
    // Test vehicle icon
    render(<ConnectionDialog {...defaultProps} />);
    expect(screen.getByTestId('car-icon')).toBeInTheDocument();
    
    // Test emergency icon
    render(<ConnectionDialog {...defaultProps} device={mockEmergencyDevice} />);
    expect(screen.getByTestId('truck-icon')).toBeInTheDocument();
    
    // Test infrastructure icon
    const infrastructureDevice = { ...mockDevice, deviceType: 'infrastructure' as const };
    render(<ConnectionDialog {...defaultProps} device={infrastructureDevice} />);
    expect(screen.getByTestId('building-icon')).toBeInTheDocument();
  });
});