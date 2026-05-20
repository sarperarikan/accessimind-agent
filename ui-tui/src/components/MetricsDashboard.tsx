/**
 * Performance Metrics Dashboard Component
 * 
 * Real-time display of gateway performance metrics:
 * - RPC latency (avg, p50, p95, p99)
 * - Success rates
 * - Connection pool stats
 * - Request throughput
 * 
 * Usage: <MetricsDashboard t={theme} />
 */

import { Box, Text } from '@hermes/ink'
import { useState, useEffect } from 'react'

import type { Theme } from '../theme.js'

interface MetricsData {
  uptime_seconds: number
  total_requests: number
  total_errors: number
  error_rate: number
  requests_per_second: number
  active_connections: number
  peak_connections: number
  methods: Record<string, MethodMetrics>
}

interface MethodMetrics {
  count: number
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  min_latency_ms: number
  max_latency_ms: number
  success_rate: number
  errors: number
}

const REFRESH_INTERVAL_MS = 5000

export function MetricsDashboard({ t }: { t: Theme }) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  async function fetchMetrics() {
    try {
      // Placeholder - will integrate with gateway client
      // const result = await gatewayRequest<MetricsData>('metrics.get', {})
      // setMetrics(result)
      setError('Metrics endpoint not yet integrated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !metrics) {
    return (
      <Box flexDirection="column" alignItems="center" padding={1}>
        <Text color={t.color.muted}>Loading metrics...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={t.color.error}>Error: {error}</Text>
      </Box>
    )
  }

  if (!metrics) {
    return null
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={t.color.primary}>
        ═══ Performance Metrics ═══
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text color={t.color.warn}>Overview:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text>
            Uptime: {formatTime(metrics.uptime_seconds)} | 
            Requests: {metrics.total_requests} | 
            RPS: {metrics.requests_per_second.toFixed(2)}
          </Text>
          <Text>
            Errors: {metrics.total_errors} ({metrics.error_rate.toFixed(2)}%) | 
            Connections: {metrics.active_connections}/{metrics.peak_connections}
          </Text>
        </Box>
      </Box>

      {Object.keys(metrics.methods).length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color={t.color.warn}>Method Performance:</Text>
          <Box marginLeft={2} flexDirection="column">
            {Object.entries(metrics.methods)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 10)
              .map(([method, m]) => (
                <Box key={method} flexDirection="column" marginBottom={1}>
                  <Text bold>
                    {method} ({m.count} calls)
                  </Text>
                  <Box marginLeft={2} flexDirection="column">
                    <Text color={t.color.success}>
                      Latency: avg={m.avg_latency_ms.toFixed(0)}ms | 
                      p50={m.p50_latency_ms.toFixed(0)}ms | 
                      p95={m.p95_latency_ms.toFixed(0)}ms
                    </Text>
                    <Text color={m.success_rate >= 95 ? t.color.success : m.success_rate >= 80 ? t.color.warn : t.color.error}>
                      Success: {m.success_rate.toFixed(1)}% | Errors: {m.errors}
                    </Text>
                  </Box>
                </Box>
              ))}
          </Box>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={t.color.warn}>Connection Pool:</Text>
        <Box marginLeft={2}>
          <Text>
            Active: {metrics.active_connections} | 
            Peak: {metrics.peak_connections} | 
            Status: {metrics.active_connections > 0 ? '✓' : '○'}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dim color={t.color.muted}>
          Auto-refresh: {REFRESH_INTERVAL_MS / 1000}s
        </Text>
      </Box>
    </Box>
  )
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`
  } else if (mins > 0) {
    return `${mins}m ${secs}s`
  } else {
    return `${secs}s`
  }
}
