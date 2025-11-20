// Custom hook for managing emergency alerts state

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmergencyAlert, AlertBroadcastResult } from '../types/v2v.types';
import { useToast } from './use-toast';
import { emergencyAlertService } from '../utils/emergencyAlerts';
import { webSocketService } from '../utils/websocketService';

export function useEmergencyAlerts() {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acknowledged = useRef<Set<string>>(new Set());
  const toasted = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Load acknowledged IDs from sessionStorage (simple persistence)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('acknowledgedAlerts');
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        acknowledged.current = new Set(arr);
      }
    } catch { }
  }, []);

  const persistAcknowledged = () => {
    try { sessionStorage.setItem('acknowledgedAlerts', JSON.stringify([...acknowledged.current])); } catch { }
  };

  /**
   * Broadcast an emergency alert
   */
  const broadcastAlert = useCallback(async (
    alertData: Omit<EmergencyAlert, 'id' | 'timestamp'>
  ): Promise<AlertBroadcastResult | null> => {
    if (isBroadcasting) {
      setError('Already broadcasting an alert');
      return null;
    }

    try {
      setIsBroadcasting(true);
      setError(null);

      const result = await emergencyAlertService.broadcastAlert(alertData);

      if (result.success) {
        // Refresh alerts to include the new one
        refreshAlerts();

        // Broadcast via WebSocket for real-time updates
        const fullAlert: EmergencyAlert = {
          ...alertData,
          id: result.broadcastId,
          timestamp: new Date()
        };
        webSocketService.broadcastEmergencyAlert(fullAlert);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to broadcast alert';
      setError(errorMessage);
      return {
        success: false,
        recipientCount: 0,
        failedRecipients: ['broadcast-error'],
        broadcastId: 'failed'
      };
    } finally {
      setIsBroadcasting(false);
    }
  }, [isBroadcasting]);

  /**
   * Broadcast quick alert using templates
   */
  const broadcastQuickAlert = useCallback(async (
    alertType: EmergencyAlert['type'],
    location: { lat: number; lng: number },
    senderId: string
  ): Promise<AlertBroadcastResult | null> => {
    const templates = emergencyAlertService.getQuickAlertTemplates();
    const template = templates.find(t => t.type === alertType);

    if (!template) {
      setError(`No template found for alert type: ${alertType}`);
      return null;
    }

    return broadcastAlert({
      ...template,
      location,
      senderId
    });
  }, [broadcastAlert]);

  /**
   * Refresh alerts from service
   */
  const refreshAlerts = useCallback(() => {
    const allAlerts = emergencyAlertService.getAlertHistory();
    const currentActiveAlerts = emergencyAlertService.getActiveAlerts();

    setAlerts(allAlerts);
    setActiveAlerts(currentActiveAlerts);
  }, []);

  /**
   * Clear expired alerts
   */
  const clearExpiredAlerts = useCallback(() => {
    emergencyAlertService.clearExpiredAlerts();
    refreshAlerts();
  }, [refreshAlerts]);

  /**
   * Get alerts by type
   */
  const getAlertsByType = useCallback((alertType: EmergencyAlert['type']) => {
    return alerts.filter(alert => alert.type === alertType);
  }, [alerts]);

  /**
   * Get alerts by severity
   */
  const getAlertsBySeverity = useCallback((severity: EmergencyAlert['severity']) => {
    return alerts.filter(alert => alert.severity === severity);
  }, [alerts]);

  /**
   * Get prioritized alerts (sorted by priority score)
   */
  const getPrioritizedAlerts = useCallback(() => {
    return [...activeAlerts].sort((a, b) => {
      const priorityA = emergencyAlertService.getAlertPriority(a);
      const priorityB = emergencyAlertService.getAlertPriority(b);
      return priorityB - priorityA; // Higher priority first
    });
  }, [activeAlerts]);

  /**
   * Get quick alert templates
   */
  const getQuickAlertTemplates = useCallback(() => {
    return emergencyAlertService.getQuickAlertTemplates();
  }, []);

  /**
   * Set up emergency alert service subscription
   */
  useEffect(() => {
    const handleIncomingAlert = (alert: EmergencyAlert) => {
      const acked = acknowledged.current.has(alert.id);
      const enriched: EmergencyAlert = { ...alert, acknowledged: acked };
      setAlerts(prev => [enriched, ...prev]);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (!acked && alert.timestamp > fiveMinutesAgo) {
        setActiveAlerts(prev => [enriched, ...prev]);
      }
      if (!toasted.current.has(alert.id) && !acked) {
        toasted.current.add(alert.id);
        try {
          toast({
            title: 'Emergency Alert',
            description: `${alert.type.toUpperCase()}: ${alert.message}`,
            variant: 'destructive'
          });
        } catch {
          try { console.log('ALERT_TOAST', alert.message); } catch { }
        }
      }
    };

    emergencyAlertService.subscribeToAlerts(handleIncomingAlert);

    // Initial load
    refreshAlerts();

    return () => {
      // Note: emergencyAlertService doesn't have unsubscribe in our implementation
      // In a real implementation, you'd want to add that method
    };
  }, [refreshAlerts]);

  /**
   * Set up WebSocket subscription for remote alerts
   */
  useEffect(() => {
    const handleRemoteAlert = (payload: EmergencyAlert) => {
      // Simulate receiving alert from another vehicle
      emergencyAlertService.simulateIncomingAlert(payload);
    };

    webSocketService.subscribe('emergency_alert', handleRemoteAlert);

    return () => {
      webSocketService.unsubscribe('emergency_alert', handleRemoteAlert);
    };
  }, []);

  /**
   * Set up periodic cleanup of expired alerts
   */
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      clearExpiredAlerts();
    }, 60000); // Check every minute

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [clearExpiredAlerts]);

  /**
   * Simulate receiving an alert (for testing)
   */
  const simulateIncomingAlert = useCallback((alert: EmergencyAlert) => {
    emergencyAlertService.simulateIncomingAlert(alert);
  }, []);

  const acknowledgeAlert = useCallback((id: string) => {
    if (!acknowledged.current.has(id)) {
      acknowledged.current.add(id);
      persistAcknowledged();
    }
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setActiveAlerts([]);
  }, []);

  const unacknowledgedActive = activeAlerts.filter(a => !acknowledged.current.has(a.id));

  return {
    alerts,
    activeAlerts,
    unacknowledgedActive,
    isBroadcasting,
    error,
    broadcastAlert,
    broadcastQuickAlert,
    refreshAlerts,
    clearExpiredAlerts,
    getAlertsByType,
    getAlertsBySeverity,
    getPrioritizedAlerts,
    getQuickAlertTemplates,
    simulateIncomingAlert,
    acknowledgeAlert,
    clearAllAlerts,
    acknowledgedIds: acknowledged.current
  };
}