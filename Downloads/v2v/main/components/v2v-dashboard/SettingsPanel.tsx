'use client'

import React, { useState } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { AlertCircle, Download, Upload, RotateCcw, Save, Settings, Volume2, Wifi, Moon, Sun } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useToast } from '../ui/use-toast';
import { useV2VSettings } from '../../hooks/useV2VSettings';

interface SettingsPanelProps {
  className?: string;
}

export function SettingsPanel({ className }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const {
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
    validateSettings
  } = useV2VSettings();

  const [activeTab, setActiveTab] = useState('communication');
  const [importData, setImportData] = useState('');

  // Handle save settings
  const handleSave = async () => {
    const validation = validateSettings();
    if (!validation.isValid) {
      toast({
        title: 'Validation Error',
        description: validation.errors.join(', '),
        variant: 'destructive'
      });
      return;
    }

    const success = await saveSettings();
    if (success) {
      toast({
        title: 'Settings Saved',
        description: 'Your preferences have been saved successfully.'
      });
    } else {
      toast({
        title: 'Save Failed',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle reset settings
  const handleReset = async () => {
    const success = await resetSettings();
    if (success) {
      toast({
        title: 'Settings Reset',
        description: 'All settings have been reset to defaults.'
      });
    } else {
      toast({
        title: 'Reset Failed',
        description: 'Failed to reset settings. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle export settings
  const handleExport = () => {
    const settingsJson = exportSettings();
    if (settingsJson) {
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'v2v-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Settings Exported',
        description: 'Settings have been exported to file.'
      });
    }
  };

  // Handle import settings
  const handleImport = async () => {
    if (!importData.trim()) {
      toast({
        title: 'Import Error',
        description: 'Please provide settings data to import.',
        variant: 'destructive'
      });
      return;
    }

    const success = await importSettings(importData);
    if (success) {
      setImportData('');
      toast({
        title: 'Settings Imported',
        description: 'Settings have been imported successfully.'
      });
    } else {
      toast({
        title: 'Import Failed',
        description: 'Failed to import settings. Please check the data format.',
        variant: 'destructive'
      });
    }
  };

  // Handle night mode toggle
  const handleNightModeToggle = (enabled: boolean) => {
    updateSetting('nightMode', enabled, true);
    setTheme(enabled ? 'dark' : 'light');
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div data-testid="loading-spinner" className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          V2V Settings
        </CardTitle>
        <CardDescription>
          Configure communication channels and preferences
        </CardDescription>
        {hasUnsavedChanges && (
          <Badge variant="secondary" className="w-fit">
            Unsaved Changes
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="communication">
              <Wifi className="h-4 w-4 mr-2" />
              Communication
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Volume2 className="h-4 w-4 mr-2" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="discovery">
              <Settings className="h-4 w-4 mr-2" />
              Discovery
            </TabsTrigger>
            <TabsTrigger value="general">
              {theme === 'dark' ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
              General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="communication" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel">Communication Channel</Label>
                <Select
                  value={settings.communicationChannel.toString()}
                  onValueChange={(value) => updateSetting('communicationChannel', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((channel) => (
                      <SelectItem key={channel} value={channel.toString()}>
                        Channel {channel} {channel === 5 && <Badge variant="secondary" className="ml-2">Recommended</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Current channel: {settings.communicationChannel}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-channel">Auto Channel Selection</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically switch to clearest channel
                  </p>
                </div>
                <Switch
                  id="auto-channel"
                  checked={settings.autoChannelSelection}
                  onCheckedChange={(checked) => updateSetting('autoChannelSelection', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice-quality">Voice Quality Threshold: {settings.voiceQualityThreshold}%</Label>
                <Slider
                  id="voice-quality"
                  min={0}
                  max={100}
                  step={5}
                  value={[settings.voiceQualityThreshold]}
                  onValueChange={([value]) => updateSetting('voiceQualityThreshold', value)}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum quality required for voice communication
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sound-alerts">Sound Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sounds for notifications
                  </p>
                </div>
                <Switch
                  id="sound-alerts"
                  checked={settings.alertPreferences.soundEnabled}
                  onCheckedChange={(checked) => updateNestedSetting('alertPreferences', 'soundEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="vibration-alerts">Vibration Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Vibrate device for notifications
                  </p>
                </div>
                <Switch
                  id="vibration-alerts"
                  checked={settings.alertPreferences.vibrationEnabled}
                  onCheckedChange={(checked) => updateNestedSetting('alertPreferences', 'vibrationEnabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brightness">Display Brightness: {settings.alertPreferences.displayBrightness}%</Label>
                <Slider
                  id="brightness"
                  min={10}
                  max={100}
                  step={10}
                  value={[settings.alertPreferences.displayBrightness]}
                  onValueChange={([value]) => updateNestedSetting('alertPreferences', 'displayBrightness', value)}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Screen brightness for alert notifications
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="discovery" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scan-interval">Scan Interval: {settings.discoverySettings.scanInterval / 1000}s</Label>
                <Slider
                  id="scan-interval"
                  min={1000}
                  max={30000}
                  step={1000}
                  value={[settings.discoverySettings.scanInterval]}
                  onValueChange={([value]) => updateNestedSetting('discoverySettings', 'scanInterval', value)}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  How often to scan for nearby devices
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-range">Max Range: {settings.discoverySettings.maxRange}m</Label>
                <Slider
                  id="max-range"
                  min={100}
                  max={1000}
                  step={50}
                  value={[settings.discoverySettings.maxRange]}
                  onValueChange={([value]) => updateNestedSetting('discoverySettings', 'maxRange', value)}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum distance for device discovery
                </p>
              </div>

              <div className="space-y-2">
                <Label>Device Filters</Label>
                <div className="flex flex-wrap gap-2">
                  {['vehicle', 'emergency', 'infrastructure'].map((type) => (
                    <Badge
                      key={type}
                      variant={settings.discoverySettings.deviceFilters.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        const filters = settings.discoverySettings.deviceFilters;
                        const newFilters = filters.includes(type)
                          ? filters.filter(f => f !== type)
                          : [...filters, type];
                        updateNestedSetting('discoverySettings', 'deviceFilters', newFilters);
                      }}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Click to toggle device types to discover
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="night-mode">Night Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Switch to dark theme with reduced brightness
                  </p>
                </div>
                <Switch
                  id="night-mode"
                  checked={settings.nightMode}
                  onCheckedChange={handleNightModeToggle}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Settings Management</h4>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImport}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import
                  </Button>
                </div>

                {importData && (
                  <div className="space-y-2">
                    <Label htmlFor="import-data">Import Data</Label>
                    <textarea
                      id="import-data"
                      className="w-full h-20 p-2 border rounded text-sm"
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder="Paste settings JSON here..."
                    />
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}