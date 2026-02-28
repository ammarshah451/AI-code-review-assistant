import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  File,
  Copy,
  Flag,
  AlertTriangle,
  AlertCircle,
  Info,
  Check
} from 'lucide-react'
import type { Finding, Confidence, Severity, AgentType } from '../types'

interface FindingsByFileProps {
  findings: Finding[]
  onMarkFalsePositive: (findingId: string, reason?: string) => void
}

const severityConfig: Record<Severity, { icon: typeof AlertTriangle; color: string; label: string }> = {
  critical: { icon: AlertTriangle, color: '#ff3366', label: 'Critical Warning' },
  high: { icon: AlertTriangle, color: '#ff6644', label: 'High Severity' },
  medium: { icon: AlertCircle, color: '#ffaa00', label: 'Medium Severity' },
  low: { icon: AlertCircle, color: '#88cc00', label: 'Low Severity' },
  info: { icon: Info, color: '#00f0ff', label: 'Info' },
}

const confidenceConfig: Record<Confidence, { color: string; label: string }> = {
  high: { color: '#00ff88', label: 'High Confidence' },
  medium: { color: '#ffaa00', label: 'Medium Confidence' },
  low: { color: '#666666', label: 'Low Confidence' },
}

const agentConfig: Record<AgentType, { color: string; label: string }> = {
  logic: { color: '#00f0ff', label: 'Logic Agent' },
  security: { color: '#ff00aa', label: 'Security Agent' },
  quality: { color: '#00ff88', label: 'Quality Agent' },
}

function FindingCard({
  finding,
  onMarkFalsePositive
}: {
  finding: Finding
  onMarkFalsePositive: (findingId: string, reason?: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showFPModal, setShowFPModal] = useState(false)
  const [fpReason, setFPReason] = useState('')

  const severity = severityConfig[finding.severity] || severityConfig.info
  const confidence = confidenceConfig[finding.confidence || 'medium']
  const agent = agentConfig[finding.agent_type]
  const SeverityIcon = severity.icon

  const handleCopy = () => {
    if (finding.suggestion) {
      navigator.clipboard.writeText(finding.suggestion)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleFalsePositive = () => {
    onMarkFalsePositive(finding.id, fpReason || undefined)
    setShowFPModal(false)
    setFPReason('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-l-2 pl-4 py-2 ${finding.is_false_positive ? 'opacity-50' : ''}`}
      style={{ borderColor: severity.color }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 text-left"
      >
        {isExpanded ? (
          <ChevronDown size={16} className="text-gray-500 mt-1 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-500 mt-1 flex-shrink-0" />
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityIcon size={14} style={{ color: severity.color }} />
            <span
              className={`text-sm font-medium ${finding.is_false_positive ? 'line-through' : ''}`}
              style={{ color: finding.is_false_positive ? '#666' : 'white' }}
            >
              {finding.title}
            </span>

            {/* Badges */}
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono border"
              style={{
                backgroundColor: `${severity.color}15`,
                color: severity.color,
                borderColor: `${severity.color}40`
              }}
            >
              {severity.label}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono border"
              style={{
                backgroundColor: `${agent.color}15`,
                color: agent.color,
                borderColor: `${agent.color}40`
              }}
            >
              {agent.label}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono border"
              style={{
                backgroundColor: `${confidence.color}15`,
                color: confidence.color,
                borderColor: `${confidence.color}40`
              }}
            >
              {confidence.label}
            </span>

            {finding.line_number && (
              <span className="text-xs text-gray-500 font-mono">
                :{finding.line_number}
              </span>
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-6 space-y-2">
              <p className="text-sm text-gray-300">{finding.description}</p>

              {finding.suggestion && (
                <div className="p-3 rounded-lg bg-cyber-green/5 border border-cyber-green/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-cyber-green uppercase">
                      Suggestion
                    </span>
                    <button
                      onClick={handleCopy}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-300">{finding.suggestion}</p>
                </div>
              )}

              {!finding.is_false_positive && (
                <button
                  onClick={() => setShowFPModal(true)}
                  className="text-xs text-gray-500 hover:text-cyber-amber flex items-center gap-1"
                >
                  <Flag size={12} />
                  Mark as False Positive
                </button>
              )}

              {/* False Positive Modal */}
              {showFPModal && (
                <div className="p-3 rounded-lg bg-void-200 border border-white/10">
                  <p className="text-sm text-white mb-2">Why is this a false positive?</p>
                  <input
                    type="text"
                    value={fpReason}
                    onChange={(e) => setFPReason(e.target.value)}
                    placeholder="Optional reason..."
                    className="w-full cyber-input text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleFalsePositive}
                      className="text-xs px-3 py-1 rounded bg-cyber-amber/20 text-cyber-amber hover:bg-cyber-amber/30"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowFPModal(false)}
                      className="text-xs px-3 py-1 rounded bg-void-300 text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FindingsByFile({ findings, onMarkFalsePositive }: FindingsByFileProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // Group findings by file
  const fileGroups = findings.reduce((acc, finding) => {
    const file = finding.file_path
    if (!acc[file]) {
      acc[file] = []
    }
    acc[file].push(finding)
    return acc
  }, {} as Record<string, Finding[]>)

  // Sort files by number of findings (descending)
  const sortedFiles = Object.entries(fileGroups).sort(
    ([, a], [, b]) => b.length - a.length
  )

  // Initialize all files as expanded on mount
  useEffect(() => {
    if (expandedFiles.size === 0 && sortedFiles.length > 0) {
      setExpandedFiles(new Set(sortedFiles.map(([file]) => file)))
    }
  }, [sortedFiles.length])

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(file)) {
        next.delete(file)
      } else {
        next.add(file)
      }
      return next
    })
  }

  if (findings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No findings to display</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedFiles.map(([file, fileFindings]) => {
        const isExpanded = expandedFiles.has(file)
        const activeFindings = fileFindings.filter(f => !f.is_false_positive)

        return (
          <div key={file} className="glass-card overflow-hidden">
            <button
              onClick={() => toggleFile(file)}
              className="w-full flex items-center gap-3 p-4 hover:bg-void-50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={18} className="text-gray-400" />
              ) : (
                <ChevronRight size={18} className="text-gray-400" />
              )}
              <File size={18} className="text-cyber-cyan" />
              <span className="flex-1 text-left font-mono text-sm text-white">
                {file}
              </span>
              <span className="text-xs font-mono text-gray-500">
                {activeFindings.length} issue{activeFindings.length !== 1 ? 's' : ''}
              </span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    {fileFindings.map(finding => (
                      <FindingCard
                        key={finding.id}
                        finding={finding}
                        onMarkFalsePositive={onMarkFalsePositive}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
