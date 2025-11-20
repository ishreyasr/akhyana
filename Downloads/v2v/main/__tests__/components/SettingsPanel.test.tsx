import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SettingsPanel } from '../../components/v2v-dashboard/SettingsPanel';
import { useV2VSettings } from '../../hooks/useV2VSettings';
import { useTheme } from 'next-themes';

// Mock the hooks
vi.mock('../../hooks/useV2VSettings');
vi.mock('next-themes');
vi.mock('../../components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const mockUseV2VSettings = vi.mocked(useV2VSettings);
const mockUseTheme = vi.mocked(useTheme);

const mockSettings = {
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
};

const mockSettingsHook = {
  settings: mockSettings,
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
};

const mockThemeHook = {
  theme: 'light',
  setTheme: vi.fn()
};

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseV2VSettings.mockReturnValue(mockSettingsHook);
    mockUseTheme.mockReturnValue(mockThemeHook);
  });

  it('renders settings panel with all tabs', () => {
    render(<SettingsPanel />);
    
    expect(screen.getByText('V2V Settings')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('shows loading state when settings are loading', () => {
    mockUseV2VSettings.mockReturnValue({
      ...mockSettingsHook,
      isLoading: true
    });

    render(<SettingsPanel />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toHaveClass('animate-spin');
  });

  it('displays error message when there is an error', () => {
    mockUseV2VSettings.mockReturnValue({
      ...mockSettingsHook,
      error: 'Failed to load settings'
    });

    render(<SettingsPanel />);
    
    expect(screen.getByText('Failed to load settings')).toBeInTheDocument();
  });

  it('shows unsaved changes badge when there are unsaved changes', () => {
    mockUseV2VSettings.mockReturnValue({
      ...mockSettingsHook,
      hasUnsavedChanges: true
    });

    render(<SettingsPanel />);
    
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
  });

  describe('Communication Tab', () => {
    it('displays communication channel settings', () => {
      render(<SettingsPanel />);
      
      expect(screen.getByText('Communication Channel')).toBeInTheDocument();
      expect(screen.getByText('Current channel: 5')).toBeInTheDocument();
      expect(screen.getByText('Auto Channel Selection')).toBeInTheDocument();
    });

    it('updates communication channel when changed', async () => {
      render(<SettingsPanel />);
      
      const channelSelect = screen.getByRole('combobox');
      fireEvent.click(channelSelect);
      
      const channel3 = screen.getByText('Channel 3');
      fireEvent.click(channel3);
      
      expect(mockSettingsHook.updateSetting).toHaveBeenCalledWith('communicationChannel', 3);
    });

    it('toggles auto channel selection', () => {
      render(<SettingsPanel />);
      
      const autoChannelSwitch = screen.getByRole('switch', { name: /auto channel selection/i });
      fireEvent.click(autoChannelSwitch);
      
      expect(mockSettingsHook.updateSetting).toHaveBeenCalledWith('autoChannelSelection', false);
    });

    it('updates voice quality threshold with slider', () => {
      render(<SettingsPanel />);
      
      const slider = screen.getByRole('slider', { name: /voice quality threshold/i });
      fireEvent.change(slider, { target: { value: '85' } });
      
      expect(mockSettingsHook.updateSetting).toHaveBeenCalledWith('voiceQualityThreshold', 85);
    });
  });

  describe('Alerts Tab', () => {
    it('displays alert preferences', () => {
      render(<SettingsPanel />);
      
      // Switch to alerts tab
      fireEvent.click(screen.getByText('Alerts'));
      
      expect(screen.getByText('Sound Alerts')).toBeInTheDocument();
      expect(screen.getByText('Vibration Alerts')).toBeInTheDocument();
      expect(screen.getByText('Display Brightness: 80%')).toBeInTheDocument();
    });

    it('toggles sound alerts', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('Alerts'));
      
      const soundSwitch = screen.getByRole('switch', { name: /sound alerts/i });
      fireEvent.click(soundSwitch);
      
      expect(mockSettingsHook.updateNestedSetting).toHaveBeenCalledWith('alertPreferences', 'soundEnabled', false);
    });

    it('updates display brightness', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('Alerts'));
      
      const brightnessSlider = screen.getByRole('slider', { name: /display brightness/i });
      fireEvent.change(brightnessSlider, { target: { value: '60' } });
      
      expect(mockSettingsHook.updateNestedSetting).toHaveBeenCalledWith('alertPreferences', 'displayBrightness', 60);
    });
  });

  describe('Discovery Tab', () => {
    it('displays discovery settings', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('Discovery'));
      
      expect(screen.getByText('Scan Interval: 5s')).toBeInTheDocument();
      expect(screen.getByText('Max Range: 500m')).toBeInTheDocument();
      expect(screen.getByText('Device Filters')).toBeInTheDocument();
    });

    it('updates scan interval', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('Discovery'));
      
      const scanSlider = screen.getByRole('slider', { name: /scan interval/i });
      fireEvent.change(scanSlider, { target: { value: '10000' } });
      
      expect(mockSettingsHook.updateNestedSetting).toHaveBeenCalledWith('discoverySettings', 'scanInterval', 10000);
    });

    it('toggles device filters', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('Discovery'));
      
      const infrastructureBadge = screen.getByText('infrastructure');
      fireEvent.click(infrastructureBadge);
      
      expect(mockSettingsHook.updateNestedSetting).toHaveBeenCalledWith(
        'discoverySettings', 
        'deviceFilters', 
        ['vehicle', 'emergency', 'infrastructure']
      );
    });
  });

  describe('General Tab', () => {
    it('displays general settings', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('General'));
      
      expect(screen.getByText('Night Mode')).toBeInTheDocument();
      expect(screen.getByText('Settings Management')).toBeInTheDocument();
    });

    it('toggles night mode and updates theme', () => {
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('General'));
      
      const nightModeSwitch = screen.getByRole('switch', { name: /night mode/i });
      fireEvent.click(nightModeSwitch);
      
      expect(mockSettingsHook.updateSetting).toHaveBeenCalledWith('nightMode', true);
      expect(mockThemeHook.setTheme).toHaveBeenCalledWith('dark');
    });

    it('exports settings when export button is clicked', () => {
      mockSettingsHook.exportSettings.mockReturnValue('{"test": "data"}');
      
      // Mock URL.createObjectURL and related DOM methods
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      const mockClick = vi.fn();
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      
      Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL });
      
      const mockAnchor = {
        href: '',
        download: '',
        click: mockClick
      };
      
      vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
      
      render(<SettingsPanel />);
      
      fireEvent.click(screen.getByText('General'));
      fireEvent.click(screen.getByText('Export'));
      
      expect(mockSettingsHook.exportSettings).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Settings Actions', () => {
    it('saves settings when save button is clicked', async () => {
      mockSettingsHook.saveSettings.mockResolvedValue(true);
      mockUseV2VSettings.mockReturnValue({
        ...mockSettingsHook,
        hasUnsavedChanges: true
      });

      render(<SettingsPanel />);
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      expect(mockSettingsHook.saveSettings).toHaveBeenCalled();
    });

    it('resets settings when reset button is clicked', async () => {
      mockSettingsHook.resetSettings.mockResolvedValue(true);

      render(<SettingsPanel />);
      
      const resetButton = screen.getByText('Reset to Defaults');
      fireEvent.click(resetButton);
      
      expect(mockSettingsHook.resetSettings).toHaveBeenCalled();
    });

    it('disables save button when no unsaved changes', () => {
      render(<SettingsPanel />);
      
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).toBeDisabled();
    });

    it('shows validation errors when saving invalid settings', async () => {
      mockSettingsHook.validateSettings.mockReturnValue({
        isValid: false,
        errors: ['Communication channel must be between 1 and 10']
      });
      
      mockUseV2VSettings.mockReturnValue({
        ...mockSettingsHook,
        hasUnsavedChanges: true
      });

      render(<SettingsPanel />);
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      // The toast should be called with validation error
      // We can't easily test the toast content, but we can verify validateSettings was called
      expect(mockSettingsHook.validateSettings).toHaveBeenCalled();
    });
  });
});