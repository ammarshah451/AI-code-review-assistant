// Status Badge with animated glow effects

import { motion } from 'framer-motion'
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { ReviewStatus } from '../types'

interface StatusBadgeProps {
  status: ReviewStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const statusConfig = {
  pending: {
    label: 'Pending',
    color: '#ffaa00',
    bgColor: 'rgba(255, 170, 0, 0.1)',
    borderColor: 'rgba(255, 170, 0, 0.3)',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    color: '#00f0ff',
    bgColor: 'rgba(0, 240, 255, 0.1)',
    borderColor: 'rgba(0, 240, 255, 0.3)',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    color: '#00ff88',
    bgColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: '#ff3366',
    bgColor: 'rgba(255, 51, 102, 0.1)',
    borderColor: 'rgba(255, 51, 102, 0.3)',
    icon: XCircle,
  },
}

const sizeConfig = {
  sm: { padding: 'px-2 py-0.5', text: 'text-xs', icon: 12, dot: 'w-1.5 h-1.5' },
  md: { padding: 'px-3 py-1', text: 'text-sm', icon: 14, dot: 'w-2 h-2' },
  lg: { padding: 'px-4 py-1.5', text: 'text-base', icon: 16, dot: 'w-2.5 h-2.5' },
}

export function StatusBadge({ status, size = 'md', showLabel = true }: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: [
          `0 0 0px ${config.color}00`,
          `0 0 8px ${config.color}20`,
          `0 0 0px ${config.color}00`
        ]
      }}
      whileHover={{ scale: 1.05 }}
      transition={{
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
        boxShadow: {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }}
      className={`inline-flex items-center gap-1.5 ${sizes.padding} rounded-full font-mono ${sizes.text}`}
      style={{
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        color: config.color,
      }}
    >
      {/* Animated dot or icon */}
      {status === 'processing' ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Icon size={sizes.icon} />
        </motion.div>
      ) : (
        <div className="relative">
          <div
            className={`${sizes.dot} rounded-full`}
            style={{
              backgroundColor: config.color,
              boxShadow: `0 0 8px ${config.color}`,
            }}
          />
          {status === 'pending' && (
            <motion.div
              className={`absolute inset-0 ${sizes.dot} rounded-full`}
              style={{ backgroundColor: config.color }}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>
      )}

      {showLabel && (
        <span className="font-medium tracking-wide">{config.label}</span>
      )}
    </motion.div>
  )
}

// Large status indicator for detail views
export function StatusIndicator({ status }: { status: ReviewStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4"
    >
      <div
        className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          backgroundColor: config.bgColor,
          border: `2px solid ${config.borderColor}`,
          boxShadow: `0 0 30px ${config.bgColor}`,
        }}
      >
        {status === 'processing' ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Icon size={32} style={{ color: config.color }} />
          </motion.div>
        ) : (
          <Icon size={32} style={{ color: config.color }} />
        )}

        {/* Pulse effect for processing */}
        {status === 'processing' && (
          <>
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ border: `2px solid ${config.color}` }}
              animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ border: `2px solid ${config.color}` }}
              animate={{ scale: [1, 1.2], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.75 }}
            />
          </>
        )}
      </div>

      <div>
        <h3
          className="text-2xl font-display font-bold"
          style={{
            color: config.color,
            textShadow: `0 0 20px ${config.color}50`,
          }}
        >
          {config.label}
        </h3>
        <p className="text-sm text-gray-500 font-mono">
          {status === 'pending' && 'Waiting in queue'}
          {status === 'processing' && 'AI agents analyzing code'}
          {status === 'completed' && 'Review complete'}
          {status === 'failed' && 'An error occurred'}
        </p>
      </div>
    </motion.div>
  )
}
