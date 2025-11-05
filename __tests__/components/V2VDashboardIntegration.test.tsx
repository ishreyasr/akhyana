import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { V2VDashboardIntegration } from '../../components/v2v-dashboard/V2VDashboardIntegration';
import * as navigation from '../../utils/navigation';

// Mock the navigation utilities
vi.mock('../../utils/navigation', () => ({
  handleConnectionSuccess: vi.fn()
}));

// Mock the hooks and components
vi.mock('../../hooks/useV2VSettings', () => ({
  useV2VSettings: () => ({
    settings: {
      communicationChannel: 5,
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
        deviceFilters: ['vehicle', 'emergency']
      },
      nightMode: false
    },
    isLoading: false,
    isSaving: false,
    error: null,
    hasUnsavedChanges: false,
    saveSettings: vi.fn(),
    updateSetting: vi.fn(),
    updateNestedSetting: vi.fn(),
    resetSettings: vi.fn(),
    exportSettings: vi.fn(),
    importSettings: vi.fn(),
    validateSettings: vi.fn(() => ({ isValid: true, errors: [] }))
  })
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn()
  })
}));

vi.mock('../../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const mockNavigationUtils = vi.mocked(navigation);

describe('V2VDashboardIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders settings panel and demo connection button', () => {
    render(<V2VDashboardIntegration />);
    
    expect(screen.getByText('V2V Settings')).toBeInTheDocument();
    expect(screen.getByText('Demo Connection to Demo Vehicle')).toBeInTheDocument();
  });

  it('opens connection dialog when demo button is clicked', () => {
    render(<V2VDashboardIntegration />);
    
    const demoButton = screen.getByText('Demo Connection to Demo Vehicle');
    fireEvent.click(demoButton);
    
    expect(screen.getByText('Connect to Demo Vehicle')).toBeInTheDocument();
    expect(screen.getByText('demo-vehicle-123')).toBeInTheDocument();
  });

  it('handles successful connection with navigation', async () => {
    // Mock Math.random to ensure successful connection
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    
    render(<V2VDashboardIntegration />);
    
    // Open connection dialog
    const demoButton = screen.getByText('Demo Connection to Demo Vehicle');
    fireEvent.click(demoButton);
    
    // Start connection
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Fast-forward through connection process
    vi.advanceTimersByTime(10000);
    
    await waitFor(() => {
      expect(screen.getByText(/Successfully connected/)).toBeInTheDocument();
    });
    
    // Wait for navigation to be called
    vi.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(mockNavigationUtils.handleConnectionSuccess).toHaveBeenCalledWith(
        'demo-vehicle-123',
        'Demo Vehicle'
      );
    });
  });

  it('handles connection errors properly', async () => {
    // Mock Math.random to force failure
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
    
    render(<V2VDashboardIntegration />);
    
    // Open connection dialog
    const demoButton = screen.getByText('Demo Connection to Demo Vehicle');
    fireEvent.click(demoButton);
    
    // Start connection
    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);
    
    // Fast-forward to trigger failure
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed at/)).toBeInTheDocument();
    });
    
    // Navigation should not be called on failure
    expect(mockNavigationUtils.handleConnectionSuccess).not.toHaveBeenCalled();
  });

  it('closes connection dialog properly', () => {
    render(<V2VDashboardIntegration />);
    
    // Open connection dialog
    const demoButton = screen.getByText('Demo Connection to Demo Vehicle');
    fireEvent.click(demoButton);
    
    expect(screen.getByText('Connect to Demo Vehicle')).toBeInTheDocument();
    
    // Close dialog
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Connect to Demo Vehicle')).not.toBeInTheDocument();
  });

  it('integrates settings panel with connection functionality', () => {
    render(<V2VDashboardIntegration />);
    
    // Settings panel should be visible
    expect(screen.getByText('V2V Settings')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    
    // Connection functionality should be available
    expect(screen.getByText('Demo Connection to Demo Vehicle')).toBeInTheDocument();
  });
});