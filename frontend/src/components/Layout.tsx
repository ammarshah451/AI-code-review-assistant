// Main Layout with sidebar and content area
// Updated for 3D support with proper z-indexing

import { motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import type { ReactNode } from 'react'
import { useDeviceCapability } from '../hooks/useDeviceCapability'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { canRender3D } = useDeviceCapability()

  return (
    <div className="min-h-screen bg-void cyber-grid-bg noise-overlay relative">
      {/* Ambient background effects - hidden when 3D is active */}
      {!canRender3D && (
        <div className="fixed inset-0 pointer-events-none z-0">
          {/* Top left glow */}
          <div
            className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30 blur-[100px]"
            style={{ background: 'radial-gradient(circle, #00f0ff 0%, transparent 70%)' }}
          />
          {/* Bottom right glow */}
          <div
            className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-[100px]"
            style={{ background: 'radial-gradient(circle, #ff00aa 0%, transparent 70%)' }}
          />
          {/* Center subtle glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10 blur-[150px]"
            style={{ background: 'radial-gradient(circle, #00ff88 0%, transparent 70%)' }}
          />
        </div>
      )}

      {/* Sidebar - high z-index to stay above 3D canvas */}
      <div className="relative z-50">
        <Sidebar />
      </div>

      {/* Main content - relative positioning for 3D stages */}
      <main className="ml-20 lg:ml-64 min-h-screen relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="p-6 lg:p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}

// Page header component
interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
    >
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-1">
          {title}
        </h1>
        {subtitle && (
          <p className="text-gray-500 font-mono text-sm">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  )
}

// Empty state component
interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <motion.div
        className="w-20 h-20 rounded-2xl bg-void-200 flex items-center justify-center mb-6"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="text-gray-600">{icon}</div>
      </motion.div>
      <h3 className="text-xl font-display font-semibold text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-500 font-mono text-sm max-w-md mb-6">
        {description}
      </p>
      {action}
    </motion.div>
  )
}

// Loading state
export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="relative">
        <div className="cyber-spinner" />
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-50"
          style={{ background: 'linear-gradient(135deg, #00f0ff, #ff00aa)' }}
        />
      </div>
    </div>
  )
}
