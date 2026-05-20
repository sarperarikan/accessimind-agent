/**
 * RPC Latency Tracker
 * 
 * Tracks request/response latency for all gateway RPC calls.
 * Provides metrics for performance monitoring and bottleneck detection.
 */

interface RPCLatencyRecord {
  method: string
  latencyMs: number
  timestamp: number
  success: boolean
  error?: string
}

interface LatencyStats {
  method: string
  count: number
  minMs: number
  maxMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  successRate: number
}

const MAX_RECORDS = 1000
const SAMPLE_SIZE = 100

export class LatencyTracker {
  private records: RPCLatencyRecord[] = []
  private methodRecords: Map<string, number[]> = new Map()
  private methodErrors: Map<string, number> = new Map()
  private methodSuccess: Map<string, number> = new Map()

  /**
   * Record a completed RPC request
   */
  record(method: string, latencyMs: number, success: boolean, error?: string) {
    const record: RPCLatencyRecord = {
      method,
      latencyMs,
      timestamp: Date.now(),
      success,
      error
    }

    this.records.push(record)
    
    // Trim old records
    if (this.records.length > MAX_RECORDS) {
      this.records.shift()
    }

    // Track per-method latencies
    if (!this.methodRecords.has(method)) {
      this.methodRecords.set(method, [])
    }
    const methodLatencies = this.methodRecords.get(method)!
    methodLatencies.push(latencyMs)
    
    if (methodLatencies.length > SAMPLE_SIZE) {
      methodLatencies.shift()
    }

    // Track success/failure
    if (success) {
      this.methodSuccess.set(method, (this.methodSuccess.get(method) || 0) + 1)
    } else {
      this.methodErrors.set(method, (this.methodErrors.get(method) || 0) + 1)
    }
  }

  /**
   * Get latency statistics for a specific method
   */
  getStats(method: string): LatencyStats | null {
    const latencies = this.methodRecords.get(method)
    
    if (!latencies || latencies.length === 0) {
      return null
    }

    const sorted = [...latencies].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((a, b) => a + b, 0)
    const avg = sum / count
    
    const errors = this.methodErrors.get(method) || 0
    const success = this.methodSuccess.get(method) || 0
    const total = errors + success
    const successRate = total > 0 ? (success / total) * 100 : 0

    return {
      method,
      count,
      minMs: sorted[0],
      maxMs: sorted[count - 1],
      avgMs: avg,
      p50Ms: sorted[Math.floor(count * 0.5)],
      p95Ms: sorted[Math.floor(count * 0.95)],
      p99Ms: sorted[Math.floor(count * 0.99)],
      successRate
    }
  }

  /**
   * Get statistics for all methods
   */
  getAllStats(): LatencyStats[] {
    const stats: LatencyStats[] = []
    const methods = Array.from(this.methodRecords.keys())
    
    for (const method of methods) {
      const stat = this.getStats(method)
      if (stat) {
        stats.push(stat)
      }
    }

    return stats.sort((a, b) => b.count - a.count)
  }

  /**
   * Get overall average latency across all methods
   */
  getOverallAvgLatency(): number {
    if (this.records.length === 0) return 0
    
    const sum = this.records.reduce((acc, r) => acc + r.latencyMs, 0)
    return sum / this.records.length
  }

  /**
   * Get recent slow requests (>1000ms)
   */
  getSlowRequests(thresholdMs: number = 1000): RPCLatencyRecord[] {
    return this.records.filter(r => r.latencyMs > thresholdMs)
  }

  /**
   * Get error rate for a method
   */
  getErrorRate(method: string): number {
    const errors = this.methodErrors.get(method) || 0
    const success = this.methodSuccess.get(method) || 0
    const total = errors + success
    return total > 0 ? (errors / total) * 100 : 0
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const stats = this.getAllStats()
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      overall: {
        totalRequests: this.records.length,
        avgLatencyMs: this.getOverallAvgLatency(),
        slowRequests: this.getSlowRequests().length
      },
      methods: stats
    }, null, 2)
  }

  /**
   * Clear all records
   */
  clear() {
    this.records = []
    this.methodRecords.clear()
    this.methodErrors.clear()
    this.methodSuccess.clear()
  }
}

// Export singleton instance
export const latencyTracker = new LatencyTracker()
