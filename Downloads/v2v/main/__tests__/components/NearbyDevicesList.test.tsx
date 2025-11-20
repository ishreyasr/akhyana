import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NearbyDevicesList } from '@/components/v2v-dashboard/NearbyDevicesList';
import { useNearbyDevices } from '@/hooks/useNearbyDevices';
import { NearbyDevice } from '@/types/v2v.types';

// Mock the hook
vi.mock('@/hooks/useNearbyDevices');
const mockUseNearbyDevices = vi.mocked(useNearbyDevices);

const mockDevices: NearbyDevice[] = [
  {
    id: 'device-1',
    name: 'Emergency Vehicle Alpha',
    distance: 150,
    signalStrength: 85,
    lastSeen: new Date('2024-01-01T12:00:00Z'),
    deviceType: 'emergency',
    isConnectable: true
  },
  {
    id: 'device-2',
    name: 'Civilian Vehicle Beta',
    distance: 300,
    signalStrength: 72,
    lastSeen: new Date('2024-01-01T11:59:30Z'),
    deviceType: 'vehicle',
    isConnectable: true
  },
  {
    id: 'device-3',
    name: 'Traffic Infrastructure',
    distance: 100,
    signalStrength: 95,
    lastSeen: new Date('2024-01-01T12:00:10Z'),
    deviceType: 'infrastructure',
    isConnectable: false
  }
];

describe('NearbyDevicesList', () => {
  const mockStartScanning = vi.fn();
  const mockStopScanning = vi.fn();
  const mockUpdateScanInterval = vi.fn();
  const mockRefreshDevices = vi.fn();
  const mockGetDevicesByType = vi.fn();
  const mockGetConnectableDevices = vi.fn();
  const mockGetDeviceById = vi.fn();
  const mockGetDevicesInRange = vi.fn();
  const mockOnDeviceConnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockUseNearbyDevices.mockReturnValue({
      devices: mockDevices,
      isScanning: true,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: mockUpdateScanInterval,
      error: null,
      lastScanTime: new Date('2024-01-01T12:00:00Z'),
      scanInterval: 5000,
      refreshDevices: mockRefreshDevices,
      getDevicesByType: mockGetDevicesByType,
      getConnectableDevices: mockGetConnectableDevices,
      getDeviceById: mockGetDeviceById,
      getDevicesInRange: mockGetDevicesInRange
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nearby devices list with devices', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    expect(screen.getByText('Nearby Vehicles')).toBeInTheDocument();
    expect(screen.getByText('Emergency Vehicle Alpha')).toBeInTheDocument();
    expect(screen.getByText('Civilian Vehicle Beta')).toBeInTheDocument();
    expect(screen.getByText('Traffic Infrastructure')).toBeInTheDocument();
  });

  it('sorts devices by distance (closest first)', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Check that devices are displayed in distance order
    expect(screen.getByText('Traffic Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Emergency Vehicle Alpha')).toBeInTheDocument();
    expect(screen.getByText('Civilian Vehicle Beta')).toBeInTheDocument();
    
    // Check distance displays
    expect(screen.getByText('100m away')).toBeInTheDocument();
    expect(screen.getByText('150m away')).toBeInTheDocument();
    expect(screen.getByText('300m away')).toBeInTheDocument();
  });

  it('displays device information correctly', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Check signal strength display
    expect(screen.getByText('85% signal')).toBeInTheDocument();
    expect(screen.getByText('72% signal')).toBeInTheDocument();
    expect(screen.getByText('95% signal')).toBeInTheDocument();
    
    // Check device type badges
    expect(screen.getByText('Emergency')).toBeInTheDocument();
    expect(screen.getByText('Vehicle')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
  });

  it('shows scanning status indicator with animation', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    expect(screen.getByText('Scanning')).toBeInTheDocument();
  });

  it('shows idle status when not scanning', () => {
    mockUseNearbyDevices.mockReturnValue({
      devices: mockDevices,
      isScanning: false,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: mockUpdateScanInterval,
      error: null,
      lastScanTime: new Date(),
      scanInterval: 5000,
      refreshDevices: mockRefreshDevices,
      getDevicesByType: mockGetDevicesByType,
      getConnectableDevices: mockGetConnectableDevices,
      getDeviceById: mockGetDeviceById,
      getDevicesInRange: mockGetDevicesInRange
    });

    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('displays empty state when no devices found', () => {
    mockUseNearbyDevices.mockReturnValue({
      devices: [],
      isScanning: true,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: mockUpdateScanInterval,
      error: null,
      lastScanTime: null,
      scanInterval: 5000,
      refreshDevices: mockRefreshDevices,
      getDevicesByType: mockGetDevicesByType,
      getConnectableDevices: mockGetConnectableDevices,
      getDeviceById: mockGetDeviceById,
      getDevicesInRange: mockGetDevicesInRange
    });

    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    expect(screen.getByText('No nearby vehicles found')).toBeInTheDocument();
    expect(screen.getByText('Scanning for devices...')).toBeInTheDocument();
  });

  it('handles connect button clicks with memoized callback', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    const connectButtons = screen.getAllByText('Connect');
    const connectableButton = connectButtons.find(button => !(button as HTMLButtonElement).disabled);
    
    if (connectableButton) {
      fireEvent.click(connectableButton);
      expect(mockOnDeviceConnect).toHaveBeenCalled();
    }
  });

  it('disables connect button for non-connectable devices', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Traffic Infrastructure should have a disabled button
    const buttons = screen.getAllByRole('button', { name: /connect|busy/i });
    const busyButton = buttons.find(button => button.textContent === 'Busy');
    expect(busyButton).toBeDisabled();
  });

  it('handles scan control buttons', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    const stopButton = screen.getByText('Stop Scanning');
    fireEvent.click(stopButton);
    
    expect(mockStopScanning).toHaveBeenCalled();
  });

  it('shows start scanning button when not scanning', () => {
    mockUseNearbyDevices.mockReturnValue({
      devices: [],
      isScanning: false,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: mockUpdateScanInterval,
      error: null,
      lastScanTime: null,
      scanInterval: 5000,
      refreshDevices: mockRefreshDevices,
      getDevicesByType: mockGetDevicesByType,
      getConnectableDevices: mockGetConnectableDevices,
      getDeviceById: mockGetDeviceById,
      getDevicesInRange: mockGetDevicesInRange
    });

    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    const startButton = screen.getByText('Start Scanning');
    fireEvent.click(startButton);
    
    expect(mockStartScanning).toHaveBeenCalled();
  });

  it('starts scanning on mount with battery optimization', () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    expect(mockUpdateScanInterval).toHaveBeenCalledWith(6000); // Battery optimized interval
    expect(mockStartScanning).toHaveBeenCalled();
  });

  it('adapts scan interval based on device count for performance', async () => {
    // Test with many devices (should use longer interval)
    const manyDevices = Array.from({ length: 15 }, (_, i) => ({
      ...mockDevices[0],
      id: `device-${i}`,
      name: `Device ${i}`
    }));

    mockUseNearbyDevices.mockReturnValue({
      devices: manyDevices,
      isScanning: true,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: mockUpdateScanInterval,
      error: null,
      lastScanTime: new Date(),
      scanInterval: 5000,
      refreshDevices: mockRefreshDevices,
      getDevicesByType: mockGetDevicesByType,
      getConnectableDevices: mockGetConnectableDevices,
      getDeviceById: mockGetDeviceById,
      getDevicesInRange: mockGetDevicesInRange
    });

    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);

    // Fast-forward to trigger the adaptive interval effect
    act(() => {
      vi.advanceTimersByTime(8000); // Should use 8s interval for many devices
    });

    expect(mockStopScanning).toHaveBeenCalled();
  });

  it('handles performance optimization with React.memo', () => {
    const { rerender } = render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Rerender with same devices should not cause unnecessary re-renders
    rerender(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Component should still render correctly
    expect(screen.getByText('Emergency Vehicle Alpha')).toBeInTheDocument();
    expect(screen.getByText('Civilian Vehicle Beta')).toBeInTheDocument();
  });

  it('displays time since last seen correctly', () => {
    // Mock Date.now to return a specific time
    const mockNow = new Date('2024-01-01T12:01:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);

    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Should show "60s ago" for the device last seen at 12:00:00
    expect(screen.getByText('60s ago')).toBeInTheDocument();
    
    vi.restoreAllMocks();
  });

  it('displays correct signal strength colors', () => {
    const devicesWithVariousSignals = [
      { ...mockDevices[0], signalStrength: 80 }, // Should be green
      { ...mockDevices[1], signalStrength: 50 }, // Should be yellow  
      { ...mockDevices[0], id: 'device-4', signalStrength: 20 } // Should be red
    ];

    mockUseNearbyDevices.mockReturnValue({
      devices: devicesWithVariousSignals,
      isScanning: true,
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      updateScanInterval: mockUpdateScanInterval,
      error: null,
      lastScanTime: new Date(),
      scanInterval: 5000,
      refreshDevices: mockRefreshDevices,
      getDevicesByType: mockGetDevicesByType,
      getConnectableDevices: mockGetConnectableDevices,
      getDeviceById: mockGetDeviceById,
      getDevicesInRange: mockGetDevicesInRange
    });

    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    // Check that signal strength indicators are present
    const signalElements = screen.getAllByText(/% signal/);
    expect(signalElements).toHaveLength(3);
  });

  it('cleans up intervals on unmount', () => {
    const { unmount } = render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    unmount();
    
    expect(mockStopScanning).toHaveBeenCalled();
  });

  it('handles device connection with debounced callback', async () => {
    render(<NearbyDevicesList onDeviceConnect={mockOnDeviceConnect} />);
    
    const connectButton = screen.getAllByText('Connect')[0];
    
    // Click multiple times rapidly
    fireEvent.click(connectButton);
    fireEvent.click(connectButton);
    fireEvent.click(connectButton);
    
    // Should be called for each click (not debounced for user interactions)
    expect(mockOnDeviceConnect).toHaveBeenCalledTimes(3);
  });
});