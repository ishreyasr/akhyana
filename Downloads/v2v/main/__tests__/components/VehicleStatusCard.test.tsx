import { render, screen } from '@testing-library/react';
import { VehicleStatusCard } from '@/components/v2v-dashboard/VehicleStatusCard';
import { useVehicleStatus } from '@/hooks/useVehicleStatus';
import { VehicleStatus } from '@/types/v2v.types';
import { vi } from 'vitest';

// Mock the hook
vi.mock('@/hooks/useVehicleStatus');
const mockUseVehicleStatus = vi.mocked(useVehicleStatus);

const mockVehicleStatus: VehicleStatus = {
  isOnline: true,
  lastConnected: new Date('2024-01-01T12:00:00Z'),
  vehicleId: 'test-vehicle-123',
  signalStrength: 85,
  batteryLevel: 75,
  gpsStatus: 'locked'
};

describe('VehicleStatusCard', () => {
  beforeEach(() => {
    mockUseVehicleStatus.mockReturnValue({
      vehicleStatus: mockVehicleStatus,
      updateVehicleStatus: vi.fn(),
      isLoading: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders vehicle status card with online status', () => {
    render(<VehicleStatusCard />);
    
    expect(screen.getByText('Vehicle Status')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('test-vehicle-123')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('GPS Locked')).toBeInTheDocument();
  });

  it('renders offline status correctly', () => {
    mockUseVehicleStatus.mockReturnValue({
      vehicleStatus: { ...mockVehicleStatus, isOnline: false },
      updateVehicleStatus: vi.fn(),
      isLoading: false
    });

    render(<VehicleStatusCard />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders GPS searching status with animation', () => {
    mockUseVehicleStatus.mockReturnValue({
      vehicleStatus: { ...mockVehicleStatus, gpsStatus: 'searching' },
      updateVehicleStatus: vi.fn(),
      isLoading: false
    });

    render(<VehicleStatusCard />);
    
    expect(screen.getByText('GPS Searching')).toBeInTheDocument();
  });

  it('renders GPS offline status', () => {
    mockUseVehicleStatus.mockReturnValue({
      vehicleStatus: { ...mockVehicleStatus, gpsStatus: 'offline' },
      updateVehicleStatus: vi.fn(),
      isLoading: false
    });

    render(<VehicleStatusCard />);
    
    expect(screen.getByText('GPS Offline')).toBeInTheDocument();
  });

  it('displays signal strength and battery level progress bars', () => {
    render(<VehicleStatusCard />);
    
    // Check for progress bars (they should have role="progressbar")
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2); // Signal strength and battery level
  });

  it('displays last connected timestamp', () => {
    render(<VehicleStatusCard />);
    
    expect(screen.getByText('Last Connected:')).toBeInTheDocument();
    // The exact time format may vary, so we just check that some time is displayed
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('shows vehicle ID in monospace font', () => {
    render(<VehicleStatusCard />);
    
    const vehicleIdElement = screen.getByText('test-vehicle-123');
    expect(vehicleIdElement).toHaveClass('font-mono');
  });
});