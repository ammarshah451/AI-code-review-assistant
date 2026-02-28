// Animated Neural Network - The centerpiece visualization
// Shows the three AI agents as interconnected nodes

import { motion } from 'framer-motion'
import { Brain, Shield, Sparkles } from 'lucide-react'

interface NeuralNetworkProps {
  isProcessing?: boolean
  activeAgent?: 'logic' | 'security' | 'quality' | null
}

export function NeuralNetwork({ isProcessing = false, activeAgent = null }: NeuralNetworkProps) {
  const nodes = [
    {
      id: 'logic',
      label: 'Logic',
      icon: Brain,
      color: '#00f0ff',
      x: 50,
      y: 20,
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      color: '#ff00aa',
      x: 20,
      y: 70,
    },
    {
      id: 'quality',
      label: 'Quality',
      icon: Sparkles,
      color: '#00ff88',
      x: 80,
      y: 70,
    },
  ]

  const connections = [
    { from: 'logic', to: 'security' },
    { from: 'logic', to: 'quality' },
    { from: 'security', to: 'quality' },
  ]

  return (
    <div className="relative w-full h-48 md:h-64">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial from-cyber-cyan/10 via-transparent to-transparent opacity-50" />

      {/* SVG for connections */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <defs>
          {/* Animated gradient for connections */}
          <linearGradient id="connectionGradient" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f0ff">
              <animate
                attributeName="stop-color"
                values="#00f0ff;#ff00aa;#00ff88;#00f0ff"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#ff00aa">
              <animate
                attributeName="stop-color"
                values="#ff00aa;#00ff88;#00f0ff;#ff00aa"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pulse animation along path */}
          <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        {connections.map((conn, index) => {
          const fromNode = nodes.find(n => n.id === conn.from)!
          const toNode = nodes.find(n => n.id === conn.to)!

          return (
            <g key={`${conn.from}-${conn.to}`}>
              {/* Base line */}
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="0.5"
              />

              {/* Animated line */}
              <motion.line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke="url(#connectionGradient)"
                strokeWidth={isProcessing ? "1" : "0.5"}
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0.3 }}
                animate={{
                  pathLength: 1,
                  opacity: isProcessing ? [0.3, 1, 0.3] : 0.5,
                }}
                transition={{
                  pathLength: { duration: 2, delay: index * 0.3 },
                  opacity: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                }}
              />

              {/* Data packet animation when processing */}
              {isProcessing && (
                <motion.circle
                  r="1.5"
                  fill={index === 0 ? '#00f0ff' : index === 1 ? '#ff00aa' : '#00ff88'}
                  filter="url(#pulseGlow)"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    cx: [fromNode.x, toNode.x],
                    cy: [fromNode.y, toNode.y],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: index * 0.5,
                    ease: "easeInOut",
                  }}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node, index) => {
        const Icon = node.icon
        const isActive = activeAgent === node.id || isProcessing

        return (
          <motion.div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              delay: index * 0.2,
              type: "spring",
              stiffness: 200,
              damping: 15
            }}
          >
            {/* Outer ring pulse */}
            {isActive && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${node.color}`,
                    boxShadow: `0 0 20px ${node.color}40`
                  }}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${node.color}`,
                    boxShadow: `0 0 20px ${node.color}40`
                  }}
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.75 }}
                />
              </>
            )}

            {/* Node body */}
            <motion.div
              className="relative flex flex-col items-center gap-2"
              animate={isActive ? {
                scale: [1, 1.1, 1],
              } : {}}
              transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
            >
              <div
                className="w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center backdrop-blur-sm"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${node.color}40, ${node.color}10)`,
                  border: `2px solid ${node.color}`,
                  boxShadow: `0 0 ${isActive ? '30px' : '15px'} ${node.color}60, inset 0 0 20px ${node.color}20`,
                }}
              >
                <Icon
                  size={24}
                  style={{ color: node.color }}
                  className="md:w-8 md:h-8"
                />
              </div>
              <span
                className="text-xs md:text-sm font-mono font-medium tracking-wider"
                style={{
                  color: node.color,
                  textShadow: `0 0 10px ${node.color}80`
                }}
              >
                {node.label}
              </span>
            </motion.div>
          </motion.div>
        )
      })}

      {/* Center core */}
      <motion.div
        className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, type: "spring" }}
      >
        <motion.div
          className="w-8 h-8 md:w-10 md:h-10 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            boxShadow: isProcessing
              ? '0 0 40px rgba(0, 240, 255, 0.5), 0 0 60px rgba(255, 0, 170, 0.3)'
              : '0 0 20px rgba(255,255,255,0.2)',
          }}
          animate={isProcessing ? {
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </div>
  )
}
