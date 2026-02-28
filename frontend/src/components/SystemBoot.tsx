// SystemBoot - Initial mount animation sequence
// Step 1: Grid background draws in
// Step 2: Card brackets 'clink' into place
// Step 3: Polyhedron powers up with light-flash effect

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SystemBootProps {
  onComplete: () => void
  skipAnimation?: boolean
}

type BootPhase = 'initializing' | 'grid' | 'brackets' | 'powerup' | 'complete'

export function SystemBoot({ onComplete, skipAnimation = false }: SystemBootProps) {
  const [phase, setPhase] = useState<BootPhase>('initializing')
  // Use a separate state for visibility to avoid TypeScript narrowing issues
  const [isVisible, setIsVisible] = useState(true)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, message])
  }, [])

  useEffect(() => {
    if (skipAnimation) {
      onComplete()
      return
    }

    const sequence = async () => {
      // Phase 1: Initializing
      addLog('CODEGUARD_AI v2.0.0')
      addLog('Initializing system components...')
      await delay(400)

      // Phase 2: Grid
      setPhase('grid')
      addLog('> Drawing grid matrix...')
      await delay(600)
      addLog('> Grid matrix: OK')

      // Phase 3: Brackets
      setPhase('brackets')
      addLog('> Mounting interface frames...')
      await delay(500)
      addLog('> Interface frames: LOCKED')

      // Phase 4: Power up
      setPhase('powerup')
      addLog('> Activating neural core...')
      await delay(400)
      addLog('> Neural core: ONLINE')
      addLog('> Security protocols: ACTIVE')
      addLog('> Quality analysis: READY')
      await delay(300)

      // Complete
      setPhase('complete')
      addLog('')
      addLog('SYSTEM BOOT COMPLETE')
      addLog('Welcome, Operator.')
      await delay(600)

      setIsVisible(false)
      onComplete()
    }

    sequence()
  }, [skipAnimation, onComplete, addLog])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[10000] bg-[#050508] flex items-center justify-center"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Grid background animation */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: phase !== 'initializing' ? 1 : 0,
            }}
            transition={{ duration: 0.8 }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
              }}
            />
          </motion.div>

          {/* Scanlines */}
          <div className="absolute inset-0 pointer-events-none scanline-overlay" />

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo / Polyhedron placeholder */}
            <motion.div
              className="relative w-32 h-32 mb-8"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: phase === 'powerup' || phase === 'complete' ? 1 : 0.8,
                opacity: phase !== 'initializing' ? 1 : 0,
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {/* Octahedron wireframe (simplified static version) */}
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <filter id="boot-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <g filter="url(#boot-glow)">
                  {/* Top pyramid */}
                  <motion.path
                    d="M50,15 L75,50 L50,50 Z"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: phase !== 'initializing' ? 1 : 0,
                      opacity: phase !== 'initializing' ? 0.8 : 0,
                    }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  />
                  <motion.path
                    d="M50,15 L25,50 L50,50 Z"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: phase !== 'initializing' ? 1 : 0,
                      opacity: phase !== 'initializing' ? 0.8 : 0,
                    }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                  {/* Bottom pyramid */}
                  <motion.path
                    d="M50,85 L75,50 L50,50 Z"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: phase !== 'initializing' ? 1 : 0,
                      opacity: phase !== 'initializing' ? 0.8 : 0,
                    }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  />
                  <motion.path
                    d="M50,85 L25,50 L50,50 Z"
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: phase !== 'initializing' ? 1 : 0,
                      opacity: phase !== 'initializing' ? 0.8 : 0,
                    }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  />
                  {/* Middle line */}
                  <motion.line
                    x1="25"
                    y1="50"
                    x2="75"
                    y2="50"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: phase !== 'initializing' ? 1 : 0,
                      opacity: phase !== 'initializing' ? 0.6 : 0,
                    }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                  />
                </g>

                {/* Center core */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="4"
                  fill="#00f0ff"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: phase === 'powerup' || phase === 'complete' ? 1 : 0,
                    opacity: phase === 'powerup' || phase === 'complete' ? 1 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  filter="url(#boot-glow)"
                />
              </svg>

              {/* Power-up flash effect */}
              <AnimatePresence>
                {phase === 'powerup' && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 2, opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{
                      background: 'radial-gradient(circle, rgba(0, 240, 255, 0.8) 0%, transparent 70%)',
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-2xl font-display font-bold text-white mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-[#00f0ff]">CODE</span>GUARD
              <span className="text-[#ff00aa]">_</span>AI
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-xs font-mono text-gray-600 tracking-widest mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              MULTI-AGENT CODE REVIEW SYSTEM
            </motion.p>

            {/* Terminal logs */}
            <motion.div
              className="w-80 h-40 bg-[#0a0a0f]/80 border border-white/10 rounded overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="px-3 py-1.5 border-b border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff3366]" />
                <div className="w-2 h-2 rounded-full bg-[#ffaa00]" />
                <div className="w-2 h-2 rounded-full bg-[#00ff88]" />
                <span className="ml-2 text-xs font-mono text-gray-600">system.log</span>
              </div>
              <div className="p-3 font-mono text-xs text-[#00f0ff] overflow-y-auto h-[calc(100%-32px)]">
                {logs.map((log, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.1 }}
                    className={log.startsWith('>') ? 'text-gray-500' : ''}
                  >
                    {log || '\u00A0'}
                  </motion.div>
                ))}
                <motion.span
                  className="inline-block w-2 h-4 bg-[#00f0ff] ml-0.5"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </div>
            </motion.div>

            {/* Progress bar */}
            <motion.div
              className="w-80 h-1 bg-[#1a1a24] rounded-full mt-4 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-[#00f0ff] to-[#ff00aa]"
                initial={{ width: '0%' }}
                animate={{
                  width:
                    phase === 'initializing'
                      ? '10%'
                      : phase === 'grid'
                      ? '35%'
                      : phase === 'brackets'
                      ? '60%'
                      : phase === 'powerup'
                      ? '85%'
                      : '100%',
                }}
                transition={{ duration: 0.3 }}
                style={{ boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)' }}
              />
            </motion.div>

            {/* Phase indicator */}
            <motion.p
              className="mt-2 text-xs font-mono text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {phase === 'initializing' && 'INITIALIZING...'}
              {phase === 'grid' && 'DRAWING GRID MATRIX...'}
              {phase === 'brackets' && 'MOUNTING INTERFACE...'}
              {phase === 'powerup' && 'ACTIVATING NEURAL CORE...'}
              {phase === 'complete' && 'BOOT COMPLETE'}
            </motion.p>
          </div>

          {/* Corner brackets (boot-bracket animation) */}
          <AnimatePresence>
            {(phase === 'brackets' || phase === 'powerup' || phase === 'complete') && (
              <>
                <motion.div
                  className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-[#00f0ff]"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  style={{ boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)' }}
                />
                <motion.div
                  className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-[#00f0ff]"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.05 }}
                  style={{ boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)' }}
                />
                <motion.div
                  className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-[#ff00aa]"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.1 }}
                  style={{ boxShadow: '0 0 10px rgba(255, 0, 170, 0.5)' }}
                />
                <motion.div
                  className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-[#ff00aa]"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.15 }}
                  style={{ boxShadow: '0 0 10px rgba(255, 0, 170, 0.5)' }}
                />
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Hook to manage boot state
export function useSystemBoot() {
  const [hasBooted, setHasBooted] = useState(false)
  const [showBoot, setShowBoot] = useState(true)

  // Check if we've already booted this session
  useEffect(() => {
    const booted = sessionStorage.getItem('codeguard_booted')
    if (booted) {
      setHasBooted(true)
      setShowBoot(false)
    }
  }, [])

  const handleBootComplete = useCallback(() => {
    sessionStorage.setItem('codeguard_booted', 'true')
    setHasBooted(true)
    setShowBoot(false)
  }, [])

  return {
    hasBooted,
    showBoot,
    handleBootComplete,
    resetBoot: () => {
      sessionStorage.removeItem('codeguard_booted')
      setHasBooted(false)
      setShowBoot(true)
    },
  }
}
