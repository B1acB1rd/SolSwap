import { memStore } from '../store/mem.js';

export interface Metrics {
  timestamp: string;
  requests: {
    total: number;
    successful: number;
    failed: number;
    rateLimited: number;
  };
  sessions: {
    active: number;
    completed: number;
    abandoned: number;
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    critical: number;
  };
}

export interface Alert {
  id: string;
  type: 'error_rate' | 'response_time' | 'rate_limit' | 'system_health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  metadata?: any;
}

class MonitoringService {
  private metrics: Metrics[] = [];
  private alerts: Alert[] = [];
  private requestTimes: number[] = [];
  private errorCounts: Map<string, number> = new Map();
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private rateLimitedRequests = 0;

  // Metrics collection
  recordRequest(responseTime: number, success: boolean, rateLimited: boolean = false): void {
    this.totalRequests++;
    this.requestTimes.push(responseTime);
    
    if (rateLimited) {
      this.rateLimitedRequests++;
    } else if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    // Keep only last 1000 response times for performance metrics
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }
  }

  recordError(errorType: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const currentCount = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, currentCount + 1);

    // Create alert for critical errors
    if (severity === 'critical') {
      this.createAlert('error_rate', 'critical', `Critical error: ${errorType}`, {
        errorType,
        count: currentCount + 1
      });
    }
  }

  createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    message: string,
    metadata?: any
  ): void {
    const alert: Alert = {
      id: crypto.randomUUID(),
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log critical alerts
    if (severity === 'critical') {
      console.error(`[CRITICAL ALERT] ${message}`, metadata);
    }
  }

  // Metrics calculation
  getCurrentMetrics(): Metrics {
    const analytics = memStore.getAnalytics();
    const now = new Date().toISOString();

    // Calculate performance metrics
    const sortedTimes = [...this.requestTimes].sort((a, b) => a - b);
    const averageResponseTime = this.requestTimes.length > 0 
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length 
      : 0;
    
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;

    // Calculate error metrics
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    const criticalErrors = this.alerts.filter(a => a.severity === 'critical' && !a.resolved).length;

    return {
      timestamp: now,
      requests: {
        total: this.totalRequests,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        rateLimited: this.rateLimitedRequests
      },
      sessions: {
        active: analytics.activeSessions,
        completed: analytics.completedOrders,
        abandoned: analytics.totalSessions - analytics.activeSessions
      },
      orders: {
        total: analytics.totalOrders,
        pending: analytics.totalOrders - analytics.completedOrders - analytics.failedOrders,
        completed: analytics.completedOrders,
        failed: analytics.failedOrders
      },
      performance: {
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime
      },
      errors: {
        total: totalErrors,
        byType: Object.fromEntries(this.errorCounts),
        critical: criticalErrors
      }
    };
  }

  // Health checks
  isSystemHealthy(): { healthy: boolean; issues: string[] } {
    const metrics = this.getCurrentMetrics();
    const issues: string[] = [];

    // Check error rate
    const errorRate = metrics.requests.total > 0 
      ? (metrics.requests.failed / metrics.requests.total) * 100 
      : 0;
    
    if (errorRate > 10) {
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
    }

    // Check response time
    if (metrics.performance.averageResponseTime > 5000) {
      issues.push(`Slow response time: ${metrics.performance.averageResponseTime}ms`);
    }

    // Check critical errors
    if (metrics.errors.critical > 0) {
      issues.push(`${metrics.errors.critical} critical errors`);
    }

    // Check rate limiting
    const rateLimitRate = metrics.requests.total > 0 
      ? (metrics.requests.rateLimited / metrics.requests.total) * 100 
      : 0;
    
    if (rateLimitRate > 20) {
      issues.push(`High rate limiting: ${rateLimitRate.toFixed(2)}%`);
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  }

  // Alert management
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  // Historical metrics
  getHistoricalMetrics(hours: number = 24): Metrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(m => new Date(m.timestamp) > cutoff);
  }

  // Cleanup old data
  cleanup(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Clean up old metrics
    this.metrics = this.metrics.filter(m => new Date(m.timestamp) > cutoff);
    
    // Clean up old alerts
    this.alerts = this.alerts.filter(a => new Date(a.timestamp) > cutoff);
    
    // Clean up old request times (keep last 1000)
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }
  }

  // Dashboard data
  getDashboardData(): {
    metrics: Metrics;
    alerts: Alert[];
    health: { healthy: boolean; issues: string[] };
    trends: {
      requestTrend: number[];
      errorTrend: number[];
      responseTimeTrend: number[];
    };
  } {
    const metrics = this.getCurrentMetrics();
    const alerts = this.getActiveAlerts();
    const health = this.isSystemHealthy();
    const historical = this.getHistoricalMetrics(24);

    // Calculate trends (simplified)
    const requestTrend = historical.map(m => m.requests.total);
    const errorTrend = historical.map(m => m.errors.total);
    const responseTimeTrend = historical.map(m => m.performance.averageResponseTime);

    return {
      metrics,
      alerts,
      health,
      trends: {
        requestTrend,
        errorTrend,
        responseTimeTrend
      }
    };
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

// Auto-cleanup every hour
setInterval(() => {
  monitoringService.cleanup();
}, 60 * 60 * 1000);

// Health check endpoint data
export function getHealthCheckData(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  metrics: Metrics;
  alerts: Alert[];
} {
  const health = monitoringService.isSystemHealthy();
  const metrics = monitoringService.getCurrentMetrics();
  const alerts = monitoringService.getActiveAlerts();

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (alerts.some(a => a.severity === 'critical')) {
    status = 'unhealthy';
  } else if (alerts.length > 0 || !health.healthy) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    metrics,
    alerts
  };
}
