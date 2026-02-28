// Review Detail Page - Show review with all findings

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  GitPullRequest,
  GitCommit,
  Clock,
  Brain,
  Shield,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  FileText,
  List,
  Code,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { StatusIndicator } from '../components/StatusBadge'
import { LoadingState } from '../components/Layout'
import { FindingsByFile } from '../components/FindingsByFile'
import DiffViewer from '../components/DiffViewer'
import { useReview, useMarkFalsePositive } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import type { Finding, Severity, AgentType } from '../types'

const agentConfig: Record<AgentType, { icon: typeof Brain; color: string; label: string }> = {
  logic: { icon: Brain, color: '#00f0ff', label: 'Logic Agent' },
  security: { icon: Shield, color: '#ff00aa', label: 'Security Agent' },
  quality: { icon: Sparkles, color: '#00ff88', label: 'Quality Agent' },
}

const severityConfig: Record<Severity, { icon: typeof AlertTriangle; color: string; label: string }> = {
  critical: { icon: AlertTriangle, color: '#ff3366', label: 'Critical Warning' },
  high: { icon: AlertTriangle, color: '#ff6644', label: 'High Severity' },
  medium: { icon: AlertCircle, color: '#ffaa00', label: 'Medium Severity' },
  low: { icon: AlertCircle, color: '#88cc00', label: 'Low Severity' },
  info: { icon: Info, color: '#00f0ff', label: 'Info' },
}

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const agent = agentConfig[finding.agent_type]
  const severity = severityConfig[finding.severity]
  const AgentIcon = agent.icon
  const SeverityIcon = severity.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card overflow-hidden"
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-white/5 flex items-center justify-between"
        style={{ backgroundColor: `${severity.color}10` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${severity.color}20` }}
          >
            <SeverityIcon size={16} style={{ color: severity.color }} />
          </div>
          <span
            className="font-display font-semibold"
            style={{ color: severity.color }}
          >
            {finding.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono"
            style={{
              backgroundColor: `${agent.color}15`,
              color: agent.color,
            }}
          >
            <AgentIcon size={12} />
            {agent.label}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Location */}
        {finding.file_path && (
          <div className="flex items-center gap-2 mb-3 text-sm font-mono text-gray-400">
            <span className="text-gray-600">📁</span>
            <span>{finding.file_path}</span>
            {finding.line_number && (
              <>
                <span className="text-gray-600">:</span>
                <span className="text-cyber-cyan">{finding.line_number}</span>
              </>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          {finding.description}
        </p>

        {/* Suggestion */}
        {finding.suggestion && (
          <div className="p-3 rounded-lg bg-cyber-green/5 border border-cyber-green/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyber-green text-xs font-mono uppercase tracking-wider">
                💡 Suggestion
              </span>
            </div>
            <p className="text-gray-300 text-sm">{finding.suggestion}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function ReviewDetail() {
  const { reviewId } = useParams<{ reviewId: string }>()
  const navigate = useNavigate()
  const { data: review, isLoading, error, refetch } = useReview(reviewId ?? '')
  const { addToast } = useToast()
  const markFalsePositive = useMarkFalsePositive()
  const [viewMode, setViewMode] = useState<'file' | 'severity' | 'diff'>('file')

  const handleMarkFalsePositive = async (findingId: string, reason?: string) => {
    try {
      await markFalsePositive.mutateAsync({
        findingId,
        data: { is_false_positive: true, reason },
      })
      addToast({ type: 'success', message: 'Marked as false positive' })
      refetch()
    } catch {
      addToast({ type: 'error', message: 'Failed to mark as false positive' })
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <LoadingState />
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h2 className="text-2xl font-display font-bold text-white mb-2">
          Review Not Found
        </h2>
        <p className="text-gray-500 font-mono mb-6">
          The review you're looking for doesn't exist or has been deleted.
        </p>
        <button
          onClick={() => navigate('/reviews')}
          className="cyber-button cyber-button-ghost rounded-xl"
        >
          Back to Reviews
        </button>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(review.created_at), { addSuffix: true })
  const createdDate = format(new Date(review.created_at), 'PPpp')

  // Group findings by severity
  const criticalFindings = review.findings.filter(f => f.severity === 'critical')
  const highFindings = review.findings.filter(f => f.severity === 'high')
  const mediumFindings = review.findings.filter(f => f.severity === 'medium')
  const lowFindings = review.findings.filter(f => f.severity === 'low')
  const infoFindings = review.findings.filter(f => f.severity === 'info')

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/reviews')}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={20} />
        <span className="font-mono text-sm">Back to Reviews</span>
      </motion.button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-6"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            {/* PR Title */}
            <div className="flex items-center gap-3 mb-4">
              <GitPullRequest className="text-cyber-cyan" size={24} />
              <h1 className="text-2xl font-display font-bold text-white">
                {review.pr_title || `PR #${review.pr_number}`}
              </h1>
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="text-gray-600">#</span>
                {review.pr_number}
              </span>
              <span className="flex items-center gap-1.5">
                <GitCommit size={14} />
                {review.commit_sha.slice(0, 7)}
              </span>
              <span className="flex items-center gap-1.5" title={createdDate}>
                <Clock size={14} />
                {timeAgo}
              </span>
            </div>
          </div>

          <StatusIndicator status={review.status} />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="text-center">
            <div className="text-xl font-display font-bold" style={{ color: '#ff3366' }}>
              {criticalFindings.length}
            </div>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Critical
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-display font-bold" style={{ color: '#ff6644' }}>
              {highFindings.length}
            </div>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              High
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-display font-bold" style={{ color: '#ffaa00' }}>
              {mediumFindings.length}
            </div>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Medium
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-display font-bold" style={{ color: '#88cc00' }}>
              {lowFindings.length}
            </div>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Low
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-display font-bold text-cyber-cyan">
              {infoFindings.length}
            </div>
            <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
              Info
            </div>
          </div>
        </div>
      </motion.div>

      {/* Findings */}
      {review.findings.length > 0 ? (
        <div className="space-y-6">
          {/* View mode toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-white">
              Findings ({review.findings.length})
            </h2>
            <div className="flex items-center gap-1 bg-void-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('file')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${viewMode === 'file'
                    ? 'bg-void-100 text-white'
                    : 'text-gray-500 hover:text-white'
                  }`}
              >
                <FileText size={14} />
                By File
              </button>
              <button
                onClick={() => setViewMode('severity')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${viewMode === 'severity'
                    ? 'bg-void-100 text-white'
                    : 'text-gray-500 hover:text-white'
                  }`}
              >
                <List size={14} />
                By Severity
              </button>
              <button
                onClick={() => setViewMode('diff')}
                disabled={!review.diff_content}
                title={!review.diff_content ? 'No diff content available' : ''}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${viewMode === 'diff'
                    ? 'bg-void-100 text-white'
                    : !review.diff_content ? 'opacity-50 cursor-not-allowed text-gray-600' : 'text-gray-500 hover:text-white'
                  }`}
              >
                <Code size={14} />
                Diff View
              </button>
            </div>
          </div>

          {viewMode === 'file' ? (
            <FindingsByFile
              findings={review.findings}
              onMarkFalsePositive={handleMarkFalsePositive}
            />
          ) : viewMode === 'diff' ? (
            <div className="animate-in fade-in duration-300">
              {review.diff_content ? (
                <DiffViewer diff={review.diff_content} findings={review.findings} />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No diff content available for this review.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Critical */}
              {criticalFindings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#ff3366' }}>
                    <AlertTriangle size={20} />
                    Critical Issues ({criticalFindings.length})
                  </h2>
                  <div className="space-y-3">
                    {criticalFindings.map((finding, index) => (
                      <FindingCard key={finding.id} finding={finding} index={index} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* High */}
              {highFindings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#ff6644' }}>
                    <AlertTriangle size={20} />
                    High Priority ({highFindings.length})
                  </h2>
                  <div className="space-y-3">
                    {highFindings.map((finding, index) => (
                      <FindingCard key={finding.id} finding={finding} index={index} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Medium */}
              {mediumFindings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#ffaa00' }}>
                    <AlertCircle size={20} />
                    Medium Priority ({mediumFindings.length})
                  </h2>
                  <div className="space-y-3">
                    {mediumFindings.map((finding, index) => (
                      <FindingCard key={finding.id} finding={finding} index={index} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Low */}
              {lowFindings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <h2 className="text-lg font-display font-semibold mb-3 flex items-center gap-2" style={{ color: '#88cc00' }}>
                    <AlertCircle size={20} />
                    Low Priority ({lowFindings.length})
                  </h2>
                  <div className="space-y-3">
                    {lowFindings.map((finding, index) => (
                      <FindingCard key={finding.id} finding={finding} index={index} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Info */}
              {infoFindings.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-lg font-display font-semibold text-cyber-cyan mb-3 flex items-center gap-2">
                    <Info size={20} />
                    Information ({infoFindings.length})
                  </h2>
                  <div className="space-y-3">
                    {infoFindings.map((finding, index) => (
                      <FindingCard key={finding.id} finding={finding} index={index} />
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyber-green/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="text-cyber-green" size={32} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">
            No Issues Found
          </h3>
          <p className="text-gray-500 font-mono text-sm">
            {review.status === 'completed'
              ? 'Great job! The AI agents found no issues in this code.'
              : 'The review is still in progress. Check back soon.'}
          </p>
        </motion.div>
      )}
    </div>
  )
}
