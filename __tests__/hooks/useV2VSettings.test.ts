// Unit tests for useV2VSettings hook

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useV2VSettings } from '../../hooks/useV2VSettings';
import { settingsStorage, DEFAULT_SETTINGS } from '../../utils/settingsStorage';

// Mock settings storage
vi.mock('../../utils/settingsStorage', () => ({
  settingsStorage: {
    loadSettings: vi.fn(),
    saveSettings: vi.fn(),
    resetSettings: vi.fn(),
    exportSettings: vi.fn(),
    importSettings: vi.fn()
  },
  DEFAULT_SETTINGS: {
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
    },
    nightMode: false
  }
}));

const mockSettingsStorage = settingsStorage as any;

describe('useV2VSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSettingsStorage.loadSettings.mockReturnValue(DEFAULT_SETTINGS);
    mockSettingsStorage.saveSettings.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useV2VSettings());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should load settings on mount', async () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      communicationChannel: 5
    };
    mockSettingsStorage.loadSettings.mockReturnValue(customSettings);

    const { result } = renderHook(() => useV2VSettings());

    // Fast-forward through loading delay
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.settings.communicationChannel).toBe(5);
    expect(mockSettingsStorage.loadSettings).toHaveBeenCalled();
  });

  it('should handle loading errors', async () => {
    mockSettingsStorage.loadSettings.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const { result } = renderHook(() => useV2VSettings());

    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Storage error');
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('should save settings', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let saveResult: boolean;
    await act(async () => {
      saveResult = await result.current.saveSettings();
    });

    // Fast-forward through save delay
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(saveResult!).toBe(true);
    expect(mockSettingsStorage.saveSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should handle save errors', async () => {
    mockSettingsStorage.saveSettings.mockReturnValue(false);

    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let saveResult: boolean;
    await act(async () => {
      saveResult = await result.current.saveSettings();
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(saveResult!).toBe(false);
    expect(result.current.error).toBe('Failed to save settings');
  });

  it('should update specific setting', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateSetting('communicationChannel', 7);
    });

    expect(result.current.settings.communicationChannel).toBe(7);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should update nested setting', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.updateNestedSetting('alertPreferences', 'soundEnabled', false);
    });

    expect(result.current.settings.alertPreferences.soundEnabled).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should auto-save when specified', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.updateSetting('nightMode', true, true);
    });

    // Fast-forward through save delay
    act(() => {
      vi.advanceTimersByTime(300);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.settings.nightMode).toBe(true);
    expect(mockSettingsStorage.saveSettings).toHaveBeenCalled();
  });

  it('should reset settings', async () => {
    mockSettingsStorage.resetSettings.mockReturnValue(DEFAULT_SETTINGS);

    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let resetResult: boolean;
    await act(async () => {
      resetResult = await result.current.resetSettings();
    });

    expect(resetResult!).toBe(true);
    expect(mockSettingsStorage.resetSettings).toHaveBeenCalled();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should export settings', async () => {
    const exportedJson = JSON.stringify(DEFAULT_SETTINGS);
    mockSettingsStorage.exportSettings.mockReturnValue(exportedJson);

    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const exported = result.current.exportSettings();

    expect(exported).toBe(exportedJson);
    expect(mockSettingsStorage.exportSettings).toHaveBeenCalled();
  });

  it('should import settings', async () => {
    const importSettings = {
      ...DEFAULT_SETTINGS,
      communicationChannel: 9
    };
    mockSettingsStorage.importSettings.mockReturnValue(importSettings);

    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    let importResult: boolean;
    await act(async () => {
      importResult = await result.current.importSettings(JSON.stringify(importSettings));
    });

    expect(importResult!).toBe(true);
    expect(result.current.settings.communicationChannel).toBe(9);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should validate settings', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Set invalid values
    act(() => {
      result.current.updateSetting('communicationChannel', 15); // Invalid
    });

    const validation = result.current.validateSettings();

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('Communication channel must be between 1 and 10');
  });

  it('should get setting value by path', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const value = result.current.getSettingValue('alertPreferences.soundEnabled');

    expect(value).toBe(true);
  });

  it('should check if settings have changed from defaults', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.hasChangedFromDefaults()).toBe(false);

    act(() => {
      result.current.updateSetting('communicationChannel', 5);
    });

    expect(result.current.hasChangedFromDefaults()).toBe(true);
  });

  it('should get settings summary', async () => {
    const { result } = renderHook(() => useV2VSettings());

    // Wait for initialization
    act(() => {
      vi.advanceTimersByTime(200);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const summary = result.current.getSettingsSummary();

    expect(summary).toEqual({
      channel: 1,
      autoChannel: true,
      soundEnabled: true,
      nightMode: false,
      scanInterval: 5, // Converted to seconds
      maxRange: 500
    });
  });
});