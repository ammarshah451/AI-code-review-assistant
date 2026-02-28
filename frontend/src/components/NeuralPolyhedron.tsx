// NeuralPolyhedron - "Breathing Core" 3D Wireframe Octahedron
// Features: Breathing animation, Engine Heat Glow, State-sync visualization

import { motion, useAnimation } from 'framer-motion'
import { useEffect, useState } from 'react'

interface NeuralPolyhedronProps {
  state: 'idle' | 'processing' | 'alert'
  className?: string
  size?: number
}

// Octahedron vertices (normalized coordinates)
const vertices = [
  { x: 0, y: -1, z: 0 },   // Top
  { x: 1, y: 0, z: 0 },    // Right
  { x: 0, y: 0, z: 1 },    // Front
  { x: -1, y: 0, z: 0 },   // Left
  { x: 0, y: 0, z: -1 },   // Back
  { x: 0, y: 1, z: 0 },    // Bottom
]

// Edges connecting vertices
const edges = [
  [0, 1], [0, 2], [0, 3], [0, 4], // Top to middle
  [5, 1], [5, 2], [5, 3], [5, 4], // Bottom to middle
  [1, 2], [2, 3], [3, 4], [4, 1], // Middle ring
]

// Project 3D to 2D with rotation
function project(
  vertex: { x: number; y: number; z: number },
  rotationY: number,
  rotationX: number,
  scale: number,
  centerX: number,
  centerY: number
) {
  // Rotate around Y axis
  const cosY = Math.cos(rotationY)
  const sinY = Math.sin(rotationY)
  let x = vertex.x * cosY - vertex.z * sinY
  let z = vertex.x * sinY + vertex.z * cosY

  // Rotate around X axis
  const cosX = Math.cos(rotationX)
  const sinX = Math.sin(rotationX)
  let y = vertex.y * cosX - z * sinX
  z = vertex.y * sinX + z * cosX

  // Simple perspective projection
  const perspective = 3
  const scaleFactor = perspective / (perspective + z)

  return {
    x: centerX + x * scale * scaleFactor,
    y: centerY + y * scale * scaleFactor,
    z: z,
  }
}

export function NeuralPolyhedron({ state, className = '', size = 200 }: NeuralPolyhedronProps) {
  const [rotation, setRotation] = useState({ y: 0, x: 0.3 })
  const [breathScale, setBreathScale] = useState(1)
  const controls = useAnimation()
  const scale = size * 0.3

  // Rotation speed based on state
  const rotationSpeed = state === 'processing' ? 0.03 : 0.008

  useEffect(() => {
    let animationId: number

    const animate = () => {
      setRotation((prev) => ({
        y: prev.y + rotationSpeed,
        x: prev.x + rotationSpeed * 0.3,
      }))
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [rotationSpeed])

  // Breathing animation - subtle scale pulse
  useEffect(() => {
    let breathId: number
    let time = 0

    const breathe = () => {
      time += 0.02
      // Subtle breathing: 1.0 to 1.03 scale
      const breathValue = 1 + Math.sin(time) * 0.015
      setBreathScale(breathValue)
      breathId = requestAnimationFrame(breathe)
    }

    breathId = requestAnimationFrame(breathe)
    return () => cancelAnimationFrame(breathId)
  }, [])

  // Scale pulse for processing state
  useEffect(() => {
    if (state === 'processing') {
      controls.start({
        scale: [1, 1.1, 1],
        transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
      })
    } else {
      controls.start({ scale: 1 })
    }
  }, [state, controls])

  // Calculate projected vertices
  const projectedVertices = vertices.map((v) =>
    project(v, rotation.y, rotation.x, scale, size / 2, size / 2)
  )

  // Determine colors based on state
  const primaryColor = state === 'alert' ? '#ff00aa' : '#00f0ff'
  const glowColor = state === 'alert' ? 'rgba(255, 0, 170, 0.5)' : 'rgba(0, 240, 255, 0.5)'
  const engineGlowColor = state === 'alert' ? 'rgba(255, 0, 170, 0.1)' : 'rgba(0, 240, 255, 0.1)'

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* ENGINE HEAT GLOW - Large blurred radial gradient anchor */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 1.5,
          height: size * 1.5,
          left: -size * 0.25,
          top: -size * 0.25,
          background: `radial-gradient(circle, ${engineGlowColor} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
        animate={{
          opacity: state === 'processing' ? [0.6, 1, 0.6] : [0.3, 0.5, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* BREATHING GLOW - synchronized with scale */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          transform: `scale(${breathScale})`,
        }}
        animate={{
          opacity: state === 'processing' ? [0.3, 0.6, 0.3] : [0.15, 0.25, 0.15],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Alert ripples */}
      {state === 'alert' && (
        <>
          <motion.div
            className="absolute inset-0 m-auto w-20 h-20 rounded-full border-2"
            style={{ borderColor: '#ff00aa' }}
            animate={{ scale: [0.5, 2.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 m-auto w-20 h-20 rounded-full border-2"
            style={{ borderColor: '#ff00aa' }}
            animate={{ scale: [0.5, 2.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
          <motion.div
            className="absolute inset-0 m-auto w-20 h-20 rounded-full border-2"
            style={{ borderColor: '#ff00aa' }}
            animate={{ scale: [0.5, 2.5], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 1 }}
          />
        </>
      )}

      {/* SVG Octahedron with BREATHING SCALE */}
      <motion.svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        animate={controls}
        style={{ transform: `scale(${breathScale})` }}
      >
        <defs>
          {/* Enhanced glow filter */}
          <filter id="polyhedron-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger glow for center core */}
          <filter id="core-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        <g filter="url(#polyhedron-glow)">
          {edges.map(([startIdx, endIdx], index) => {
            const start = projectedVertices[startIdx]
            const end = projectedVertices[endIdx]
            // Calculate opacity based on z-depth (back edges are dimmer)
            const avgZ = (start.z + end.z) / 2
            const opacity = 0.3 + (avgZ + 1) * 0.35

            return (
              <motion.line
                key={index}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={primaryColor}
                strokeWidth={state === 'processing' ? 2 : 1.5}
                opacity={opacity}
              />
            )
          })}
        </g>

        {/* Vertices */}
        <g filter="url(#polyhedron-glow)">
          {projectedVertices.map((v, index) => {
            const opacity = 0.5 + (v.z + 1) * 0.25
            const nodeSize = state === 'processing' ? 5 : 4

            return (
              <motion.circle
                key={index}
                cx={v.x}
                cy={v.y}
                r={nodeSize}
                fill={primaryColor}
                opacity={opacity}
                animate={
                  state === 'processing'
                    ? { r: [nodeSize, nodeSize + 2, nodeSize] }
                    : {}
                }
                transition={{ duration: 0.5, repeat: Infinity, delay: index * 0.1 }}
              />
            )
          })}
        </g>

        {/* Center core with enhanced glow */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={state === 'processing' ? 10 : 8}
          fill={primaryColor}
          opacity={0.9}
          animate={
            state === 'processing'
              ? { r: [8, 12, 8], opacity: [0.7, 1, 0.7] }
              : state === 'alert'
              ? { opacity: [0.6, 1, 0.6] }
              : { r: [7, 8, 7], opacity: [0.7, 0.9, 0.7] } // Breathing core
          }
          transition={{ duration: state === 'processing' ? 1 : 2, repeat: Infinity }}
          filter="url(#core-glow)"
        />
      </motion.svg>

      {/* Agent labels with enhanced positioning */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.span
          className="absolute text-[10px] font-mono tracking-wider font-medium"
          style={{
            top: '8%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: primaryColor,
            textShadow: `0 0 10px ${glowColor}`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          LOGIC
        </motion.span>
        <motion.span
          className="absolute text-[10px] font-mono tracking-wider font-medium"
          style={{
            bottom: '18%',
            left: '12%',
            color: '#ff00aa',
            textShadow: '0 0 10px rgba(255, 0, 170, 0.5)',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        >
          SECURITY
        </motion.span>
        <motion.span
          className="absolute text-[10px] font-mono tracking-wider font-medium"
          style={{
            bottom: '18%',
            right: '12%',
            color: '#00ff88',
            textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
        >
          QUALITY
        </motion.span>
      </div>
    </div>
  )
}

// HUD Overlay Component - Semi-transparent brackets projected over the core
interface HUDOverlayProps {
  activeAgents: number
  completionRate: number
  status: string
  statusColor: string
}

export function HUDOverlay({ activeAgents, completionRate, status, statusColor }: HUDOverlayProps) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full">
      {/* Top bracket */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-start gap-2">
        <div className="w-8 h-4 border-t-2 border-l-2 border-[#00f0ff]/40" />
        <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest px-2 -mt-1">
          Neural Core
        </span>
        <div className="w-8 h-4 border-t-2 border-r-2 border-[#00f0ff]/40" />
      </div>

      {/* HUD Stats */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-end gap-4 pr-4">
        {/* Active Agents */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-wider">
              Active Agents
            </span>
            <span className="block text-xl font-mono font-bold text-white">
              {activeAgents}
            </span>
          </div>
          <div className="w-6 h-6 border border-[#00f0ff]/30 rounded flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#00f0ff]" style={{ boxShadow: '0 0 8px #00f0ff' }} />
          </div>
        </div>

        {/* Completion */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-wider">
              Completion
            </span>
            <span className="block text-xl font-mono font-bold text-white">
              {completionRate}%
            </span>
          </div>
          <div className="w-6 h-6 border border-[#00ff88]/30 rounded flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#00ff88]" style={{ boxShadow: '0 0 8px #00ff88' }} />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-wider">
              Status
            </span>
            <span
              className="block text-sm font-mono font-bold uppercase"
              style={{ color: statusColor, textShadow: `0 0 10px ${statusColor}40` }}
            >
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom bracket */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-end gap-2">
        <div className="w-8 h-4 border-b-2 border-l-2 border-[#ff00aa]/40" />
        <span className="text-[6px] font-mono text-gray-600 uppercase tracking-widest px-2 mb-1">
          v2.1.0
        </span>
        <div className="w-8 h-4 border-b-2 border-r-2 border-[#ff00aa]/40" />
      </div>
    </div>
  )
}
