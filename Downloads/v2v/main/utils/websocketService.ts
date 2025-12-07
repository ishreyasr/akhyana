// WebSocket service for real-time V2V communication updates

import { WebSocketMessage, NearbyDevice, EmergencyAlert, VehicleStatus, V2VErrorEvent } from '../types/v2v.types';
import { PerformanceMonitor, debounce } from './debounce';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50; // allow long-running
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private isConnecting = false;
  private messageHandlers: Map<string, Array<(payload: any) => void>> = new Map();
  private url: string;
  private vehicleId: string | null = null;
  private registered = false;
  private deferredLocation: { lat: number; lon: number } | null = null;
  private heartbeatTimer: any = null;
  private pendingRegisterPayload: any = null;
  private cleanupCallbacks: Array<() => void> = [];
  private messageQueue: Array<{ type: string; payload: any }> = [];
  private isProcessingQueue = false;
  private autoConnect = true;
  private connectionStateCallbacks: Array<(state: string, details?: any) => void> = [];

  constructor(url: string = (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_V2V_WS || 'ws://localhost:3002/v2v') : 'ws://localhost:3002/v2v')) {
    this.url = url;

    // Defer auto-connection to avoid SSR hydration mismatch
    if (typeof window !== 'undefined') {
      // Use setTimeout to defer until after hydration
      setTimeout(() => {
        console.log('[WebSocketService] Auto-connecting to V2V backend...');
        this.autoConnectWithRetry();
      }, 100);
    }
  }

  /**
   * Auto-connect with retry logic
   */
  private async autoConnectWithRetry(): Promise<void> {
    if (!this.autoConnect) return;

    try {
      const connected = await this.connect();
      if (connected) {
        console.log('[WebSocketService] Auto-connection successful');
      }
    } catch (error) {
      console.warn('[WebSocketService] Auto-connection failed, will retry...', error);
      // Will retry through normal reconnection logic
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketService] Already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('[WebSocketService] Connection already in progress');
      return new Promise((resolve) => {
        const checkConnection = () => {
          if (!this.isConnecting) {
            resolve(this.ws?.readyState === WebSocket.OPEN);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    this.isConnecting = true;
    this.emitConnectionState('connecting');
    console.log(`[WebSocketService] Connecting to ${this.url}...`);

    try {
      // Close existing connection if any
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocketService] WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emitConnectionState('connected');

        // Auto-register if payload queued
        if (this.pendingRegisterPayload) {
          console.log('[WebSocketService] Auto-registering vehicle...');
          this.sendEvent('register', this.pendingRegisterPayload);
        }

        // Process any queued messages
        this.processMessageQueue();

        // Start heartbeat if vehicleId known
        if (this.vehicleId) {
          this.startHeartbeat();
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocketService] WebSocket disconnected: ${event.code} ${event.reason}`);
        if (event.code === 1006) {
          console.warn('[WebSocketService] Abnormal closure (1006) – likely network/server issue');
        }
        this.isConnecting = false;
        this.emitConnectionState('disconnected', { code: event.code, reason: event.reason });

        // Auto-reconnect if enabled
        if (this.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocketService] WebSocket error:', error);
        this.isConnecting = false;
        this.emitConnectionState('error', { error: (error as any)?.message });

        // Auto-reconnect on error if enabled
        if (this.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => this.handleReconnect(), 1000);
        }
      };

      // Wait for connection to open with timeout
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.error('[WebSocketService] Connection timeout');
          this.isConnecting = false;
          resolve(false);
        }, 10000); // 10 second timeout

        if (this.ws) {
          this.ws.addEventListener('open', () => {
            clearTimeout(timeout);
            resolve(true);
          }, { once: true });

          this.ws.addEventListener('error', () => {
            clearTimeout(timeout);
            this.isConnecting = false;
            resolve(false);
          }, { once: true });
        }
      });

    } catch (error) {
      console.error('[WebSocketService] Failed to create WebSocket connection:', error);
      this.emitConnectionState('error', { error: (error as any)?.message });
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Disconnect from WebSocket server with proper cleanup
   */
  disconnect(): void {
    console.log('[WebSocketService] Disconnecting...');
    const endMeasurement = PerformanceMonitor.startMeasurement('websocket-disconnect');

    // Disable auto-reconnect
    this.autoConnect = false;

    // Execute cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in cleanup callback:', error);
      }
    });
    this.cleanupCallbacks = [];

    // Stop heartbeat
    this.stopHeartbeat();

    // Clear message handlers
    this.messageHandlers.clear();

    // Clear message queue
    this.messageQueue = [];

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    this.registered = false;
    this.vehicleId = null;
    this.pendingRegisterPayload = null;

    this.emitConnectionState('disconnected', { reason: 'manual_disconnect' });
    endMeasurement();
  }

  /**
   * Enable auto-connection
   */
  enableAutoConnect(): void {
    this.autoConnect = true;
    if (!this.isConnected()) {
      this.autoConnectWithRetry();
    }
  }

  /**
   * Disable auto-connection
   */
  disableAutoConnect(): void {
    this.autoConnect = false;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Force reconnect
   */
  async reconnect(): Promise<boolean> {
    console.log('[WebSocketService] Force reconnecting...');
    if (this.ws) {
      this.ws.close();
    }
    this.reconnectAttempts = 0;
    return this.connect();
  }

  /**
   * Add cleanup callback for proper resource management
   */
  addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * Send message to server with queuing and performance monitoring
   */
  private sendEvent(event: string, data: any): boolean {
    const endMeasurement = PerformanceMonitor.startMeasurement('websocket-send');

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push({ type: event, payload: data });
      console.warn('WebSocket not connected, message queued');
      endMeasurement();
      return false;
    }

    try {
      this.ws.send(JSON.stringify({ event, data }));
      endMeasurement();
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      endMeasurement();
      return false;
    }
  }

  // Backward compatibility wrapper (legacy callers used sendMessage(type,payload))
  sendMessage(type: string, payload: any): boolean {
    return this.sendEvent(type, payload);
  }

  /**
   * Process queued messages when connection is restored
   */
  private processMessageQueue(): void {
    if (this.isProcessingQueue || this.messageQueue.length === 0) return;

    this.isProcessingQueue = true;
    const endMeasurement = PerformanceMonitor.startMeasurement('websocket-queue-processing');

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    messages.forEach(({ type, payload }) => {
      this.sendEvent(type, payload);
    });

    this.isProcessingQueue = false;
    endMeasurement();
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: string, handler: (payload: any) => void): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  /**
   * Unsubscribe from message type
   */
  unsubscribe(messageType: string, handler: (payload: any) => void): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.CLOSED:
      case WebSocket.CLOSING:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  /**
   * Debounced broadcast methods for performance optimization
   */
  private debouncedBroadcastDeviceDiscovery = debounce((device: NearbyDevice) => {
    if (!this.registered) return; // avoid sending before backend knows us
    // Only send if backend supports (currently not implemented server-side; keep feature flag)
    if (typeof (window as any) !== 'undefined' && (window as any).__V2V_ENABLE_PEER_DEVICE_EVENTS__) {
      this.sendMessage('device_discovered', device);
    }
  }, 200);

  private debouncedBroadcastDeviceLost = debounce((deviceId: string) => {
    if (!this.registered) return;
    if (typeof (window as any) !== 'undefined' && (window as any).__V2V_ENABLE_PEER_DEVICE_EVENTS__) {
      this.sendMessage('device_lost', { deviceId });
    }
  }, 200);

  private debouncedBroadcastStatusUpdate = debounce((status: VehicleStatus) => {
    this.sendMessage('status_update', status);
  }, 500);

  /**
   * Broadcast device discovery (debounced)
   */
  broadcastDeviceDiscovery(device: NearbyDevice): void {
    this.debouncedBroadcastDeviceDiscovery(device);
  }

  /**
   * Broadcast device lost (debounced)
   */
  broadcastDeviceLost(deviceId: string): void {
    this.debouncedBroadcastDeviceLost(deviceId);
  }

  /**
   * Broadcast emergency alert (immediate - not debounced for safety)
   */
  broadcastEmergencyAlert(alert: EmergencyAlert): void {
    this.sendMessage('emergency_alert', alert);
  }

  /**
   * Broadcast vehicle status update (debounced)
   */
  broadcastStatusUpdate(status: VehicleStatus): void {
    this.debouncedBroadcastStatusUpdate(status);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const parsed = JSON.parse(data);
      // Normalize into {event, data}
      const eventName = parsed.event || parsed.type; // support legacy
      const payload = parsed.data !== undefined ? parsed.data : parsed.payload;

      if (eventName === 'registered' && payload?.vehicleId) {
        this.vehicleId = payload.vehicleId;
        this.registered = true;
        if (this.deferredLocation) {
          const { lat, lon } = this.deferredLocation;
          this.deferredLocation = null;
          this.sendEvent('location_update', { vehicleId: this.vehicleId, lat, lon });
        }
        this.startHeartbeat();
      }
      if (eventName === 'nearby_vehicles') {
        // Flatten nested shape if needed
      }
      const handlers = this.messageHandlers.get(eventName);
      if (handlers) {
        handlers.forEach(h => {
          try { h(payload); } catch (e) { console.error('handler error', e); }
        });
      }
      // Special logging for standardized errors
      if (eventName === 'error' && payload && (payload.code || payload.message)) {
        const err = payload as V2VErrorEvent;
        console.warn('[V2V ERROR]', err.code, err.message, err.details || '');
      } else if (eventName === 'error') {
        console.warn('[V2V ERROR] (empty payload) raw:', parsed);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (!this.autoConnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocketService] Max reconnection attempts reached or auto-connect disabled');
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff with decorrelated jitter
    const exp = this.baseReconnectDelay * Math.pow(2, Math.min(this.reconnectAttempts - 1, 6)); // Cap at 2^6
    const capped = Math.min(exp, this.maxReconnectDelay);
    const jitter = Math.random() * (capped * 0.3);
    const delay = Math.floor(capped * 0.7 + jitter);

    console.log(`[WebSocketService] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.emitConnectionState('reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(async () => {
      try {
        const connected = await this.connect();
        if (connected) {
          console.log('[WebSocketService] Reconnection successful');
          this.emitConnectionState('connected');
        } else {
          console.log('[WebSocketService] Reconnection failed, will retry...');
          this.handleReconnect();
        }
      } catch (error) {
        console.error('[WebSocketService] Reconnection error:', error);
        this.emitConnectionState('error', { error: error instanceof Error ? error.message : 'Unknown error' });
        this.handleReconnect();
      }
    }, delay);
  }

  private emitConnectionState(state: string, extra: any = {}) {
    console.log(`[WebSocketService] Connection state: ${state}`, extra);

    // Emit to registered handlers
    const handlers = this.messageHandlers.get('connection_state');
    if (handlers) {
      handlers.forEach(h => {
        try {
          h({ state, ...extra });
        } catch (e) {
          console.error('Connection state handler error:', e);
        }
      });
    }

    // Emit to direct callbacks
    this.connectionStateCallbacks.forEach(callback => {
      try {
        callback(state, extra);
      } catch (e) {
        console.error('Connection state callback error:', e);
      }
    });
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(callback: (state: string, details?: any) => void): () => void {
    this.connectionStateCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.connectionStateCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionStateCallbacks.splice(index, 1);
      }
    };
  }

  // ---------------- New High-Level API ----------------
  async registerVehicle(params: { vehicleId: string; driverName?: string; batteryLevel?: number; signalStrength?: number; vehicleInfo?: any }): Promise<boolean> {
    this.vehicleId = params.vehicleId;
    this.pendingRegisterPayload = params;

    const licensePlate = params.vehicleInfo?.licensePlate || null;
    console.log('[WebSocketService] Registering vehicle:', params.vehicleId, 'license:', licensePlate, 'battery:', params.batteryLevel, 'signal:', params.signalStrength);

    if (typeof window !== 'undefined' && (window as any).__V2V_DEBUG_CLIENT__) {
      console.debug('[V2V] registerVehicle', params);
    }

    // Ensure we're connected before registering
    if (!this.isConnected()) {
      console.log('[WebSocketService] Not connected, connecting first...');
      const connected = await this.connect();
      if (!connected) {
        console.error('[WebSocketService] Failed to connect for vehicle registration');
        return false;
      }
    }

    // Send registration with battery, signal, and license plate
    const registrationData = {
      ...params,
      licensePlate: licensePlate
    };
    const sent = this.sendEvent('register', registrationData);
    if (sent) {
      console.log('[WebSocketService] Vehicle registration sent successfully');
      return true;
    } else {
      console.error('[WebSocketService] Failed to send vehicle registration');
      return false;
    }
  }

  updateLocation(lat: number, lon: number, battery?: number, signal?: number) {
    if (!this.vehicleId) return;
    if (!this.registered) {
      // Defer until registration completes
      this.deferredLocation = { lat, lon };
      return;
    }
    // Coalescing logic: allow at most 5 sends / sec (every 200ms)
    if (!(this as any)._locState) {
      (this as any)._locState = {
        lastSent: 0,
        pending: null as null | { lat: number; lon: number; battery?: number; signal?: number },
        timer: null as any,
        interval: 200
      };
    }
    const st = (this as any)._locState;
    st.pending = { lat, lon, battery, signal };
    const now = Date.now();
    const dueIn = st.interval - (now - st.lastSent);
    const sendNow = dueIn <= 0;
    const flush = () => {
      if (!st.pending) return;
      if (!this.vehicleId) return;
      const p = st.pending; st.pending = null;
      if (typeof window !== 'undefined' && (window as any).__V2V_DEBUG_CLIENT__) {
        console.debug('[V2V] send location_update', { vehicleId: this.vehicleId, lat: p.lat, lon: p.lon, battery: p.battery, signal: p.signal });
      }
      this.sendEvent('location_update', { vehicleId: this.vehicleId, lat: p.lat, lon: p.lon, batteryLevel: p.battery, signalStrength: p.signal });
      st.lastSent = Date.now();
    };
    if (sendNow) {
      if (st.timer) { clearTimeout(st.timer); st.timer = null; }
      flush();
    } else if (!st.timer) {
      st.timer = setTimeout(() => { st.timer = null; flush(); }, dueIn);
    }
  }

  sendText(recipientId: string, content: string) {
    if (!this.vehicleId) throw new Error('Not registered');
    this.sendEvent('send_message', { senderId: this.vehicleId, recipientId, content, messageType: 'text' });
  }

  sendEmergency(vehicleInfo?: any) {
    if (!this.vehicleId) throw new Error('Not registered');
    this.sendEvent('emergency_alert', { senderId: this.vehicleId, vehicleInfo });
  }

  callInitiate(calleeId: string) {
    if (!this.vehicleId) throw new Error('Not registered');
    // Include targetId for compatibility with relay schema on some server builds
    this.sendEvent('call_initiate', { callerId: this.vehicleId, calleeId, targetId: calleeId });
  }

  // Consent-based connection workflow
  requestConnection(targetId: string, purpose?: string) {
    if (!this.vehicleId) throw new Error('Not registered');
    this.sendEvent('connect_request', { requesterId: this.vehicleId, targetId, purpose });
  }

  respondConnection(requesterId: string, approved: boolean, reason?: string) {
    if (!this.vehicleId) throw new Error('Not registered');
    this.sendEvent('connect_response', { requesterId, targetId: this.vehicleId, approved, reason });
  }

  sendOffer(targetId: string, sdp: any) {
    this.sendEvent('webrtc_offer', { targetId, sdp });
  }

  sendAnswer(targetId: string, sdp: any) {
    this.sendEvent('webrtc_answer', { targetId, sdp });
  }

  sendIceCandidate(targetId: string, candidate: any) {
    this.sendEvent('ice_candidate', { targetId, candidate });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    if (!this.vehicleId) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendEvent('heartbeat', {});
      }
    }, 25000); // 25s interval
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Expose vehicleId
  getVehicleId() { return this.vehicleId; }
}

// Singleton instance
export const webSocketService = new WebSocketService();