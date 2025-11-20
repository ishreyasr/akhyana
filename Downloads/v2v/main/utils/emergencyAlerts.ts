// Emergency alert broadcasting utilities for V2V communication

import { EmergencyAlert, AlertBroadcastResult, NearbyDevice } from '../types/v2v.types';

export class EmergencyAlertService {
  private alertHistory: EmergencyAlert[] = [];
  private onAlertReceivedCallbacks: Array<(alert: EmergencyAlert) => void> = [];
  private maxHistorySize = 50;

  /**
   * Broadcast an emergency alert to nearby vehicles
   */
  async broadcastAlert(alert: Omit<EmergencyAlert, 'id' | 'timestamp'>): Promise<AlertBroadcastResult> {
    const fullAlert: EmergencyAlert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date()
    };

    try {
      // Add to history
      this.addToHistory(fullAlert);

      // Simulate broadcasting to nearby devices
      const recipientCount = await this.simulateBroadcast(fullAlert);

      console.log(`Emergency alert broadcasted: ${fullAlert.type} to ${recipientCount} recipients`);

      return {
        success: true,
        recipientCount,
        failedRecipients: [],
        broadcastId: fullAlert.id
      };
    } catch (error) {
      console.error('Failed to broadcast emergency alert:', error);
      return {
        success: false,
        recipientCount: 0,
        failedRecipients: ['broadcast-failed'],
        broadcastId: fullAlert.id
      };
    }
  }

  /**
   * Subscribe to incoming emergency alerts
   */
  subscribeToAlerts(callback: (alert: EmergencyAlert) => void): void {
    this.onAlertReceivedCallbacks.push(callback);
  }

  /**
   * Get alert history
   */
  getAlertHistory(): EmergencyAlert[] {
    return [...this.alertHistory].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get active alerts (less than 5 minutes old)
   */
  getActiveAlerts(): EmergencyAlert[] {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.alertHistory.filter(alert => alert.timestamp > fiveMinutesAgo);
  }

  /**
   * Clear expired alerts from history
   */
  clearExpiredAlerts(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > fiveMinutesAgo);
  }

  /**
   * Simulate receiving an alert from another vehicle
   */
  simulateIncomingAlert(alert: EmergencyAlert): void {
    this.addToHistory(alert);
    this.notifyAlertReceived(alert);
  }

  /**
   * Get alert priority score for sorting
   */
  getAlertPriority(alert: EmergencyAlert): number {
    const typeScores = {
      medical: 4,
      accident: 3,
      hazard: 2,
      breakdown: 1
    };

    const severityScores = {
      high: 3,
      medium: 2,
      low: 1
    };

    return typeScores[alert.type] * severityScores[alert.severity];
  }

  /**
   * Create quick emergency alert templates
   */
  getQuickAlertTemplates(): Array<Omit<EmergencyAlert, 'id' | 'timestamp' | 'senderId' | 'location'>> {
    return [
      {
        type: 'accident',
        message: 'Vehicle accident ahead - proceed with caution',
        severity: 'high'
      },
      {
        type: 'breakdown',
        message: 'Vehicle breakdown - requesting assistance',
        severity: 'medium'
      },
      {
        type: 'hazard',
        message: 'Road hazard detected - debris on roadway',
        severity: 'medium'
      },
      {
        type: 'medical',
        message: 'Medical emergency - requesting immediate assistance',
        severity: 'high'
      }
    ];
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add alert to history with size limit
   */
  private addToHistory(alert: EmergencyAlert): void {
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Simulate broadcasting to nearby devices
   */
  private async simulateBroadcast(alert: EmergencyAlert): Promise<number> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate random number of recipients (3-8 nearby vehicles)
    const recipientCount = Math.floor(Math.random() * 6) + 3;
    
    // Update alert with recipient count
    alert.recipientCount = recipientCount;

    return recipientCount;
  }

  /**
   * Notify subscribers of received alert
   */
  private notifyAlertReceived(alert: EmergencyAlert): void {
    this.onAlertReceivedCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in alert received callback:', error);
      }
    });
  }
}

// Singleton instance
export const emergencyAlertService = new EmergencyAlertService();