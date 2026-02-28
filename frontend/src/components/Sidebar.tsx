// Sidebar Navigation - "Nerve Center" Sovereign OS Design
// Features: Glassmorphism, Laser Gutter, System Status Metrics, Scan-line Animation

import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import clsx from 'clsx'

// Wireframe icon components matching the Polyhedron aesthetic
function WireframeIcon({ type, isActive }: { type: string; isActive: boolean }) {
  const color = isActive ? '#00f0ff' : 'currentColor'

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: isActive ? 'drop-shadow(0 0 4px #00f0ff)' : undefined }}
    >
      <defs>
        <filter id="icon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {type === 'dashboard' && (
        <>
          {/* Wireframe grid/dashboard */}
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          {/* Inner detail lines */}
          <line x1="6.5" y1="5" x2="6.5" y2="8" strokeWidth="1" opacity="0.5" />
          <line x1="17.5" y1="5" x2="17.5" y2="8" strokeWidth="1" opacity="0.5" />
        </>
      )}

      {type === 'reviews' && (
        <>
          {/* Wireframe git pull request */}
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <circle cx="6" cy="18" r="2" />
          <line x1="6" y1="8" x2="6" y2="16" />
          <path d="M6 12 Q12 12, 18 16" fill="none" />
        </>
      )}

      {type === 'repositories' && (
        <>
          {/* Wireframe folder structure */}
          <path d="M4 4 L10 4 L12 7 L20 7 L20 20 L4 20 Z" />
          <line x1="4" y1="10" x2="20" y2="10" strokeWidth="1" opacity="0.5" />
          {/* Branch indicator */}
          <circle cx="12" cy="15" r="1.5" />
          <line x1="12" y1="10" x2="12" y2="13.5" strokeWidth="1" />
        </>
      )}

      {type === 'settings' && (
        <>
          {/* Wireframe gear/cog */}
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2 L12 5 M12 19 L12 22" />
          <path d="M2 12 L5 12 M19 12 L22 12" />
          <path d="M4.93 4.93 L7.05 7.05 M16.95 16.95 L19.07 19.07" />
          <path d="M19.07 4.93 L16.95 7.05 M7.05 16.95 L4.93 19.07" />
        </>
      )}
    </svg>
  )
}

const navItems = [
  { path: '/', type: 'dashboard', label: 'Dashboard', shortcut: 'G D' },
  { path: '/reviews', type: 'reviews', label: 'Reviews', shortcut: 'G R' },
  { path: '/repositories', type: 'repositories', label: 'Repositories', shortcut: 'G P' },
  { path: '/settings', type: 'settings', label: 'Settings', shortcut: 'G S' },
]

// Magnetic Item Component
function MagneticItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    const { currentTarget, clientX, clientY } = e
    const { left, top, width, height } = currentTarget.getBoundingClientRect()
    const x = clientX - (left + width / 2)
    const y = clientY - (top + height / 2)
    setPosition({ x, y })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x * 0.2, y: position.y * 0.2 }}
      transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function Sidebar() {
  const location = useLocation()
  const [githubStatus] = useState<'online' | 'degraded' | 'offline'>('online')
  const [systemLatency, setSystemLatency] = useState(42)

  // Agent uptime metrics (simulated)
  const [agentMetrics, setAgentMetrics] = useState({
    logic: 99.2,
    security: 98.8,
    quality: 99.5,
  })

  // Simulate latency updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLatency(Math.floor(30 + Math.random() * 40))
      // Subtle fluctuations in agent uptime
      setAgentMetrics({
        logic: 98 + Math.random() * 2,
        security: 97.5 + Math.random() * 2.5,
        quality: 98.5 + Math.random() * 1.5,
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 w-20 lg:w-64 z-50 flex flex-col"
      style={{
        background: 'rgba(5, 5, 8, 0.3)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(0, 240, 255, 0.08)',
      }}
    >
      {/* Vertical scan-line effect - crawling animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute left-0 right-0 h-32 opacity-[0.07]"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 240, 255, 0.4) 50%, transparent 100%)',
          }}
          animate={{ y: ['-128px', 'calc(100vh + 128px)'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
        {/* Secondary slower scanline */}
        <motion.div
          className="absolute left-0 right-0 h-64 opacity-[0.03]"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(255, 0, 170, 0.3) 50%, transparent 100%)',
          }}
          animate={{ y: ['-256px', 'calc(100vh + 256px)'] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Corner brackets */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-[#00f0ff]/30" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-[#00f0ff]/30" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-[#ff00aa]/30" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-[#ff00aa]/30" />

      {/* Logo */}
      <Link to="/" className="p-4 lg:p-6 flex items-center gap-3 group relative">
        <MagneticItem>
          <motion.div
            className="relative w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            {/* Wireframe shield */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00f0ff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.5))' }}
            >
              <path d="M12 3 L20 7 L20 13 C20 17 16 21 12 22 C8 21 4 17 4 13 L4 7 Z" />
              <path d="M12 8 L12 14" strokeWidth="1" opacity="0.6" />
              <path d="M9 11 L15 11" strokeWidth="1" opacity="0.6" />
            </svg>

            {/* Pulse ring on hover */}
            <motion.div
              className="absolute inset-0 rounded-full border border-[#00f0ff]/30"
              initial={{ scale: 1, opacity: 0 }}
              whileHover={{ scale: 1.5, opacity: [0, 0.5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </motion.div>
        </MagneticItem>

        <div className="hidden lg:block">
          <h1 className="font-display font-bold text-lg text-white tracking-wide">
            <span className="text-[#00f0ff]">Code</span>Guard
          </h1>
          <span className="text-[8px] font-mono text-gray-500 tracking-[0.3em] uppercase">
            Sovereign Edition
          </span>
        </div>

        {/* Tiny metadata */}
        <span className="hidden lg:block absolute top-2 right-2 text-[6px] font-mono text-gray-700">
          SYS_ID: 0x4F2
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path

            return (
              <MagneticItem key={item.path}>
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={item.path}
                    className={clsx(
                      'relative flex items-center gap-3 px-3 py-3 rounded transition-all duration-300 group overflow-hidden',
                      isActive
                        ? 'text-white'
                        : 'text-gray-500 hover:text-white'
                    )}
                  >
                    {/* Active background with scan-line */}
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 rounded overflow-hidden"
                        style={{
                          background: 'rgba(0, 240, 255, 0.05)',
                          border: '1px solid rgba(0, 240, 255, 0.2)',
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      >
                        {/* Crawling scan-line inside active item */}
                        <motion.div
                          className="absolute left-0 right-0 h-full"
                          style={{
                            background: 'linear-gradient(180deg, transparent 0%, rgba(0, 240, 255, 0.1) 50%, transparent 100%)',
                            height: '200%',
                          }}
                          animate={{ y: ['-100%', '0%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                      </motion.div>
                    )}

                    {/* Hover glow */}
                    {!isActive && (
                      <motion.div
                        className="absolute inset-0 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{
                          background: 'radial-gradient(circle at 30% 50%, rgba(0, 240, 255, 0.08), transparent 70%)',
                        }}
                      />
                    )}

                    {/* LASER GUTTER - Pulsing 2px cyan line */}
                    {isActive && (
                      <motion.div
                        layoutId="laserGutter"
                        className="absolute left-0 top-0 bottom-0 w-[2px] rounded-r"
                        style={{
                          background: '#00f0ff',
                          boxShadow: '0 0 8px #00f0ff, 0 0 16px #00f0ff, 0 0 24px #00f0ff',
                        }}
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    <div className="relative z-10 flex items-center gap-3 w-full">
                      <WireframeIcon type={item.type} isActive={isActive} />
                      <span className={clsx(
                        'hidden lg:block font-mono text-sm tracking-wide flex-1',
                        isActive ? 'text-white' : 'group-hover:text-white'
                      )}>
                        {item.label}
                      </span>

                      {/* Shortcut hint */}
                      <span className="hidden lg:block text-[8px] font-mono text-gray-700 group-hover:text-gray-500 transition-colors">
                        {item.shortcut}
                      </span>
                    </div>
                  </Link>
                </motion.li>
              </MagneticItem>
            )
          })}
        </ul>

        {/* Divider with label */}
        <div className="mt-6 mb-4 flex items-center gap-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-[6px] font-mono text-gray-700 tracking-widest">METRICS</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Mini metrics display */}
        <div className="hidden lg:block px-3 space-y-2">
          <MiniMetric label="LATENCY" value={`${systemLatency}ms`} color="#00f0ff" />
          <MiniMetric label="QUEUE" value="0" color="#00ff88" />
          <MiniMetric label="AGENTS" value="3/3" color="#ff00aa" />
        </div>
      </nav>

      {/* System Status Section - "Nerve Center" */}
      <div className="p-4 border-t border-white/5 space-y-3">
        {/* Agent Uptime Bars */}
        <div className="hidden lg:block space-y-2">
          <span className="text-[6px] font-mono text-gray-600 tracking-widest uppercase block mb-2">
            Agent Uptime
          </span>
          <AgentUptimeBar label="LOGIC" value={agentMetrics.logic} color="#00f0ff" />
          <AgentUptimeBar label="SECURITY" value={agentMetrics.security} color="#ff00aa" />
          <AgentUptimeBar label="QUALITY" value={agentMetrics.quality} color="#00ff88" />
        </div>

        {/* GitHub Status */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <StatusDot status={githubStatus} />
          <div className="hidden lg:block flex-1">
            <span className="text-[10px] font-mono text-gray-500 block">GitHub API</span>
            <span className={clsx(
              'text-[8px] font-mono uppercase tracking-wider',
              githubStatus === 'online' ? 'text-[#00ff88]' :
                githubStatus === 'degraded' ? 'text-[#ffaa00]' : 'text-[#ff3366]'
            )}>
              {githubStatus}
            </span>
          </div>
        </div>

        {/* System Status */}
        <div className="flex items-center gap-2">
          <StatusDot status="online" color="#00f0ff" />
          <div className="hidden lg:block flex-1">
            <span className="text-[10px] font-mono text-gray-500 block">System</span>
            <span className="text-[8px] font-mono text-[#00f0ff] uppercase tracking-wider">
              Operational
            </span>
          </div>
        </div>

        {/* Version tag */}
        <div className="hidden lg:flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-[6px] font-mono text-gray-700">BUILD: 2.1.0</span>
          <span className="text-[6px] font-mono text-gray-700">NODE: 0x4F2</span>
        </div>
      </div>
    </motion.aside>
  )
}

// Agent Uptime Bar - 1px progress bar with scan animation
function AgentUptimeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-mono text-gray-600">{label}</span>
        <span className="text-[7px] font-mono" style={{ color }}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="relative h-[1px] bg-[#1a1a24] rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
            width: `${value}%`
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        {/* Scan animation overlay */}
        <motion.div
          className="absolute inset-y-0 w-8 opacity-50"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          }}
          animate={{ x: ['-32px', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </div>
  )
}

// Mini metric component for sidebar
function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[8px] font-mono text-gray-600 tracking-wider">{label}</span>
      <span
        className="text-[10px] font-mono font-bold"
        style={{ color, textShadow: `0 0 8px ${color}40` }}
      >
        {value}
      </span>
    </div>
  )
}

// Pulsing status dot component
function StatusDot({
  status,
  color
}: {
  status: 'online' | 'degraded' | 'offline'
  color?: string
}) {
  const dotColor = color || (
    status === 'online' ? '#00ff88' :
      status === 'degraded' ? '#ffaa00' : '#ff3366'
  )

  return (
    <div className="relative">
      <motion.div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
        animate={status === 'online' ? {
          opacity: [0.6, 1, 0.6],
          scale: [0.9, 1, 0.9],
        } : status === 'degraded' ? {
          opacity: [0.5, 1, 0.5],
        } : {}}
        transition={{ duration: status === 'degraded' ? 0.5 : 2, repeat: Infinity }}
      />
      {/* Pulse ring for online status */}
      {status === 'online' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid ${dotColor}` }}
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
  )
}
