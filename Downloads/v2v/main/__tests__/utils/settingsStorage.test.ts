// Unit tests for settings storage utilities

import { vi } from 'vitest';
import { SettingsStorageService, DEFAULT_SETTINGS } from '../../utils/settingsStorage';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('SettingsStorageService', () => {
  let service: SettingsStorageService;

  beforeEach(() => {
    service = new SettingsStorageService();
    vi.clearAllMocks();
  });

  describe('loadSettings', () => {
    it('should return default settings when localStorage is empty', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const settings = service.loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('v2v-dashboard-settings');
    });

    it('should load and merge settings from localStorage', () => {
      const storedSettings = {
        communicationChannel: 5,
        nightMode: true
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));

      const settings = service.loadSettings();

      expect(settings.communicationChannel).toBe(5);
      expect(settings.nightMode).toBe(true);
      expect(settings.autoChannelSelection).toBe(DEFAULT_SETTINGS.autoChannelSelection);
    });

    it('should return default settings when JSON parsing fails', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const settings = service.loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should handle server-side rendering (no window)', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const settings = service.loadSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);

      global.window = originalWindow;
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', () => {
      const settings = {
        ...DEFAULT_SETTINGS,
        communicationChannel: 7,
        nightMode: true
      };

      const result = service.saveSettings(settings);

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'v2v-dashboard-settings',
        JSON.stringify(settings)
      );
    });

    it('should handle localStorage errors', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const result = service.saveSettings(DEFAULT_SETTINGS);

      expect(result).toBe(false);
    });

    it('should handle server-side rendering (no window)', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      const result = service.saveSettings(DEFAULT_SETTINGS);

      expect(result).toBe(false);

      global.window = originalWindow;
    });
  });

  describe('resetSettings', () => {
    it('should remove settings from localStorage and return defaults', () => {
      const settings = service.resetSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('v2v-dashboard-settings');
    });

    it('should handle localStorage errors during reset', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const settings = service.resetSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateSetting', () => {
    it('should update a specific setting and save', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(DEFAULT_SETTINGS));

      const updatedSettings = service.updateSetting('communicationChannel', 8);

      expect(updatedSettings.communicationChannel).toBe(8);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('updateNestedSetting', () => {
    it('should update nested setting and save', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(DEFAULT_SETTINGS));

      const updatedSettings = service.updateNestedSetting(
        'alertPreferences',
        'soundEnabled',
        false
      );

      expect(updatedSettings.alertPreferences.soundEnabled).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('exportSettings', () => {
    it('should export settings as JSON string', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(DEFAULT_SETTINGS));

      const exported = service.exportSettings();

      expect(typeof exported).toBe('string');
      expect(JSON.parse(exported)).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('importSettings', () => {
    it('should import and validate settings from JSON', () => {
      const importData = {
        ...DEFAULT_SETTINGS,
        communicationChannel: 9
      };

      const settings = service.importSettings(JSON.stringify(importData));

      expect(settings.communicationChannel).toBe(9);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        service.importSettings('invalid json');
      }).toThrow('Invalid settings format');
    });

    it('should validate and correct invalid settings', () => {
      const invalidSettings = {
        ...DEFAULT_SETTINGS,
        communicationChannel: 15, // Invalid (> 10)
        voiceQualityThreshold: -10 // Invalid (< 0)
      };

      const settings = service.importSettings(JSON.stringify(invalidSettings));

      expect(settings.communicationChannel).toBe(DEFAULT_SETTINGS.communicationChannel);
      expect(settings.voiceQualityThreshold).toBe(DEFAULT_SETTINGS.voiceQualityThreshold);
    });
  });
});