// Lightweight Web Serial transport with auto-reconnect capability
// Guards runtime usage so it is safe during SSR / tests where navigator.serial is absent.

type MessageListener = (data: unknown) => void;
type StatusListener = (status: HardwareTransportStatus) => void;

export interface HardwareTransportStatus {
    connected: boolean;
    initializing: boolean;
    reconnecting: boolean;
    attempt: number;
    portName?: string;
    error?: string;
    lastEventTs?: number;
}

interface StoredPortMeta {
    vendorId?: number;
    productId?: number;
}

// Minimal type declarations for Web Serial (in case lib.dom doesn't have them)
interface SerialPortLike {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface NavigatorSerialLike {
    requestPort(options?: any): Promise<SerialPortLike>;
    getPorts(): Promise<SerialPortLike[]>;
}

const STORAGE_KEY = 'v2v_hw_port_meta';

export class HardwareTransport {
    private port: SerialPortLike | null = null;
    private reader: ReadableStreamDefaultReader<string> | null = null;
    private textDecoder: TextDecoderStream | null = null;
    private isActive = false;
    private autoReconnect = true;
    private reconnectAttempt = 0;
    private maxBackoff = 15000; // ms
    private baseBackoff = 1000; // ms
    private messageListeners: MessageListener[] = [];
    private statusListeners: StatusListener[] = [];
    private status: HardwareTransportStatus = {
        connected: false,
        initializing: false,
        reconnecting: false,
        attempt: 0
    };

    onMessage(cb: MessageListener) {
        this.messageListeners.push(cb);
    }

    onStatus(cb: StatusListener) {
        this.statusListeners.push(cb);
        cb(this.status); // emit current snapshot
    }

    private updateStatus(patch: Partial<HardwareTransportStatus>) {
        this.status = { ...this.status, ...patch, lastEventTs: Date.now() };
        this.statusListeners.forEach(l => l(this.status));
    }

    private get navigatorSerial(): NavigatorSerialLike | null {
        if (typeof navigator === 'undefined') return null;
        return (navigator as any).serial || null;
    }

    async connect(requestPort: boolean = true): Promise<void> {
        if (!this.navigatorSerial) {
            this.updateStatus({ error: 'Web Serial unsupported', initializing: false, connected: false });
            return;
        }
        if (this.status.initializing) return;
        this.updateStatus({ initializing: true, error: undefined });
        try {
            let port: SerialPortLike | undefined;
            if (requestPort) {
                port = await this.navigatorSerial!.requestPort();
                // store metadata for future silent reconnect
                try {
                    const info = port.getInfo();
                    const meta: StoredPortMeta = { vendorId: info.usbVendorId, productId: info.usbProductId };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
                } catch { }
            } else {
                // attempt silent retrieval
                const storedRaw = localStorage.getItem(STORAGE_KEY);
                let candidate: StoredPortMeta | null = null;
                if (storedRaw) {
                    try { candidate = JSON.parse(storedRaw); } catch { candidate = null; }
                }
                const ports = await this.navigatorSerial!.getPorts();
                if (candidate) {
                    port = ports.find(p => {
                        const info = p.getInfo();
                        return info.usbVendorId === candidate!.vendorId && info.usbProductId === candidate!.productId;
                    });
                }
                // fallback: first available
                if (!port && ports.length) port = ports[0];
            }

            if (!port) {
                this.updateStatus({ initializing: false, connected: false, error: requestPort ? 'No port selected' : 'No retained ports' });
                return;
            }
            this.port = port;
            await this.port.open({ baudRate: 115200 });
            this.isActive = true;
            this.reconnectAttempt = 0;
            this.updateStatus({ connected: true, initializing: false, reconnecting: false, attempt: 0, portName: this.describePort(port) });
            this.startReadLoop();
        } catch (err: any) {
            this.updateStatus({ initializing: false, connected: false, error: err?.message || 'Connect failed' });
            // schedule reconnect if not user-cancelled selection
            if (!requestPort) this.scheduleReconnect();
        }
    }

    private describePort(port: SerialPortLike): string {
        try {
            const info = port.getInfo();
            if (info.usbVendorId || info.usbProductId) {
                return `VID:${info.usbVendorId?.toString(16)} PID:${info.usbProductId?.toString(16)}`;
            }
        } catch { }
        return 'SerialPort';
    }

    private async startReadLoop() {
        if (!this.port || !this.port.readable) return;
        this.textDecoder = new TextDecoderStream();
        const readable = (this.port.readable as any).pipeTo(this.textDecoder.writable).catch(() => { });
        const reader = this.textDecoder.readable.getReader();
        this.reader = reader;
        let buffer = '';
        try {
            while (this.isActive) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    buffer += value;
                    let idx;
                    while ((idx = buffer.indexOf('\n')) >= 0) {
                        const line = buffer.slice(0, idx).trim();
                        buffer = buffer.slice(idx + 1);
                        if (line.length === 0) continue;
                        let parsed: unknown = line;
                        try { parsed = JSON.parse(line); } catch { }
                        this.messageListeners.forEach(l => l(parsed));
                    }
                }
            }
        } catch (err: any) {
            this.updateStatus({ error: err?.message || 'Read error' });
        } finally {
            if (this.isActive) {
                // unexpected termination
                this.handleUnexpectedDisconnect();
            }
        }
    }

    private handleUnexpectedDisconnect() {
        this.updateStatus({ connected: false });
        if (this.autoReconnect) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (!this.navigatorSerial) return;
        this.reconnectAttempt += 1;
        const attempt = this.reconnectAttempt;
        const delay = Math.min(this.baseBackoff * Math.pow(2, attempt - 1), this.maxBackoff);
        this.updateStatus({ reconnecting: true, attempt });
        setTimeout(() => {
            // Ensure we still want to reconnect and haven't connected manually in the meantime
            if (!this.status.connected) {
                this.connect(false);
            }
        }, delay);
    }

    async write(obj: unknown): Promise<void> {
        if (!this.port || !this.port.writable) throw new Error('Not connected');
        const writer = (this.port.writable as WritableStream).getWriter();
        try {
            const data = (typeof obj === 'string' ? obj : JSON.stringify(obj)) + '\n';
            const enc = new TextEncoder();
            await writer.write(enc.encode(data));
        } finally {
            writer.releaseLock();
        }
    }

    async disconnect() {
        this.autoReconnect = false;
        this.isActive = false;
        try { await this.reader?.cancel(); } catch { }
        try { await this.port?.close(); } catch { }
        this.updateStatus({ connected: false, reconnecting: false, attempt: 0 });
    }
}

export const hardwareTransportSingleton = new HardwareTransport();
