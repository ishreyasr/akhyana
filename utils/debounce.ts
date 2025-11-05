/**
 * Debounce utility for performance optimization
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();
  
  static startMeasurement(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      
      const measurements = this.measurements.get(name)!;
      measurements.push(duration);
      
      // Keep only last 100 measurements
      if (measurements.length > 100) {
        measurements.shift();
      }
      
      // Log if measurement is unusually slow
      if (duration > 100) {
        console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  }
  
  static getAverageTime(name: string): number {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) return 0;
    
    const sum = measurements.reduce((acc, time) => acc + time, 0);
    return sum / measurements.length;
  }
  
  static getStats(name: string) {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0 };
    }
    
    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      average: this.getAverageTime(name),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }
  
  static getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }
  
  static reset(name?: string) {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }
}

/**
 * Battery optimization utilities
 */
export class BatteryOptimizer {
  private static isLowPowerMode = false;
  private static batteryLevel = 1.0;
  
  static async initialize() {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.batteryLevel = battery.level;
        this.isLowPowerMode = battery.level < 0.2;
        
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.isLowPowerMode = battery.level < 0.2;
        });
      } catch (error) {
        console.warn('Battery API not available:', error);
      }
    }
  }
  
  static isLowPower(): boolean {
    return this.isLowPowerMode;
  }
  
  static getBatteryLevel(): number {
    return this.batteryLevel;
  }
  
  static getOptimalScanInterval(): number {
    if (this.isLowPowerMode) {
      return 10000; // 10 seconds in low power mode
    } else if (this.batteryLevel < 0.5) {
      return 7000; // 7 seconds when battery is medium
    } else {
      return 5000; // 5 seconds when battery is good
    }
  }
  
  static getOptimalUpdateFrequency(): number {
    if (this.isLowPowerMode) {
      return 2000; // 2 seconds in low power mode
    } else if (this.batteryLevel < 0.5) {
      return 1000; // 1 second when battery is medium
    } else {
      return 500; // 500ms when battery is good
    }
  }
}

// Initialize battery optimizer
if (typeof window !== 'undefined') {
  BatteryOptimizer.initialize();
}