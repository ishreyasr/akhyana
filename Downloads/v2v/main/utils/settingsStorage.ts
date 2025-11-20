// Settings persistence utilities using localStorage

import { V2VSettings } from '../types/v2v.types';

const SETTINGS_STORAGE_KEY = 'v2v-dashboard-settings';

// Default settings
export const DEFAULT_SETTINGS: V2VSettings = {
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
};

export class SettingsStorageService {
  /**
   * Load settings from localStorage
   */
  loadSettings(): V2VSettings {
    try {
      if (typeof window === 'undefined') {
        // Server-side rendering fallback
        return DEFAULT_SETTINGS;
      }

      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }

      const parsed = JSON.parse(stored);
      
      // Merge with defaults to handle missing properties
      return this.mergeWithDefaults(parsed);
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings: V2VSettings): boolean {
    try {
      if (typeof window === 'undefined') {
        console.warn('Cannot save settings: localStorage not available');
        return false;
      }

      const serialized = JSON.stringify(settings);
      localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
      
      console.log('Settings saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
      return false;
    }
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): V2VSettings {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
      }
      console.log('Settings reset to defaults');
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update specific setting
   */
  updateSetting<K extends keyof V2VSettings>(
    key: K,
    value: V2VSettings[K]
  ): V2VSettings {
    const currentSettings = this.loadSettings();
    const updatedSettings = {
      ...currentSettings,
      [key]: value
    };
    
    this.saveSettings(updatedSettings);
    return updatedSettings;
  }

  /**
   * Update nested setting (e.g., alertPreferences.soundEnabled)
   */
  updateNestedSetting<T extends keyof V2VSettings>(
    parentKey: T,
    childKey: keyof V2VSettings[T],
    value: any
  ): V2VSettings {
    const currentSettings = this.loadSettings();
    const updatedSettings = {
      ...currentSettings,
      [parentKey]: {
        ...currentSettings[parentKey],
        [childKey]: value
      }
    };
    
    this.saveSettings(updatedSettings);
    return updatedSettings;
  }

  /**
   * Export settings as JSON string
   */
  exportSettings(): string {
    const settings = this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON string
   */
  importSettings(settingsJson: string): V2VSettings {
    try {
      const parsed = JSON.parse(settingsJson);
      const validatedSettings = this.validateSettings(parsed);
      this.saveSettings(validatedSettings);
      return validatedSettings;
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Invalid settings format');
    }
  }

  /**
   * Validate settings object structure
   */
  private validateSettings(settings: any): V2VSettings {
    // Basic validation - ensure required properties exist
    const validated = this.mergeWithDefaults(settings);
    
    // Additional validation rules
    if (validated.communicationChannel < 1 || validated.communicationChannel > 10) {
      validated.communicationChannel = DEFAULT_SETTINGS.communicationChannel;
    }
    
    if (validated.voiceQualityThreshold < 0 || validated.voiceQualityThreshold > 100) {
      validated.voiceQualityThreshold = DEFAULT_SETTINGS.voiceQualityThreshold;
    }
    
    if (validated.alertPreferences.displayBrightness < 0 || validated.alertPreferences.displayBrightness > 100) {
      validated.alertPreferences.displayBrightness = DEFAULT_SETTINGS.alertPreferences.displayBrightness;
    }
    
    if (validated.discoverySettings.scanInterval < 1000) {
      validated.discoverySettings.scanInterval = DEFAULT_SETTINGS.discoverySettings.scanInterval;
    }
    
    if (validated.discoverySettings.maxRange < 100 || validated.discoverySettings.maxRange > 1000) {
      validated.discoverySettings.maxRange = DEFAULT_SETTINGS.discoverySettings.maxRange;
    }

    return validated;
  }

  /**
   * Merge settings with defaults to handle missing properties
   */
  private mergeWithDefaults(settings: Partial<V2VSettings>): V2VSettings {
    return {
      communicationChannel: settings.communicationChannel ?? DEFAULT_SETTINGS.communicationChannel,
      autoChannelSelection: settings.autoChannelSelection ?? DEFAULT_SETTINGS.autoChannelSelection,
      voiceQualityThreshold: settings.voiceQualityThreshold ?? DEFAULT_SETTINGS.voiceQualityThreshold,
      alertPreferences: {
        soundEnabled: settings.alertPreferences?.soundEnabled ?? DEFAULT_SETTINGS.alertPreferences.soundEnabled,
        vibrationEnabled: settings.alertPreferences?.vibrationEnabled ?? DEFAULT_SETTINGS.alertPreferences.vibrationEnabled,
        displayBrightness: settings.alertPreferences?.displayBrightness ?? DEFAULT_SETTINGS.alertPreferences.displayBrightness
      },
      discoverySettings: {
        scanInterval: settings.discoverySettings?.scanInterval ?? DEFAULT_SETTINGS.discoverySettings.scanInterval,
        maxRange: settings.discoverySettings?.maxRange ?? DEFAULT_SETTINGS.discoverySettings.maxRange,
        deviceFilters: settings.discoverySettings?.deviceFilters ?? DEFAULT_SETTINGS.discoverySettings.deviceFilters
      },
      nightMode: settings.nightMode ?? DEFAULT_SETTINGS.nightMode
    };
  }
}

// Singleton instance
export const settingsStorage = new SettingsStorageService();