// SchematicCard - Military-grade card with corner brackets, micro labels, and technical metadata

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'

// Generate pseudo-random but stable technical metadata
function generateMetadata(seed: string): { nodeId: string; latency: string; checksum: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  const absHash = Math.abs(hash)

  return {
    nodeId: `0x${(absHash % 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
    latency: `${(absHash % 80) + 10}ms`,
    checksum: `${((absHash % 900) + 100).toString(16).toUpperCase()}`,
  }
}

interface SchematicCardProps {
  children: ReactNode
  label?: string
  variant?: 'default' | 'critical' | 'success'
  className?: string
  delay?: number
  animate?: boolean
  showMetadata?: boolean
}

export function SchematicCard({
  children,
  label,
  variant = 'default',
  className,
  delay = 0,
  animate = true,
  showMetadata = true,
}: SchematicCardProps) {
  const variantClass = {
    default: '',
    critical: 'schematic-card--critical',
    success: 'schematic-card--success',
  }[variant]

  const cornerVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
  }

  // Generate stable metadata based on label
  const metadata = useMemo(
    () => generateMetadata(label || 'default'),
    [label]
  )

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('schematic-card relative', variantClass, className)}
    >
      {/* Micro label */}
      {label && (
        <motion.span
          initial={animate ? { opacity: 0, x: -10 } : false}
          animate={{ opacity: 0.6, x: 0 }}
          transition={{ delay: delay + 0.2 }}
          className="schematic-label"
        >
          {label}
        </motion.span>
      )}

      {/* Technical metadata in corners */}
      {showMetadata && (
        <>
          {/* Top-right: Node ID */}
          <motion.span
            className="absolute top-1 right-5 text-[6px] font-mono text-gray-700/50 tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.4 }}
          >
            NODE:{metadata.nodeId}
          </motion.span>

          {/* Bottom-left: Latency */}
          <motion.span
            className="absolute bottom-1 left-5 text-[6px] font-mono text-gray-700/50 tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.5 }}
          >
            LAT:{metadata.latency}
          </motion.span>

          {/* Bottom-right: Checksum */}
          <motion.span
            className="absolute bottom-1 right-5 text-[6px] font-mono text-gray-700/50 tracking-wider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.6 }}
          >
            CHK:{metadata.checksum}
          </motion.span>
        </>
      )}

      {/* Corner brackets - animated */}
      <motion.div
        className="corner-bl"
        variants={cornerVariants}
        initial={animate ? "hidden" : false}
        animate="visible"
        transition={{ delay: delay + 0.1, duration: 0.3, type: 'spring', stiffness: 500 }}
      />
      <motion.div
        className="corner-br"
        variants={cornerVariants}
        initial={animate ? "hidden" : false}
        animate="visible"
        transition={{ delay: delay + 0.15, duration: 0.3, type: 'spring', stiffness: 500 }}
      />

      {/* Content */}
      {children}
    </motion.div>
  )
}

// Compact stat card inside schematic frame
interface SchematicStatProps {
  title: string
  value: number | string
  label: string
  color: 'cyan' | 'magenta' | 'green' | 'amber'
  icon?: ReactNode
  delay?: number
  sparkline?: ReactNode
}

const colorMap = {
  cyan: { primary: '#00f0ff', glow: 'rgba(0, 240, 255, 0.3)' },
  magenta: { primary: '#ff00aa', glow: 'rgba(255, 0, 170, 0.3)' },
  green: { primary: '#00ff88', glow: 'rgba(0, 255, 136, 0.3)' },
  amber: { primary: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)' },
}

export function SchematicStat({ title, value, label, color, icon, delay = 0, sparkline }: SchematicStatProps) {
  const colors = colorMap[color]

  return (
    <SchematicCard label={label} delay={delay} className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
            {title}
          </span>
          <div className="flex items-end gap-3">
            <motion.span
              className="block text-3xl font-display font-bold"
              style={{ color: colors.primary, textShadow: `0 0 20px ${colors.glow}` }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </motion.span>
            {sparkline && (
              <div className="mb-1">
                {sparkline}
              </div>
            )}
          </div>
        </div>
        {icon && (
          <motion.div
            className="p-2 rounded"
            style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ delay: delay + 0.3 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </SchematicCard>
  )
}
