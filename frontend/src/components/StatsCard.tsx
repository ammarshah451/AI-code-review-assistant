// Stats Card with liquid border animation and counter effect

import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface StatsCardProps {
  title: string
  value: number
  icon: ReactNode
  color: 'cyan' | 'magenta' | 'green' | 'amber'
  subtitle?: string
  delay?: number
}

const colorMap = {
  cyan: {
    primary: '#00f0ff',
    gradient: 'from-cyan-500/20 to-blue-600/20',
    border: 'rgba(0, 240, 255, 0.5)',
    glow: 'rgba(0, 240, 255, 0.3)',
  },
  magenta: {
    primary: '#ff00aa',
    gradient: 'from-pink-500/20 to-purple-600/20',
    border: 'rgba(255, 0, 170, 0.5)',
    glow: 'rgba(255, 0, 170, 0.3)',
  },
  green: {
    primary: '#00ff88',
    gradient: 'from-green-500/20 to-emerald-600/20',
    border: 'rgba(0, 255, 136, 0.5)',
    glow: 'rgba(0, 255, 136, 0.3)',
  },
  amber: {
    primary: '#ffaa00',
    gradient: 'from-amber-500/20 to-orange-600/20',
    border: 'rgba(255, 170, 0, 0.5)',
    glow: 'rgba(255, 170, 0, 0.3)',
  },
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 })
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString())

  useEffect(() => {
    spring.set(value)
  }, [spring, value])

  return <motion.span>{display}</motion.span>
}

export function StatsCard({ title, value, icon, color, subtitle, delay = 0 }: StatsCardProps) {
  const colors = colorMap[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative group"
    >
      {/* Liquid border container */}
      <div className="liquid-border p-[1px] rounded-2xl">
        <div
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors.gradient} backdrop-blur-xl p-6`}
          style={{
            background: `linear-gradient(135deg, rgba(18, 18, 26, 0.9) 0%, rgba(22, 22, 31, 0.9) 100%)`,
          }}
        >
          {/* Background glow effect */}
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
            style={{ backgroundColor: colors.primary }}
          />

          {/* Scan line effect */}
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${colors.glow} 50%, transparent 100%)`,
              height: '100%',
            }}
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-mono text-gray-400 uppercase tracking-wider">
                {title}
              </span>
              <motion.div
                className="p-2 rounded-lg"
                style={{
                  backgroundColor: `${colors.primary}15`,
                  color: colors.primary,
                }}
                whileHover={{ rotate: 15, scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                {icon}
              </motion.div>
            </div>

            {/* Value */}
            <div className="flex items-baseline gap-2">
              <span
                className="text-4xl md:text-5xl font-display font-bold tracking-tight"
                style={{
                  color: colors.primary,
                  textShadow: `0 0 30px ${colors.glow}`,
                }}
              >
                <AnimatedNumber value={value} />
              </span>
            </div>

            {/* Subtitle */}
            {subtitle && (
              <p className="mt-2 text-sm text-gray-500 font-mono">
                {subtitle}
              </p>
            )}
          </div>

          {/* Corner accent */}
          <div
            className="absolute bottom-0 right-0 w-20 h-20 opacity-10"
            style={{
              background: `radial-gradient(circle at bottom right, ${colors.primary}, transparent 70%)`,
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// Mini stats for status breakdown
interface MiniStatProps {
  label: string
  value: number
  color: string
  total: number
}

export function MiniStat({ label, value, color, total }: MiniStatProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3"
    >
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}`,
        }}
      />
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">
            {label}
          </span>
          <span className="text-sm font-mono font-medium" style={{ color }}>
            {value}
          </span>
        </div>
        <div className="h-1 bg-void-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </motion.div>
  )
}
