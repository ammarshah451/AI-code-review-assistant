// Repository Settings Page - Configure per-repository settings

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Brain,
  Shield,
  Sparkles,
  ArrowLeft,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  Save,
} from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { useRepository, useRepositorySettings, useUpdateRepositorySettings } from '../hooks/useApi'
import type { Severity } from '../types'

interface ToggleSwitchProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  label: string
  description?: string
  icon?: React.ReactNode
  color?: string
}

function ToggleSwitch({ enabled, onChange, label, description, icon, color = '#00f0ff' }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        )}
        <div>
          <h4 className="font-medium text-white">{label}</h4>
          {description && (
            <p className="text-sm text-gray-500 font-mono">{description}</p>
          )}
        </div>
      </div>

      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
          enabled ? 'bg-cyber-cyan/30' : 'bg-void-200'
        }`}
        style={{
          boxShadow: enabled ? `0 0 20px ${color}30` : 'none',
        }}
      >
        <motion.div
          className="absolute top-1 w-6 h-6 rounded-full"
          style={{
            backgroundColor: enabled ? color : '#4a4a5a',
            boxShadow: enabled ? `0 0 10px ${color}` : 'none',
          }}
          animate={{ left: enabled ? 28 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}

interface SeveritySelectProps {
  value: Severity
  onChange: (value: Severity) => void
}

function SeveritySelect({ value, onChange }: SeveritySelectProps) {
  const options: Array<{ value: Severity; label: string; icon: typeof AlertTriangle; color: string }> = [
    { value: 'critical', label: 'Critical Only', icon: AlertTriangle, color: '#ff3366' },
    { value: 'high', label: 'High & Above', icon: AlertTriangle, color: '#ff6644' },
    { value: 'medium', label: 'Medium & Above', icon: AlertCircle, color: '#ffaa00' },
    { value: 'low', label: 'Low & Above', icon: AlertCircle, color: '#88cc00' },
    { value: 'info', label: 'All Issues', icon: Info, color: '#00f0ff' },
  ]

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              isSelected
                ? 'border-white/20 bg-void-50'
                : 'border-white/5 bg-void-100/50 hover:border-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${option.color}15` }}
              >
                <Icon size={16} style={{ color: option.color }} />
              </div>
              <span className={isSelected ? 'text-white' : 'text-gray-400'}>
                {option.label}
              </span>
            </div>

            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-cyber-cyan/20 flex items-center justify-center"
              >
                <Check size={14} className="text-cyber-cyan" />
              </motion.div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function RepositorySettings() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()

  const { data: repo, isLoading: repoLoading } = useRepository(repoId || '')
  const { data: settings, isLoading: settingsLoading } = useRepositorySettings(repoId || '')
  const updateMutation = useUpdateRepositorySettings(repoId || '')

  // Local state for form
  const [enabled, setEnabled] = useState(true)
  const [agentsEnabled, setAgentsEnabled] = useState({
    logic: true,
    security: true,
    quality: true,
  })
  const [severityThreshold, setSeverityThreshold] = useState<Severity>('info')
  const [hasChanges, setHasChanges] = useState(false)

  // Sync settings to local state
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled)
      setAgentsEnabled(settings.agents_enabled)
      setSeverityThreshold(settings.severity_threshold)
      setHasChanges(false)
    }
  }, [settings])

  // Track changes
  useEffect(() => {
    if (settings) {
      const changed =
        enabled !== settings.enabled ||
        agentsEnabled.logic !== settings.agents_enabled.logic ||
        agentsEnabled.security !== settings.agents_enabled.security ||
        agentsEnabled.quality !== settings.agents_enabled.quality ||
        severityThreshold !== settings.severity_threshold
      setHasChanges(changed)
    }
  }, [enabled, agentsEnabled, severityThreshold, settings])

  const handleSave = () => {
    updateMutation.mutate({
      enabled,
      agents_enabled: agentsEnabled,
      severity_threshold: severityThreshold,
    })
  }

  if (repoLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyber-cyan animate-spin" />
      </div>
    )
  }

  if (!repo || !settings) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Repository not found</p>
        <button
          onClick={() => navigate('/repositories')}
          className="mt-4 cyber-button cyber-button-ghost rounded-xl"
        >
          Back to Repositories
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/repositories')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-mono text-sm"
        >
          <ArrowLeft size={16} />
          Back to Repositories
        </button>
      </div>

      <PageHeader
        title={repo.full_name}
        subtitle="Repository Settings"
        action={
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="cyber-button cyber-button-primary rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </motion.button>
        }
      />

      {/* Review Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-6"
      >
        <ToggleSwitch
          enabled={enabled}
          onChange={setEnabled}
          label="Enable Reviews"
          description="Automatically review pull requests on this repository"
          color="#00f0ff"
        />
      </motion.div>

      {/* AI Agents Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 mb-6"
      >
        <h2 className="text-lg font-display font-semibold text-white mb-2">
          AI Agents
        </h2>
        <p className="text-sm text-gray-500 font-mono mb-6">
          Enable or disable individual code review agents
        </p>

        <div className="divide-y divide-white/5">
          <ToggleSwitch
            enabled={agentsEnabled.logic}
            onChange={(val) => setAgentsEnabled({ ...agentsEnabled, logic: val })}
            label="Logic Agent"
            description="Detects null checks, off-by-one errors, type mismatches"
            icon={<Brain size={20} />}
            color="#00f0ff"
          />
          <ToggleSwitch
            enabled={agentsEnabled.security}
            onChange={(val) => setAgentsEnabled({ ...agentsEnabled, security: val })}
            label="Security Agent"
            description="Finds SQL injection, XSS, hardcoded secrets"
            icon={<Shield size={20} />}
            color="#ff00aa"
          />
          <ToggleSwitch
            enabled={agentsEnabled.quality}
            onChange={(val) => setAgentsEnabled({ ...agentsEnabled, quality: val })}
            label="Quality Agent"
            description="Checks PEP8 style, complexity, naming conventions"
            icon={<Sparkles size={20} />}
            color="#00ff88"
          />
        </div>
      </motion.div>

      {/* Severity Threshold */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6 mb-6"
      >
        <h2 className="text-lg font-display font-semibold text-white mb-2">
          Severity Threshold
        </h2>
        <p className="text-sm text-gray-500 font-mono mb-6">
          Minimum severity level to include in review comments
        </p>

        <SeveritySelect value={severityThreshold} onChange={setSeverityThreshold} />
      </motion.div>

      {/* Success message */}
      {updateMutation.isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-sm text-cyber-green font-mono">
            Settings saved successfully
          </p>
        </motion.div>
      )}

      {/* Error message */}
      {updateMutation.isError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-sm text-cyber-crimson font-mono">
            Failed to save settings. Please try again.
          </p>
        </motion.div>
      )}
    </div>
  )
}
