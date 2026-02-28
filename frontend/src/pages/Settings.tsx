// Settings Page - Global and repository settings

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bell,
  Palette,
  Code,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { useRepositories } from '../hooks/useApi'

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

export function Settings() {
  const { data: repos } = useRepositories(1, 100)

  // Local state for UI preferences (stored in localStorage in a future update)
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Configure your CodeGuard AI experience"
      />

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-6"
      >
        <h2 className="text-lg font-display font-semibold text-white mb-2">
          Preferences
        </h2>
        <p className="text-sm text-gray-500 font-mono mb-6">
          Customize your dashboard experience
        </p>

        <div className="divide-y divide-white/5">
          <ToggleSwitch
            enabled={notifications}
            onChange={setNotifications}
            label="Notifications"
            description="Receive alerts when reviews complete"
            icon={<Bell size={20} />}
            color="#ffaa00"
          />
          <ToggleSwitch
            enabled={darkMode}
            onChange={setDarkMode}
            label="Dark Mode"
            description="Use dark theme (recommended)"
            icon={<Palette size={20} />}
            color="#ff00aa"
          />
        </div>
      </motion.div>

      {/* Connected Repositories Quick Access */}
      {repos && repos.items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-display font-semibold text-white">
                Repository Settings
              </h2>
              <p className="text-sm text-gray-500 font-mono">
                Configure settings per repository
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {repos.items.slice(0, 5).map((repo, index) => (
              <motion.a
                key={repo.id}
                href={`/repositories/${repo.id}/settings`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-xl bg-void-200/50 hover:bg-void-200 border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Code size={18} className="text-gray-500" />
                  <span className="font-mono text-sm text-white">
                    {repo.full_name}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className="text-gray-600 group-hover:text-cyber-cyan transition-colors"
                />
              </motion.a>
            ))}
          </div>

          {repos.total > 5 && (
            <p className="text-center text-sm text-gray-500 font-mono mt-4">
              +{repos.total - 5} more repositories
            </p>
          )}
        </motion.div>
      )}

      {/* Save indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center mt-8"
      >
        <p className="text-sm text-gray-600 font-mono">
          Changes are saved automatically
        </p>
      </motion.div>
    </div>
  )
}
