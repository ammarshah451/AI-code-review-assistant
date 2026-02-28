// Sparkline - "Intelligence Stream" Liquid Gradient Micro-Charts
// Features: Liquid gradient fill, dynamic waveforms, real-time visualization

import { motion } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'

interface SparklineProps {
  data?: number[]
  width?: number
  height?: number
  color?: string
  animate?: boolean
  showDot?: boolean
  label?: string
  value?: string | number
  unit?: string
  liquidFill?: boolean
}

export function Sparkline({
  data: externalData,
  width = 80,
  height = 24,
  color = '#00f0ff',
  animate = true,
  showDot = true,
  label,
  value,
  unit,
  liquidFill = true,
}: SparklineProps) {
  // Generate random data if none provided
  const [internalData, setInternalData] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => Math.random() * 100)
  )

  const data = externalData || internalData

  // Animate data updates
  useEffect(() => {
    if (externalData || !animate) return

    const interval = setInterval(() => {
      setInternalData((prev) => {
        const newData = [...prev.slice(1), Math.random() * 100]
        return newData
      })
    }, 500)

    return () => clearInterval(interval)
  }, [externalData, animate])

  // Calculate SVG path
  const path = useMemo(() => {
    if (data.length < 2) return ''

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height * 0.8 - height * 0.1
      return `${x},${y}`
    })

    return `M${points.join(' L')}`
  }, [data, width, height])

  // Get last point for the dot
  const lastPoint = useMemo(() => {
    if (data.length < 2) return { x: 0, y: height / 2 }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const lastValue = data[data.length - 1]
    return {
      x: width,
      y: height - ((lastValue - min) / range) * height * 0.8 - height * 0.1,
    }
  }, [data, width, height])

  // Unique gradient ID for this instance
  const gradientId = useMemo(() => `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`, [])
  const fillGradientId = useMemo(() => `sparkline-fill-${Math.random().toString(36).substr(2, 9)}`, [])

  return (
    <div className="flex items-center gap-3">
      {/* Labels */}
      {label && (
        <div className="flex-1 min-w-0">
          <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider block truncate">
            {label}
          </span>
          {value !== undefined && (
            <span
              className="text-sm font-mono font-bold block"
              style={{ color, textShadow: `0 0 10px ${color}40` }}
            >
              {value}
              {unit && <span className="text-[10px] text-gray-500 ml-0.5">{unit}</span>}
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          <defs>
            {/* Horizontal gradient for the line */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>

            {/* LIQUID FILL - Vertical gradient from accent to transparent */}
            <linearGradient id={fillGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="50%" stopColor={color} stopOpacity="0.1" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="sparkline-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* LIQUID GRADIENT AREA FILL */}
          {liquidFill && (
            <motion.path
              d={`${path} L${width},${height} L0,${height} Z`}
              fill={`url(#${fillGradientId})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
          )}

          {/* Line */}
          <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#sparkline-glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />

          {/* End dot */}
          {showDot && (
            <motion.circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={2.5}
              fill={color}
              filter="url(#sparkline-glow)"
              animate={{
                r: [2.5, 3.5, 2.5],
                opacity: [1, 0.7, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </svg>
      </div>
    </div>
  )
}

// Horizontal bar sparkline variant
interface BarSparklineProps {
  data?: number[]
  width?: number
  height?: number
  color?: string
  barCount?: number
  animate?: boolean
}

export function BarSparkline({
  data: externalData,
  width = 60,
  height = 20,
  color = '#00f0ff',
  barCount = 12,
  animate = true,
}: BarSparklineProps) {
  const [internalData, setInternalData] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => Math.random())
  )

  const data = externalData || internalData

  useEffect(() => {
    if (externalData || !animate) return

    const interval = setInterval(() => {
      setInternalData((prev) => {
        const newData = [...prev.slice(1), Math.random()]
        return newData
      })
    }, 300)

    return () => clearInterval(interval)
  }, [externalData, animate])

  const barWidth = (width - (barCount - 1) * 2) / barCount
  const gradientId = useMemo(() => `bar-gradient-${Math.random().toString(36).substr(2, 9)}`, [])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <filter id="bar-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Vertical gradient for bars */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {data.slice(-barCount).map((value, index) => {
        const barHeight = Math.max(2, value * height * 0.9)
        const x = index * (barWidth + 2)
        const y = height - barHeight

        return (
          <motion.rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={`url(#${gradientId})`}
            rx={1}
            opacity={0.3 + (index / barCount) * 0.7}
            filter="url(#bar-glow)"
            initial={{ height: 0, y: height }}
            animate={{ height: barHeight, y }}
            transition={{ duration: 0.2 }}
          />
        )
      })}
    </svg>
  )
}

// Live metric display with sparkline
interface LiveMetricProps {
  label: string
  value: number | string
  unit?: string
  color?: string
  trend?: 'up' | 'down' | 'stable'
  sparklineData?: number[]
  showWaveform?: boolean
}

export function LiveMetric({
  label,
  value,
  unit,
  color = '#00f0ff',
  trend,
  sparklineData,
  showWaveform = false,
}: LiveMetricProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">
            {label}
          </span>
          {trend && (
            <motion.span
              className="text-[8px]"
              style={{
                color:
                  trend === 'up' ? '#00ff88' : trend === 'down' ? '#ff3366' : '#ffaa00',
              }}
              animate={{ y: trend === 'up' ? [-1, 1, -1] : trend === 'down' ? [1, -1, 1] : 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </motion.span>
          )}
        </div>
        <span
          className="text-sm font-mono font-bold"
          style={{ color, textShadow: `0 0 10px ${color}40` }}
        >
          {value}
          {unit && <span className="text-[10px] text-gray-500 ml-0.5">{unit}</span>}
        </span>
      </div>

      {showWaveform ? (
        <DynamicWaveform color={color} active={trend === 'up'} />
      ) : (
        <Sparkline
          data={sparklineData}
          width={60}
          height={20}
          color={color}
          showDot={false}
          liquidFill={true}
        />
      )}
    </div>
  )
}

// DYNAMIC WAVEFORM - CSS animated wave that changes based on state
interface DynamicWaveformProps {
  color?: string
  active?: boolean
  bars?: number
}

export function DynamicWaveform({ color = '#00f0ff', active = false, bars = 5 }: DynamicWaveformProps) {
  return (
    <div className="flex items-center gap-0.5 h-5">
      {[...Array(bars)].map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
          animate={
            active
              ? {
                  // Active: Jagged high-frequency wave
                  height: ['4px', '16px', '6px', '14px', '4px'],
                  opacity: [0.6, 1, 0.8, 1, 0.6],
                }
              : {
                  // Idle: Subtle slow-moving sine wave
                  height: ['6px', '10px', '6px'],
                  opacity: [0.4, 0.6, 0.4],
                }
          }
          transition={{
            duration: active ? 0.4 : 1.5,
            delay: i * (active ? 0.05 : 0.1),
            repeat: Infinity,
            ease: active ? 'linear' : 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// LIQUID PROGRESS RING - Animated fill ring for Total Reviews
interface LiquidProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
  value?: number | string
}

export function LiquidProgressRing({
  progress,
  size = 64,
  strokeWidth = 4,
  color = '#00f0ff',
  label,
  value,
}: LiquidProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference
  const gradientId = useMemo(() => `ring-gradient-${Math.random().toString(36).substr(2, 9)}`, [])

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          {/* Liquid gradient around the ring */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="50%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>

          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />

        {/* Progress circle with liquid-fill animation */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          filter="url(#ring-glow)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1], // "Pour" easing
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {value !== undefined && (
          <span
            className="text-lg font-mono font-bold"
            style={{ color, textShadow: `0 0 10px ${color}40` }}
          >
            {value}
          </span>
        )}
        {label && (
          <span className="text-[6px] font-mono text-gray-500 uppercase tracking-wider">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
