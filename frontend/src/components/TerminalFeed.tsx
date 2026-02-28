// TerminalFeed - Animated review feed with glitch hover effects

import { motion, AnimatePresence } from 'framer-motion'
import { GitPullRequest, GitCommit, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusIndicatorRing } from './StatusIndicators'
import type { Review } from '../types'

interface TerminalFeedProps {
  reviews: Review[]
  onReviewClick?: (review: Review) => void
  isLoading?: boolean
}

export function TerminalFeed({ reviews, onReviewClick, isLoading }: TerminalFeedProps) {
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {isLoading ? (
          // Skeleton loaders
          [...Array(5)].map((_, i) => (
            <TerminalFeedSkeleton key={`skeleton-${i}`} index={i} />
          ))
        ) : (
          reviews.map((review, index) => (
            <TerminalFeedItem
              key={review.id}
              review={review}
              index={index}
              onClick={() => onReviewClick?.(review)}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  )
}

interface TerminalFeedItemProps {
  review: Review
  index: number
  onClick?: () => void
}

function TerminalFeedItem({ review, index, onClick }: TerminalFeedItemProps) {
  const timeAgo = formatDistanceToNow(new Date(review.created_at), { addSuffix: true })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, x: -10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{
        delay: index * 0.1,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={onClick}
      className="group relative cursor-pointer glitch-hover"
    >
      {/* Terminal line indicator */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-0.5"
        style={{
          background:
            review.status === 'completed'
              ? '#00ff88'
              : review.status === 'processing'
              ? '#00f0ff'
              : review.status === 'failed'
              ? '#ff3366'
              : '#ffaa00',
          boxShadow: `0 0 8px ${
            review.status === 'completed'
              ? '#00ff88'
              : review.status === 'processing'
              ? '#00f0ff'
              : review.status === 'failed'
              ? '#ff3366'
              : '#ffaa00'
          }`,
        }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: index * 0.1 + 0.2 }}
      />

      {/* Content */}
      <div className="ml-4 py-3 px-4 rounded bg-[#0a0a0f]/60 border border-white/5 backdrop-blur-sm transition-all duration-200 group-hover:bg-[#0d0d14] group-hover:border-white/10">
        <div className="flex items-center justify-between gap-4">
          {/* Left side */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Status ring */}
            <StatusIndicatorRing status={review.status} size={32} />

            {/* PR Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GitPullRequest size={14} className="text-[#00f0ff] shrink-0" />
                <span className="font-mono text-sm text-white truncate group-hover:text-[#00f0ff] transition-colors">
                  {review.pr_title || `PR #${review.pr_number}`}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono">
                <span className="flex items-center gap-1">
                  <GitCommit size={10} />
                  {review.commit_sha.slice(0, 7)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>

          {/* Right side - Arrow indicator */}
          <motion.span
            className="text-gray-600 group-hover:text-[#00f0ff] transition-colors"
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
          >
            →
          </motion.span>
        </div>
      </div>
    </motion.div>
  )
}

function TerminalFeedSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="ml-4 py-3 px-4 rounded bg-[#0a0a0f]/40 border border-white/5"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#1a1a24] animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-[#1a1a24] rounded animate-pulse" />
          <div className="h-3 w-32 bg-[#1a1a24] rounded animate-pulse" />
        </div>
      </div>
    </motion.div>
  )
}

// Terminal header component
interface TerminalHeaderProps {
  title: string
  subtitle?: string
  onAction?: () => void
  actionLabel?: string
}

export function TerminalHeader({ title, subtitle, onAction, actionLabel }: TerminalHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2">
          <span className="text-[#00f0ff]">›</span>
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs font-mono text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="text-xs font-mono text-[#00f0ff] hover:text-white transition-colors"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  )
}
