'use client';
import React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { useUserSettings } from '@/hooks/useUserSettings';

export const ClientThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useUserSettings();
  const forcedTheme = settings.theme === 'system' ? undefined : settings.theme;
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={forcedTheme || 'system'}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
};
