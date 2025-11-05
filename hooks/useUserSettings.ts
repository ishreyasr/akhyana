"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchUserSettings } from '@/utils/supabaseClient';
import { saveUserSettingViaApi } from '@/utils/settingsClient';

export type UserPreferenceKey = 'theme' | 'distanceUnit' | 'alertFilter';

export interface UserSettingsState {
  theme: 'light' | 'dark' | 'system';
  distanceUnit: 'm' | 'km';
  alertFilter: 'all' | 'unacknowledged';
  loaded: boolean;
}

const DEFAULT_SETTINGS: UserSettingsState = {
  theme: 'system',
  distanceUnit: 'm',
  alertFilter: 'all',
  loaded: false,
};

const STORAGE_KEY = 'v2v_user_settings_v1';

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettingsState>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from Supabase (if available) falling back to localStorage
  useEffect(() => {
    try {
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('authUserId') || 'anonymous' : 'anonymous';
      (async () => {
        try {
          if (supabase && userId !== 'anonymous') {
            const remote = await fetchUserSettings(userId);
            if (remote && Object.keys(remote).length) {
              setSettings(s => ({ ...s, ...remote, loaded: true }));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
              return;
            }
          }
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            setSettings({ ...DEFAULT_SETTINGS, ...parsed, loaded: true });
          } else {
            setSettings(s => ({ ...s, loaded: true }));
          }
        } catch (inner) {
          setSettings(s => ({ ...s, loaded: true }));
        }
      })();
    } catch (e) {
      setError('Failed to load settings');
      setSettings(s => ({ ...s, loaded: true }));
    }
  }, []);

  const persist = useCallback(async (next: Partial<UserSettingsState>) => {
    setIsSaving(true);
    setError(null);
    try {
      const merged = { ...settings, ...next, loaded: true };
      setSettings(merged);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      const userId = typeof window !== 'undefined' ? sessionStorage.getItem('authUserId') || 'anonymous' : 'anonymous';
      if (userId !== 'anonymous') {
        const keys = Object.keys(next) as (keyof UserSettingsState)[];
        await Promise.all(keys.map(k => saveUserSettingViaApi(userId, k, (merged as any)[k])));
      }
    } catch (e) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const updateTheme = useCallback((theme: UserSettingsState['theme']) => persist({ theme }), [persist]);
  const updateDistanceUnit = useCallback((distanceUnit: UserSettingsState['distanceUnit']) => persist({ distanceUnit }), [persist]);
  const updateAlertFilter = useCallback((alertFilter: UserSettingsState['alertFilter']) => persist({ alertFilter }), [persist]);

  return {
    settings,
    isSaving,
    error,
    updateTheme,
    updateDistanceUnit,
    updateAlertFilter,
  };
}
