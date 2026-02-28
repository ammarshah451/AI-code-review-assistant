// StatusIndicators - Dynamic waveforms and progress rings

import { motion } from 'framer-motion'
import type { ReviewStatus } from '../types'

// Status color mapping
const statusColors = {
  pending: '#ffaa00',
  processing: '#00f0ff',
  completed: '#00ff88',
  failed: '#ff3366',
}

// Waveform Indicator - Shows activity level
interface WaveformProps {
  status: ReviewStatus
  bars?: number
}

export function Waveform({ status, bars = 5 }: WaveformProps) {
  const color = statusColors[status]
  const isActive = status === 'processing'

  return (
    <div className="flex items-center gap-0.5 h-5">
      {[...Array(bars)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: color }}
          animate={
            isActive
              ? {
                  height: ['4px', '16px', '4px'],
                  opacity: [0.5, 1, 0.5],
                }
              : {
                  height: status === 'completed' ? '12px' : '6px',
                  opacity: status === 'completed' ? 0.8 : 0.4,
                }
          }
          transition={{
            duration: 0.8,
            delay: i * 0.1,
            repeat: isActive ? Infinity : 0,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// Circular Progress Ring
interface ProgressRingProps {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  color?: string
  showPercentage?: boolean
}

export function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 3,
  color = '#00f0ff',
  showPercentage = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="progress-ring" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          className="progress-ring-circle"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-xs font-mono font-bold"
            style={{ color, textShadow: `0 0 10px ${color}` }}
          >
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  )
}

// Status Ring Indicator (replaces text status)
interface StatusIndicatorRingProps {
  status: ReviewStatus
  size?: number
}

export function StatusIndicatorRing({ status, size = 40 }: StatusIndicatorRingProps) {
  const color = statusColors[status]
  const progress =
    status === 'completed' ? 100 : status === 'failed' ? 100 : status === 'processing' ? 65 : 0

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={
          status === 'processing'
            ? { opacity: [0.1, 0.3, 0.1], scale: [1, 1.2, 1] }
            : { opacity: 0.1 }
        }
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      <svg width={size} height={size} className="relative">
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 4) / 2}
          fill="rgba(10, 10, 15, 0.8)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />

        {/* Progress arc */}
        {status !== 'pending' && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={(size - 8) / 2}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${((size - 8) / 2) * Math.PI * 2}`}
            initial={{ strokeDashoffset: ((size - 8) / 2) * Math.PI * 2 }}
            animate={{
              strokeDashoffset:
                ((size - 8) / 2) * Math.PI * 2 * (1 - progress / 100),
              rotate: status === 'processing' ? 360 : 0,
            }}
            transition={{
              strokeDashoffset: { duration: 1, ease: 'easeOut' },
              rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
            }}
            style={{
              transformOrigin: 'center',
              filter: `drop-shadow(0 0 4px ${color})`,
            }}
          />
        )}

        {/* Center icon */}
        <g
          transform={`translate(${size / 2}, ${size / 2})`}
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        >
          {status === 'completed' && (
            <motion.path
              d="M-4,0 L-1,3 L4,-3"
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
            />
          )}
          {status === 'failed' && (
            <g>
              <line x1="-3" y1="-3" x2="3" y2="3" stroke={color} strokeWidth={2} />
              <line x1="3" y1="-3" x2="-3" y2="3" stroke={color} strokeWidth={2} />
            </g>
          )}
          {status === 'processing' && (
            <motion.circle
              r={3}
              fill={color}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
          {status === 'pending' && (
            <circle r={3} fill={color} opacity={0.5} />
          )}
        </g>
      </svg>
    </div>
  )
}

// Stats breakdown with progress bars
interface StatsBreakdownProps {
  stats: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

export function StatsBreakdown({ stats }: StatsBreakdownProps) {
  const total = Object.values(stats).reduce((a, b) => a + b, 0)

  const items = [
    { key: 'pending', label: 'PENDING', value: stats.pending, color: '#ffaa00' },
    { key: 'processing', label: 'ACTIVE', value: stats.processing, color: '#00f0ff' },
    { key: 'completed', label: 'COMPLETE', value: stats.completed, color: '#00ff88' },
    { key: 'failed', label: 'FAILED', value: stats.failed, color: '#ff3366' },
  ]

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0

        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: item.color,
                    boxShadow: `0 0 8px ${item.color}`,
                  }}
                  animate={
                    item.key === 'processing'
                      ? { opacity: [0.5, 1, 0.5] }
                      : {}
                  }
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs font-mono text-gray-400 tracking-wider">
                  {item.label}
                </span>
              </div>
              <span
                className="text-sm font-mono font-bold"
                style={{ color: item.color }}
              >
                {item.value}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[#1a1a24] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  backgroundColor: item.color,
                  boxShadow: `0 0 10px ${item.color}`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )
      })}

      {/* Total */}
      <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs font-mono text-gray-500">TOTAL_REVIEWS</span>
        <span className="text-xl font-display font-bold text-white">
          {total}
        </span>
      </div>
    </div>
  )
}
