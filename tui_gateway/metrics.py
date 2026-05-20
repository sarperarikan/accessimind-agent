"""
Gateway Performance Metrics

Tracks RPC latency, throughput, errors, and resource usage.
Provides real-time metrics for performance monitoring.
"""

import time
import threading
from typing import Dict, Any, List
from collections import deque
from dataclasses import dataclass, field

@dataclass
class RPCMetrics:
    method: str
    count: int = 0
    total_latency_ms: float = 0.0
    min_latency_ms: float = float('inf')
    max_latency_ms: float = 0.0
    errors: int = 0
    latencies: deque = field(default_factory=lambda: deque(maxlen=100))
    
    @property
    def avg_latency_ms(self) -> float:
        if self.count == 0:
            return 0.0
        return self.total_latency_ms / self.count
    
    @property
    def p50_latency_ms(self) -> float:
        if not self.latencies:
            return 0.0
        sorted_lat = sorted(self.latencies)
        return sorted_lat[len(sorted_lat) // 2]
    
    @property
    def p95_latency_ms(self) -> float:
        if not self.latencies:
            return 0.0
        sorted_lat = sorted(self.latencies)
        return sorted_lat[int(len(sorted_lat) * 0.95)]
    
    @property
    def success_rate(self) -> float:
        if self.count == 0:
            return 100.0
        return ((self.count - self.errors) / self.count) * 100


class GatewayMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        self.rpc_metrics: Dict[str, RPCMetrics] = {}
        self.start_time = time.time()
        self.total_requests = 0
        self.total_errors = 0
        self.active_connections = 0
        self.peak_connections = 0
        
    def record_rpc(self, method: str, latency_ms: float, success: bool):
        """Record an RPC call"""
        with self._lock:
            self.total_requests += 1
            
            if not success:
                self.total_errors += 1
            
            if method not in self.rpc_metrics:
                self.rpc_metrics[method] = RPCMetrics(method=method)
            
            metrics = self.rpc_metrics[method]
            metrics.count += 1
            metrics.total_latency_ms += latency_ms
            metrics.min_latency_ms = min(metrics.min_latency_ms, latency_ms)
            metrics.max_latency_ms = max(metrics.max_latency_ms, latency_ms)
            metrics.latencies.append(latency_ms)
            
            if not success:
                metrics.errors += 1
    
    def record_connection(self, delta: int):
        """Record connection change"""
        with self._lock:
            self.active_connections += delta
            if self.active_connections > self.peak_connections:
                self.peak_connections = self.active_connections
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary"""
        with self._lock:
            uptime = time.time() - self.start_time
            
            return {
                'uptime_seconds': uptime,
                'total_requests': self.total_requests,
                'total_errors': self.total_errors,
                'error_rate': (self.total_errors / self.total_requests * 100) if self.total_requests > 0 else 0,
                'requests_per_second': self.total_requests / uptime if uptime > 0 else 0,
                'active_connections': self.active_connections,
                'peak_connections': self.peak_connections,
                'methods': {
                    name: {
                        'count': m.count,
                        'avg_latency_ms': m.avg_latency_ms,
                        'p50_latency_ms': m.p50_latency_ms,
                        'p95_latency_ms': m.p95_latency_ms,
                        'min_latency_ms': m.min_latency_ms if m.min_latency_ms != float('inf') else 0,
                        'max_latency_ms': m.max_latency_ms,
                        'success_rate': m.success_rate,
                        'errors': m.errors
                    }
                    for name, m in self.rpc_metrics.items()
                }
            }
    
    def reset(self):
        """Reset all metrics"""
        with self._lock:
            self.rpc_metrics.clear()
            self.total_requests = 0
            self.total_errors = 0
            self.active_connections = 0
            self.peak_connections = 0
            self.start_time = time.time()


# Global metrics instance
_gateway_metrics = GatewayMetrics()

def get_metrics() -> GatewayMetrics:
    return _gateway_metrics
