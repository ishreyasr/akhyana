// Custom hook for managing V2V settings state

import { useState, useEffect, useCallback } from 'react';
import { V2VSettings } from '../types/v2v.types';
import { settingsStorage, DEFAULT_SETTINGS } from '../utils/settingsStorage';

export function useV2VSettings() {
  const [settings, setSettings] = useState<V2VSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /**
   * Load settings on mount
   */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 200));

        const loadedSettings = settingsStorage.loadSettings();
        setSettings(loadedSettings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load settings');
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  /**
   * Save settings to storage
   */
  const saveSettings = useCallback(async (newSettings?: V2VSettings): Promise<boolean> => {
    const settingsToSave = newSettings || settings;

    try {
      setIsSaving(true);
      setError(null);

      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 300));

      const success = settingsStorage.saveSettings(settingsToSave);
      
      if (success) {
        setSettings(settingsToSave);
        setHasUnsavedChanges(false);
        return true;
      } else {
        setError('Failed to save settings');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  /**
   * Update a specific setting
   */
  const updateSetting = useCallback(<K extends keyof V2VSettings>(
    key: K,
    value: V2VSettings[K],
    autoSave = false
  ) => {
    const newSettings = {
      ...settings,
      [key]: value
    };

    setSettings(newSettings);
    setHasUnsavedChanges(true);

    if (autoSave) {
      saveSettings(newSettings);
    }
  }, [settings, saveSettings]);

  /**
   * Update nested setting
   */
  const updateNestedSetting = useCallback(<T extends keyof V2VSettings>(
    parentKey: T,
    childKey: keyof V2VSettings[T],
    value: any,
    autoSave = false
  ) => {
    const newSettings = {
      ...settings,
      [parentKey]: {
        ...settings[parentKey],
        [childKey]: value
      }
    };

    setSettings(newSettings);
    setHasUnsavedChanges(true);

    if (autoSave) {
      saveSettings(newSettings);
    }
  }, [settings, saveSettings]);

  /**
   * Reset settings to defaults
   */
  const resetSettings = useCallback(async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);

      const defaultSettings = settingsStorage.resetSettings();
      setSettings(defaultSettings);
      setHasUnsavedChanges(false);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Export settings as JSON
   */
  const exportSettings = useCallback((): string => {
    try {
      return settingsStorage.exportSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export settings');
      return '';
    }
  }, []);

  /**
   * Import settings from JSON
   */
  const importSettings = useCallback(async (settingsJson: string): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);

      const importedSettings = settingsStorage.importSettings(settingsJson);
      setSettings(importedSettings);
      setHasUnsavedChanges(false);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Validate current settings
   */
  const validateSettings = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Communication channel validation
    if (settings.communicationChannel < 1 || settings.communicationChannel > 10) {
      errors.push('Communication channel must be between 1 and 10');
    }

    // Voice quality threshold validation
    if (settings.voiceQualityThreshold < 0 || settings.voiceQualityThreshold > 100) {
      errors.push('Voice quality threshold must be between 0 and 100');
    }

    // Display brightness validation
    if (settings.alertPreferences.displayBrightness < 0 || settings.alertPreferences.displayBrightness > 100) {
      errors.push('Display brightness must be between 0 and 100');
    }

    // Scan interval validation
    if (settings.discoverySettings.scanInterval < 1000) {
      errors.push('Scan interval must be at least 1000ms');
    }

    // Max range validation
    if (settings.discoverySettings.maxRange < 100 || settings.discoverySettings.maxRange > 1000) {
      errors.push('Max range must be between 100 and 1000 meters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [settings]);

  /**
   * Get setting value by path (e.g., 'alertPreferences.soundEnabled')
   */
  const getSettingValue = useCallback((path: string): any => {
    const keys = path.split('.');
    let value: any = settings;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }, [settings]);

  /**
   * Check if settings have changed from defaults
   */
  const hasChangedFromDefaults = useCallback((): boolean => {
    return JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);
  }, [settings]);

  /**
   * Get settings summary for display
   */
  const getSettingsSummary = useCallback(() => {
    return {
      channel: settings.communicationChannel,
      autoChannel: settings.autoChannelSelection,
      soundEnabled: settings.alertPreferences.soundEnabled,
      nightMode: settings.nightMode,
      scanInterval: settings.discoverySettings.scanInterval / 1000, // Convert to seconds
      maxRange: settings.discoverySettings.maxRange
    };
  }, [settings]);

  return {
    settings,
    isLoading,
    isSaving,
    error,
    hasUnsavedChanges,
    saveSettings,
    updateSetting,
    updateNestedSetting,
    resetSettings,
    exportSettings,
    importSettings,
    validateSettings,
    getSettingValue,
    hasChangedFromDefaults,
    getSettingsSummary
  };
}