// MetricsPanel - Compact metrics display for 3D HUD
// Shows key stats in a minimal format

interface MetricsPanelProps {
  totalReviews?: number
  processingCount?: number
  successRate?: number
  latency?: number
}

export function MetricsPanel({
  totalReviews = 0,
  processingCount = 0,
  successRate = 0,
  latency = 42,
}: MetricsPanelProps) {
  return (
    <div className="space-y-2">
      <MetricRow label="TOTAL" value={totalReviews} color="#00f0ff" />
      <MetricRow label="QUEUE" value={processingCount} color="#ffaa00" />
      <MetricRow label="SUCCESS" value={`${successRate}%`} color="#00ff88" />
      <MetricRow label="LATENCY" value={`${latency}ms`} color="#ff00aa" />
    </div>
  )
}

function MetricRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[8px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
