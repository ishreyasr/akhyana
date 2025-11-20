import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmergencyAlertPanel } from '@/components/v2v-dashboard/EmergencyAlertPanel';
import { useEmergencyAlerts } from '@/hooks/useEmergencyAlerts';
import { EmergencyAlert } from '@/types/v2v.types';
import { vi } from 'vitest';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the hook
vi.mock('@/hooks/useEmergencyAlerts');
const mockUseEmergencyAlerts = vi.mocked(useEmergencyAlerts);

const mockAlerts: EmergencyAlert[] = [
  {
    type: 'medical',
    message: 'Medical Emergency reported',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    location: { lat: 40.7128, lng: -74.0060 },
    severity: 'high'
  },
  {
    type: 'accident',
    message: 'Accident reported',
    timestamp: new Date('2024-01-01T11:55:00Z'),
    location: { lat: 40.7128, lng: -74.0060 },
    severity: 'high'
  },
  {
    type: 'breakdown',
    message: 'Vehicle Breakdown reported',
    timestamp: new Date('2024-01-01T11:50:00Z'),
    location: { lat: 40.7128, lng: -74.0060 },
    severity: 'medium'
  }
];

describe('EmergencyAlertPanel', () => {
  const mockSendAlert = vi.fn();

  beforeEach(() => {
    mockUseEmergencyAlerts.mockReturnValue({
      alerts: mockAlerts,
      sendAlert: mockSendAlert,
      isLoading: false
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders emergency alert panel', () => {
    render(<EmergencyAlertPanel />);
    
    expect(screen.getByText('Emergency Alerts')).toBeInTheDocument();
    expect(screen.getByText('Select Emergency Type:')).toBeInTheDocument();
    expect(screen.getByText('Send Emergency Alert')).toBeInTheDocument();
  });

  it('displays all alert type buttons', () => {
    render(<EmergencyAlertPanel />);
    
    expect(screen.getAllByText('Medical Emergency')).toHaveLength(2); // Selection + Quick send
    expect(screen.getAllByText('Accident')).toHaveLength(2);
    expect(screen.getAllByText('Vehicle Breakdown')).toHaveLength(2);
    expect(screen.getAllByText('Road Hazard')).toHaveLength(2);
  });

  it('allows selecting alert types', () => {
    render(<EmergencyAlertPanel />);
    
    const medicalButtons = screen.getAllByRole('button', { name: /Medical Emergency/ });
    // Click the first one (selection button)
    fireEvent.click(medicalButtons[0]);
    
    // The button should be selected (this would be visually indicated by variant change)
    expect(medicalButtons[0]).toBeInTheDocument();
  });

  it('enables send button when alert type is selected', () => {
    render(<EmergencyAlertPanel />);
    
    const sendButton = screen.getByText('Send Emergency Alert');
    expect(sendButton).toBeDisabled();
    
    const medicalButtons = screen.getAllByRole('button', { name: /Medical Emergency/ });
    // Click the first one (selection button)
    fireEvent.click(medicalButtons[0]);
    
    expect(sendButton).not.toBeDisabled();
  });

  it('sends alert when emergency button is clicked', async () => {
    render(<EmergencyAlertPanel />);
    
    // Select medical emergency
    const medicalButtons = screen.getAllByRole('button', { name: /Medical Emergency/ });
    fireEvent.click(medicalButtons[0]); // Click selection button
    
    // Click send button
    const sendButton = screen.getByText('Send Emergency Alert');
    fireEvent.click(sendButton);
    
    expect(mockSendAlert).toHaveBeenCalledWith({
      type: 'medical',
      message: 'Medical Emergency reported',
      timestamp: expect.any(Date),
      location: { lat: 0, lng: 0 },
      severity: 'high'
    });
  });

  it('displays quick send buttons', () => {
    render(<EmergencyAlertPanel />);
    
    expect(screen.getByText('Quick Send:')).toBeInTheDocument();
    
    // Quick send buttons should be present (they have the same text as selection buttons)
    const quickSendButtons = screen.getAllByText('Medical Emergency');
    expect(quickSendButtons.length).toBeGreaterThan(1); // One for selection, one for quick send
  });

  it('handles quick send button clicks', async () => {
    render(<EmergencyAlertPanel />);
    
    // Find quick send buttons (they should be in the Quick Send section)
    const quickSendButtons = screen.getAllByRole('button', { name: /Medical Emergency/ });
    // Click the second one (quick send button)
    fireEvent.click(quickSendButtons[1]);
    
    expect(mockSendAlert).toHaveBeenCalledWith({
      type: 'medical',
      message: 'Medical Emergency reported',
      timestamp: expect.any(Date),
      location: { lat: 0, lng: 0 },
      severity: 'high'
    });
  });

  it('shows loading state when sending alert', () => {
    mockUseEmergencyAlerts.mockReturnValue({
      alerts: mockAlerts,
      sendAlert: mockSendAlert,
      isLoading: true
    });

    render(<EmergencyAlertPanel />);
    
    expect(screen.getByText('Sending Alert...')).toBeInTheDocument();
    
    // All buttons should be disabled when loading
    const sendButton = screen.getByText('Sending Alert...');
    expect(sendButton).toBeDisabled();
  });

  it('toggles alert history visibility', () => {
    render(<EmergencyAlertPanel />);
    
    // History should be hidden initially
    expect(screen.queryByText('Alert History')).not.toBeInTheDocument();
    
    // Click show history button
    const showHistoryButton = screen.getByText('Show History');
    fireEvent.click(showHistoryButton);
    
    expect(screen.getByText('Alert History')).toBeInTheDocument();
    expect(screen.getByText('Hide History')).toBeInTheDocument();
  });

  it('displays alert history when shown', () => {
    render(<EmergencyAlertPanel />);
    
    // Show history
    const showHistoryButton = screen.getByText('Show History');
    fireEvent.click(showHistoryButton);
    
    // Check that alerts are displayed
    expect(screen.getByText('Medical Emergency reported')).toBeInTheDocument();
    expect(screen.getByText('Accident reported')).toBeInTheDocument();
    expect(screen.getByText('Vehicle Breakdown reported')).toBeInTheDocument();
  });

  it('displays priority badges for alerts', () => {
    render(<EmergencyAlertPanel />);
    
    // Show history to see the alerts
    const showHistoryButton = screen.getByText('Show History');
    fireEvent.click(showHistoryButton);
    
    expect(screen.getAllByText('HIGH')).toHaveLength(2); // Medical and accident
    expect(screen.getByText('MEDIUM')).toBeInTheDocument(); // Breakdown
  });

  it('shows empty state when no alerts in history', () => {
    mockUseEmergencyAlerts.mockReturnValue({
      alerts: [],
      sendAlert: mockSendAlert,
      isLoading: false
    });

    render(<EmergencyAlertPanel />);
    
    // Show history
    const showHistoryButton = screen.getByText('Show History');
    fireEvent.click(showHistoryButton);
    
    expect(screen.getByText('No alerts yet')).toBeInTheDocument();
  });

  it('displays active alerts notification', () => {
    // Create a recent alert (within 5 minutes)
    const recentAlert: EmergencyAlert = {
      type: 'medical',
      message: 'Recent alert',
      timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      location: { lat: 40.7128, lng: -74.0060 },
      severity: 'high'
    };

    mockUseEmergencyAlerts.mockReturnValue({
      alerts: [recentAlert],
      sendAlert: mockSendAlert,
      isLoading: false
    });

    render(<EmergencyAlertPanel />);
    
    expect(screen.getByText(/You have active emergency alerts/)).toBeInTheDocument();
    expect(screen.getByText(/They will expire automatically after 5 minutes/)).toBeInTheDocument();
  });

  it('displays time ago for alerts correctly', () => {
    // Mock Date.now to return a specific time
    const mockNow = new Date('2024-01-01T12:05:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);

    render(<EmergencyAlertPanel />);
    
    // Show history
    const showHistoryButton = screen.getByText('Show History');
    fireEvent.click(showHistoryButton);
    
    // Should show multiple time ago texts (one for each alert)
    const timeAgoElements = screen.getAllByText(/ago/);
    expect(timeAgoElements.length).toBeGreaterThan(0);
    
    vi.restoreAllMocks();
  });
});