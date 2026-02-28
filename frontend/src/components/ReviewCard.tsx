// Review Card - "DNA Feed" Display with color-coded segment bar

import { motion } from 'framer-motion'
import { GitPullRequest, GitCommit, Clock, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import type { Review, ReviewWithFindings, Finding, AgentType } from '../types'

interface ReviewCardProps {
  review: Review | ReviewWithFindings
  onClick?: () => void
  index?: number
  showDNA?: boolean
}

// Check if review has findings
function hasFindings(review: Review | ReviewWithFindings): review is ReviewWithFindings {
  return 'findings' in review && Array.isArray(review.findings)
}

// Calculate DNA segments from findings
function calculateDNASegments(findings: Finding[]): { logic: number; security: number; quality: number } {
  const counts = { logic: 0, security: 0, quality: 0 }
  findings.forEach(f => {
    if (f.agent_type in counts) {
      counts[f.agent_type as AgentType]++
    }
  })
  return counts
}

export function ReviewCard({ review, onClick, index = 0, showDNA = true }: ReviewCardProps) {
  const timeAgo = formatDistanceToNow(new Date(review.created_at), { addSuffix: true })

  // Calculate DNA segments if findings available
  const dnaSegments = hasFindings(review)
    ? calculateDNASegments(review.findings)
    : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ x: 8 }}
      onClick={onClick}
      className="group relative cursor-pointer"
    >
      {/* DNA Bar - Vertical color-coded segments */}
      {showDNA && (
        <DNABar
          status={review.status}
          segments={dnaSegments}
          index={index}
        />
      )}

      <div className="ml-4 p-4 rounded-xl bg-void-100/50 border border-white/5 backdrop-blur-sm transition-all duration-300 group-hover:bg-void-100 group-hover:border-white/10">
        <div className="flex items-start justify-between gap-4">
          {/* Left content */}
          <div className="flex-1 min-w-0">
            {/* PR Title */}
            <div className="flex items-center gap-2 mb-2">
              <GitPullRequest size={16} className="text-cyber-cyan shrink-0" />
              <h3 className="font-display font-semibold text-white truncate group-hover:text-cyber-cyan transition-colors">
                {review.pr_title || `PR #${review.pr_number}`}
              </h3>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-sm text-gray-500 font-mono">
              <span className="flex items-center gap-1">
                <span className="text-gray-600">#</span>
                {review.pr_number}
              </span>
              <span className="flex items-center gap-1">
                <GitCommit size={12} />
                <span className="font-mono text-xs">
                  {review.commit_sha.slice(0, 7)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {timeAgo}
              </span>
            </div>
          </div>

          {/* Right content */}
          <div className="flex items-center gap-3">
            {/* DNA Summary badges */}
            {dnaSegments && review.status === 'completed' && (
              <DNASummary segments={dnaSegments} />
            )}
            <StatusBadge status={review.status} size="sm" />
            <motion.div
              className="text-gray-600 group-hover:text-cyber-cyan transition-colors"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
            >
              <ArrowRight size={16} />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// DNA Bar - Vertical bar with color-coded segments
interface DNABarProps {
  status: Review['status']
  segments: { logic: number; security: number; quality: number } | null
  index: number
}

function DNABar({ status, segments, index }: DNABarProps) {
  // Colors for each agent type
  const colors = {
    logic: '#00f0ff',    // Cyan
    security: '#ff00aa', // Magenta
    quality: '#00ff88',  // Green
  }

  // Status-based color when no findings
  const statusColor = status === 'completed' ? '#00ff88'
    : status === 'processing' ? '#00f0ff'
    : status === 'failed' ? '#ff3366'
    : '#ffaa00'

  // If we have segments, show proportional DNA bar
  if (segments) {
    const total = segments.logic + segments.security + segments.quality
    if (total > 0) {
      const logicPct = (segments.logic / total) * 100
      const securityPct = (segments.security / total) * 100
      const qualityPct = (segments.quality / total) * 100

      return (
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-full overflow-hidden flex flex-col"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: index * 0.05 + 0.2 }}
        >
          {segments.logic > 0 && (
            <motion.div
              className="w-full"
              style={{
                height: `${logicPct}%`,
                backgroundColor: colors.logic,
                boxShadow: `0 0 6px ${colors.logic}`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.3 }}
            />
          )}
          {segments.security > 0 && (
            <motion.div
              className="w-full"
              style={{
                height: `${securityPct}%`,
                backgroundColor: colors.security,
                boxShadow: `0 0 6px ${colors.security}`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.35 }}
            />
          )}
          {segments.quality > 0 && (
            <motion.div
              className="w-full"
              style={{
                height: `${qualityPct}%`,
                backgroundColor: colors.quality,
                boxShadow: `0 0 6px ${colors.quality}`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.4 }}
            />
          )}
        </motion.div>
      )
    }
  }

  // Fallback to status-based solid bar
  return (
    <motion.div
      className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
      style={{
        background: statusColor,
        boxShadow: `0 0 6px ${statusColor}`,
      }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ delay: index * 0.05 + 0.2 }}
    />
  )
}

// DNA Summary - Compact badges showing finding counts
interface DNASummaryProps {
  segments: { logic: number; security: number; quality: number }
}

function DNASummary({ segments }: DNASummaryProps) {
  const total = segments.logic + segments.security + segments.quality
  if (total === 0) return null

  return (
    <div className="flex items-center gap-1">
      {segments.logic > 0 && (
        <span
          className="text-[8px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff' }}
        >
          L:{segments.logic}
        </span>
      )}
      {segments.security > 0 && (
        <span
          className="text-[8px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(255, 0, 170, 0.15)', color: '#ff00aa' }}
        >
          S:{segments.security}
        </span>
      )}
      {segments.quality > 0 && (
        <span
          className="text-[8px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(0, 255, 136, 0.15)', color: '#00ff88' }}
        >
          Q:{segments.quality}
        </span>
      )}
    </div>
  )
}

// Skeleton for loading state
export function ReviewCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      {/* DNA bar skeleton */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-void-200 animate-pulse" />

      <div className="ml-4 p-4 rounded-xl bg-void-100/30 border border-white/5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded bg-void-200 animate-pulse" />
              <div className="h-5 w-48 rounded bg-void-200 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-12 rounded bg-void-200 animate-pulse" />
              <div className="h-4 w-16 rounded bg-void-200 animate-pulse" />
              <div className="h-4 w-20 rounded bg-void-200 animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-24 rounded-full bg-void-200 animate-pulse" />
        </div>
      </div>
    </motion.div>
  )
}
