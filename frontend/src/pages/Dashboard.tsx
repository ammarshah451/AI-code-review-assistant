// Dashboard Page - "Command Horizon" Sovereign OS Design
// Features: HUD overlay, breathing core, liquid metrics, micro-data injection
// Now with 3D Forensic Obsidian Vault background

import { useState, useMemo, useEffect, createContext, useContext } from 'react'
import { motion } from 'framer-motion'
import { GitPullRequest, FolderGit2, Activity, TrendingUp, Shield, Zap, Search } from 'lucide-react'
import { ActivityFeed } from '../components/ActivityFeed'
import { NeuralPolyhedron } from '../components/NeuralPolyhedron'
import { SchematicCard, SchematicStat } from '../components/SchematicCard'
import { TerminalFeed, TerminalHeader } from '../components/TerminalFeed'
import { CommandPalette, useCommandPalette, CommandPaletteTrigger } from '../components/CommandPalette'
import { Sparkline, LiquidProgressRing, DynamicWaveform } from '../components/Sparkline'
import { useStats, useReviews } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'
import { useProgressContext } from '../context/ProgressContext'
import { useDeviceCapability } from '../hooks/useDeviceCapability'

import { MetricsPanel, AgentStatusPanel, ReviewFeedPanel } from '../components/3d/panels'
import { DashboardStage } from './DashboardStage'
import type { MonolithState } from '../components/3d'

// Context for agent filtering
type AgentType = 'logic' | 'security' | 'quality' | null
const AgentFilterContext = createContext<{
  activeAgent: AgentType
  setActiveAgent: (agent: AgentType) => void
}>({ activeAgent: null, setActiveAgent: () => { } })

export function Dashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: reviewsData, isLoading: reviewsLoading } = useReviews(1, 5)
  const commandPalette = useCommandPalette()
  const { activeReview, setActiveReview } = useProgressContext()

  // Interactive agent state
  const [activeAgent, setActiveAgent] = useState<AgentType>(null)
  const [searchValue, setSearchValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const hasProcessing = (stats?.reviews_by_status.processing ?? 0) > 0

  // Auto-detect processing reviews and set activeReview for global progress bar
  useEffect(() => {
    if (reviewsData?.items && !activeReview) {
      const activeReviewData = reviewsData.items.find(
        r => r.status === 'processing' || r.status === 'pending'
      )
      if (activeReviewData) {
        setActiveReview({
          reviewId: activeReviewData.id,
          prNumber: activeReviewData.pr_number,
          prTitle: activeReviewData.pr_title || `PR #${activeReviewData.pr_number}`,
        })
      }
    }
  }, [reviewsData?.items, activeReview, setActiveReview])

  // Polyhedron state changes based on active agent or processing
  const polyhedronState = activeAgent ? 'alert' : hasProcessing ? 'processing' : 'idle'

  // Device capability check for 3D rendering
  const { canRender3D } = useDeviceCapability()

  // Map polyhedron state to monolith state
  const monolithState: MonolithState = polyhedronState as MonolithState

  // Calculate completion rate
  const totalReviews = stats?.total_reviews ?? 0
  const completedReviews = stats?.reviews_by_status.completed ?? 0
  const completionRate = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0

  // Filter reviews based on active agent
  const filteredReviews = useMemo(() => {
    if (!reviewsData?.items || !activeAgent) return reviewsData?.items ?? []
    return reviewsData.items
  }, [reviewsData?.items, activeAgent])

  // Status color and text
  const statusConfig = useMemo(() => {
    if (activeAgent) {
      return { color: '#ff00aa', text: `FILTERING: ${activeAgent.toUpperCase()}` }
    }
    if (hasProcessing) {
      return { color: '#00f0ff', text: 'PROCESSING' }
    }
    return { color: '#00ff88', text: 'STANDBY' }
  }, [activeAgent, hasProcessing])

  // Memoize panels to prevent DashboardStage re-renders
  const dashboardPanels = useMemo(() => [
    {
      id: 'metrics',
      angle: -30,
      title: 'METRICS',
      content: (
        <MetricsPanel
          totalReviews={stats?.total_reviews ?? 0}
          processingCount={stats?.reviews_by_status.processing ?? 0}
          successRate={completionRate}
        />
      ),
    },
    {
      id: 'reviews',
      angle: 0,
      title: 'RECENT',
      content: (
        <ReviewFeedPanel
          reviews={reviewsData?.items ?? []}
          onReviewClick={(review) => navigate(`/reviews/${review.id}`)}
        />
      ),
    },
    {
      id: 'agents',
      angle: 30,
      title: 'AGENTS',
      content: <AgentStatusPanel hasProcessing={hasProcessing} />,
    },
  ], [stats, completionRate, reviewsData?.items, hasProcessing, navigate])

  return (
    <AgentFilterContext.Provider value={{ activeAgent, setActiveAgent }}>
      {/* 3D Background Stage with Fallback */}
      {canRender3D ? (
        <DashboardStage
          monolithState={monolithState}
          panels={dashboardPanels}
        />
      ) : (
        <div className="fixed inset-0 z-0 bg-[#050510]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#00f0ff10_0%,transparent_60%)]" />
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            opacity: 0.2
          }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00f0ff] opacity-5 blur-[100px] rounded-full" />
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        onNavigate={(path) => navigate(path)}
      />

      {/* Scanline overlay */}
      <div className="scanline-overlay" />
      <div className="noise-overlay" />

      {/* Corner system metadata */}
      <div className="fixed top-4 right-72 flex gap-4 text-[6px] font-mono text-gray-700 pointer-events-none z-40">
        <span>CORE_TEMP: 32C</span>
        <span>LATENCY: 42ms</span>
        <span>NODE_ID: 0x4F2</span>
      </div>

      <div className={`max-w-7xl mx-auto relative ${canRender3D ? 'z-10' : ''}`} style={{ perspective: '1200px' }}>
        {/* Header with Neural Search */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 gap-6"
        >
          <div className="flex-1">
            <h1
              className="text-2xl font-display font-bold flex items-center gap-3 chromatic-subtle"
              data-text="Command Center"
            >
              <span className="text-[#00f0ff]">&gt;</span>
              <span>Command Horizon</span>
              <DynamicWaveform
                active={hasProcessing}
                color={hasProcessing ? '#00f0ff' : '#00ff88'}
                bars={4}
              />
            </h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm font-mono text-gray-500">
                SOVEREIGN_OS // REAL-TIME MONITORING
              </p>
              {activeAgent && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setActiveAgent(null)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#ff00aa]/20 text-[#ff00aa] border border-[#ff00aa]/30 hover:bg-[#ff00aa]/30 transition-colors"
                >
                  FILTER: {activeAgent.toUpperCase()} × CLEAR
                </motion.button>
              )}
            </div>
          </div>

          {/* Neural Search */}
          <div className="relative w-64">
            <div className="relative group">
              <Search
                size={14}
                className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${searchFocused ? 'text-[#00f0ff]' : 'text-gray-600'
                  }`}
              />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Neural search..."
                className="w-full bg-transparent border-none outline-none pl-9 pr-4 py-2 text-white font-mono text-sm placeholder:text-gray-600"
              />
              {/* Underline */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-px"
                style={{
                  background: searchFocused
                    ? 'linear-gradient(90deg, transparent, #00f0ff, transparent)'
                    : 'rgba(255,255,255,0.1)',
                  boxShadow: searchFocused ? '0 0 10px #00f0ff' : 'none',
                }}
                animate={{ scaleX: searchFocused ? 1 : 0.5, opacity: searchFocused ? 1 : 0.5 }}
                transition={{ duration: 0.2 }}
              />
              {/* Label */}
              <motion.span
                className="absolute -top-4 left-0 text-[8px] font-mono text-[#00f0ff] uppercase tracking-widest"
                animate={{ opacity: searchFocused ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              >
                Neural Search
              </motion.span>
            </div>
          </div>

          <CommandPaletteTrigger onClick={commandPalette.open} />
        </motion.div>

        {/* Neural Polyhedron Hero + Live Metrics - 8px grid aligned */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Polyhedron Card with HUD Overlay */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <SchematicCard label="NEURAL_CORE" delay={0.1}>
              <div className="p-6 relative">
                {/* Top bracket label */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-start gap-2 z-10">
                  <div className="w-6 h-3 border-t border-l border-[#00f0ff]/30" />
                  <span className="text-[7px] font-mono text-gray-600 uppercase tracking-widest px-1 -mt-1">
                    Neural Core
                  </span>
                  <div className="w-6 h-3 border-t border-r border-[#00f0ff]/30" />
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative">
                    {/* Background glow - changes with active agent */}
                    <div
                      className="absolute inset-0 blur-3xl opacity-20 transition-colors duration-500"
                      style={{
                        background: activeAgent === 'logic'
                          ? 'radial-gradient(circle, #00f0ff 0%, transparent 70%)'
                          : activeAgent === 'security'
                            ? 'radial-gradient(circle, #ff00aa 0%, transparent 70%)'
                            : activeAgent === 'quality'
                              ? 'radial-gradient(circle, #00ff88 0%, transparent 70%)'
                              : hasProcessing
                                ? 'radial-gradient(circle, #00f0ff 0%, transparent 70%)'
                                : 'radial-gradient(circle, #00ff88 0%, transparent 70%)',
                      }}
                    />
                    {canRender3D ? (
                      <div className="w-[220px] h-[220px]" /> /* Placeholder for keeping layout when 3D is in BG */
                    ) : (
                      <NeuralPolyhedron state={polyhedronState} size={220} />
                    )}
                  </div>

                  {/* HUD Stats - Right side overlay */}
                  <div className="ml-8 space-y-5">
                    {/* Status */}
                    <div>
                      <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-wider">
                        System Status
                      </span>
                      <span
                        className="block text-lg font-display font-bold mt-1 transition-colors duration-300"
                        style={{
                          color: statusConfig.color,
                          textShadow: `0 0 20px ${statusConfig.color}50`,
                        }}
                      >
                        {statusConfig.text}
                      </span>
                    </div>

                    {/* Active Agents with HUD bracket */}
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-wider">
                          Active Agents
                        </span>
                        <span className="block text-2xl font-mono font-bold text-white">3</span>
                      </div>
                      <div className="w-6 h-6 border border-[#00f0ff]/30 rounded flex items-center justify-center">
                        <div
                          className="w-2 h-2 rounded-full bg-[#00f0ff]"
                          style={{ boxShadow: '0 0 8px #00f0ff' }}
                        />
                      </div>
                    </div>

                    {/* Completion with Liquid Ring */}
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-wider">
                          Completion
                        </span>
                      </div>
                      <LiquidProgressRing
                        progress={completionRate}
                        size={48}
                        strokeWidth={3}
                        color="#00ff88"
                        value={`${completionRate}%`}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom bracket */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-2 z-10">
                  <div className="w-6 h-3 border-b border-l border-[#ff00aa]/30" />
                  <span className="text-[6px] font-mono text-gray-700 uppercase tracking-widest px-1 mb-0.5">
                    v2.1.0
                  </span>
                  <div className="w-6 h-3 border-b border-r border-[#ff00aa]/30" />
                </div>
              </div>
            </SchematicCard>
          </motion.div>

          {/* Intelligence HUD - 2x2 Compact Grid */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SchematicCard label="INTELLIGENCE_HUD" delay={0.2}>
              <div className="p-4">
                {/* 2x2 Grid - Metrics + Agent Status merged */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Metric: Latency */}
                  <IntelligenceCell
                    label="LATENCY"
                    value={42}
                    unit="ms"
                    color="#00f0ff"
                    nodeId="0xL1"
                  />
                  {/* Metric: Queue */}
                  <IntelligenceCell
                    label="QUEUE"
                    value={stats?.reviews_by_status.processing ?? 0}
                    color="#ffaa00"
                    nodeId="0xQ1"
                    active={hasProcessing}
                  />
                  {/* Metric: Success */}
                  <IntelligenceCell
                    label="SUCCESS"
                    value={completionRate}
                    unit="%"
                    color="#00ff88"
                    nodeId="0xS1"
                  />
                  {/* Metric: Throughput */}
                  <IntelligenceCell
                    label="THROUGHPUT"
                    value={12}
                    unit="/hr"
                    color="#ff00aa"
                    nodeId="0xT1"
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-3" />

                {/* Compact Agent Status Row */}
                <div className="flex items-center justify-between gap-2">
                  <CompactAgentIndicator
                    name="LOGIC"
                    color="#00f0ff"
                    isActive={hasProcessing}
                    agentKey="logic"
                  />
                  <CompactAgentIndicator
                    name="SECURITY"
                    color="#ff00aa"
                    isActive={hasProcessing}
                    agentKey="security"
                  />
                  <CompactAgentIndicator
                    name="QUALITY"
                    color="#00ff88"
                    isActive={false}
                    agentKey="quality"
                  />
                </div>

                {/* Corner metadata */}
                <div className="absolute bottom-1 right-3 text-[6px] font-mono text-gray-700">
                  HUD_ID: 0xA1
                </div>
              </div>
            </SchematicCard>
          </motion.div>
        </div>

        {/* Stats Grid with Liquid Sparklines */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 rounded bg-[#0a0a0f]/60 animate-pulse" />
              ))}
            </>
          ) : stats ? (
            <>
              <SchematicStat
                title="Total Reviews"
                value={stats.total_reviews}
                label="REV_COUNT"
                color="cyan"
                icon={<GitPullRequest size={20} />}
                delay={0.1}
                sparkline={<Sparkline width={50} height={20} color="#00f0ff" showDot={false} liquidFill />}
              />
              <SchematicStat
                title="Repositories"
                value={stats.total_repositories}
                label="REPO_COUNT"
                color="magenta"
                icon={<FolderGit2 size={20} />}
                delay={0.15}
              />
              <SchematicStat
                title="Processing"
                value={stats.reviews_by_status.processing}
                label="QUEUE_ACTIVE"
                color="amber"
                icon={<Activity size={20} />}
                delay={0.2}
                sparkline={<Sparkline width={50} height={20} color="#ffaa00" showDot={false} liquidFill />}
              />
              <SchematicStat
                title="Success Rate"
                value={`${completionRate}%`}
                label="PERF_METRIC"
                color="green"
                icon={<TrendingUp size={20} />}
                delay={0.25}
              />
            </>
          ) : null}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terminal Feed - Tabletop Terminal with subtle skew */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotateX: -25 }}
            animate={{ opacity: 1, y: 0, rotateX: -8 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-2"
            style={{ transformStyle: 'preserve-3d', transformOrigin: 'center top' }}
          >
            <SchematicCard label="REVIEW_FEED" delay={0.3}>
              <div className="p-5">
                <TerminalHeader
                  title="Recent Reviews"
                  subtitle={activeAgent ? `filtered by ${activeAgent} agent` : 'real-time activity feed'}
                  onAction={() => navigate('/reviews')}
                  actionLabel="View All"
                />
                <TerminalFeed
                  reviews={filteredReviews}
                  onReviewClick={(review) => navigate(`/reviews/${review.id}`)}
                  isLoading={reviewsLoading}
                />
              </div>
            </SchematicCard>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Interactive Agent Status */}
            <SchematicCard label="AGENT_STATUS" delay={0.4}>
              <div className="p-5 space-y-2">
                <h3 className="text-sm font-mono text-gray-500 uppercase tracking-wider mb-4">
                  Active Agents
                  <span className="text-[8px] text-gray-700 ml-2">(click to filter)</span>
                </h3>

                <InteractiveAgentItem
                  name="LOGIC"
                  agentKey="logic"
                  color="#00f0ff"
                  description="Analyzing code patterns"
                  isProcessing={hasProcessing}
                />
                <InteractiveAgentItem
                  name="SECURITY"
                  agentKey="security"
                  color="#ff00aa"
                  description="Scanning vulnerabilities"
                  isProcessing={hasProcessing}
                />
                <InteractiveAgentItem
                  name="QUALITY"
                  agentKey="quality"
                  color="#00ff88"
                  description="Checking best practices"
                  isProcessing={false}
                />
              </div>
            </SchematicCard>

            {/* Quick Actions */}
            <SchematicCard label="ACTIONS" delay={0.5}>
              <div className="p-5 space-y-3">
                <button
                  onClick={() => navigate('/repositories')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#0d0d14] border border-white/10 rounded text-left group hover:border-[#00f0ff]/50 transition-all"
                >
                  <FolderGit2 size={16} className="text-[#00f0ff]" />
                  <div className="flex-1">
                    <span className="block text-sm font-mono text-white group-hover:text-[#00f0ff] transition-colors">
                      Connect Repository
                    </span>
                    <span className="block text-xs text-gray-600">Link a GitHub repo</span>
                  </div>
                  <span className="text-gray-600 group-hover:text-[#00f0ff] transition-colors">
                    →
                  </span>
                </button>

                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#0d0d14] border border-white/10 rounded text-left group hover:border-[#ff00aa]/50 transition-all"
                >
                  <Zap size={16} className="text-[#ff00aa]" />
                  <div className="flex-1">
                    <span className="block text-sm font-mono text-white group-hover:text-[#ff00aa] transition-colors">
                      Configure Agents
                    </span>
                    <span className="block text-xs text-gray-600">Tune analysis settings</span>
                  </div>
                  <span className="text-gray-600 group-hover:text-[#ff00aa] transition-colors">
                    →
                  </span>
                </button>
              </div>
            </SchematicCard>

            {/* Activity Feed */}
            <ActivityFeed />

            {/* System Info */}
            <SchematicCard label="SYS_INFO" variant="success" delay={0.6}>
              <div className="p-5 relative">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={14} className="text-[#00ff88]" />
                  <span className="text-xs font-mono text-[#00ff88]">ALL SYSTEMS NOMINAL</span>
                </div>
                <div className="space-y-2 text-xs font-mono text-gray-500">
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-gray-400">v2.1.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime</span>
                    <span className="text-gray-400">99.9%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency</span>
                    <span className="text-gray-400">&lt;50ms</span>
                  </div>
                </div>
                {/* Corner metadata */}
                <div className="absolute bottom-2 right-2 text-[6px] font-mono text-gray-700">
                  SYS_OK: TRUE
                </div>
              </div>
            </SchematicCard>
          </motion.div>
        </div>
      </div>
    </AgentFilterContext.Provider>
  )
}

// Interactive agent status item with click-to-filter
interface InteractiveAgentItemProps {
  name: string
  agentKey: AgentType
  color: string
  description: string
  isProcessing: boolean
}

function InteractiveAgentItem({ name, agentKey, color, description, isProcessing }: InteractiveAgentItemProps) {
  const { activeAgent, setActiveAgent } = useContext(AgentFilterContext)
  const isActive = activeAgent === agentKey
  const isFiltered = activeAgent !== null && !isActive

  return (
    <motion.button
      onClick={() => setActiveAgent(isActive ? null : agentKey)}
      className={`w-full flex items-center gap-3 py-3 px-3 rounded transition-all text-left group ${isActive
        ? 'bg-white/5 border border-white/10'
        : isFiltered
          ? 'opacity-40 hover:opacity-70'
          : 'hover:bg-white/5'
        }`}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Pulsing neon dot */}
      <div className="relative">
        <motion.div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          animate={
            isProcessing && !isFiltered
              ? { opacity: [0.4, 1, 0.4], scale: [0.8, 1.1, 0.8] }
              : { opacity: [0.6, 1, 0.6] }
          }
          transition={{
            duration: isProcessing ? 0.5 : 2,
            repeat: Infinity,
          }}
        />
        {/* Pulse ring when processing */}
        {isProcessing && !isFiltered && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${color}` }}
            animate={{ scale: [1, 2], opacity: [0.6, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      <div className="flex-1">
        <span className="block text-sm font-mono text-white">{name}</span>
        <span className="block text-[10px] text-gray-600">{description}</span>
      </div>

      {/* Status indicator */}
      <span
        className={`text-[8px] font-mono px-2 py-0.5 rounded transition-all ${isActive ? 'bg-white/10' : ''
          }`}
        style={{
          color: isFiltered ? '#666' : color,
          backgroundColor: isActive ? `${color}20` : 'transparent',
        }}
      >
        {isProcessing && !isFiltered ? 'ACTIVE' : isActive ? 'SELECTED' : 'IDLE'}
      </span>
    </motion.button>
  )
}

// Intelligence Cell - Compact metric with liquid sparkline
interface IntelligenceCellProps {
  label: string
  value: number | string
  unit?: string
  color: string
  nodeId: string
  active?: boolean
}

function IntelligenceCell({ label, value, unit, color, nodeId, active = false }: IntelligenceCellProps) {
  return (
    <div className="relative p-2 rounded bg-[#0a0a0f]/50 border border-white/5">
      {/* Node ID - corner metadata */}
      <span className="absolute top-1 right-1 text-[5px] font-mono text-gray-700">
        {nodeId}
      </span>

      {/* Label */}
      <span className="block text-[7px] font-mono text-gray-600 uppercase tracking-wider mb-1">
        {label}
      </span>

      {/* Value with liquid sparkline */}
      <div className="flex items-end justify-between gap-2">
        <span
          className="text-lg font-mono font-bold"
          style={{ color, textShadow: `0 0 10px ${color}40` }}
        >
          {value}
          {unit && <span className="text-[8px] text-gray-500 ml-0.5">{unit}</span>}
        </span>

        {/* Liquid Sparkline */}
        <LiquidSparkline color={color} active={active} />
      </div>
    </div>
  )
}

// Liquid Sparkline - Jagged line with gradient fill
function LiquidSparkline({ color, active = false }: { color: string; active?: boolean }) {
  const [data, setData] = useState<number[]>(() =>
    Array.from({ length: 8 }, () => Math.random())
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev.slice(1), Math.random()])
    }, active ? 300 : 800)
    return () => clearInterval(interval)
  }, [active])

  const path = useMemo(() => {
    const width = 32
    const height = 16
    return data.map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - v * height * 0.8 - height * 0.1
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }, [data])

  const fillPath = `${path} L32,16 L0,16 Z`
  const gradientId = `liquid-${color.replace('#', '')}`

  return (
    <svg width={32} height={16} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 2px ${color})` }}
      />
    </svg>
  )
}

// Compact Agent Indicator for HUD
interface CompactAgentIndicatorProps {
  name: string
  color: string
  isActive: boolean
  agentKey: AgentType
}

function CompactAgentIndicator({ name, color, isActive, agentKey }: CompactAgentIndicatorProps) {
  const { activeAgent, setActiveAgent } = useContext(AgentFilterContext)
  const isSelected = activeAgent === agentKey

  return (
    <motion.button
      onClick={() => setActiveAgent(isSelected ? null : agentKey)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'
        }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        animate={isActive ? { opacity: [0.5, 1, 0.5] } : {}}
        transition={{ duration: 0.5, repeat: Infinity }}
      />
      <span
        className="text-[8px] font-mono uppercase tracking-wider"
        style={{ color: isSelected ? color : '#666' }}
      >
        {name}
      </span>
    </motion.button>
  )
}
