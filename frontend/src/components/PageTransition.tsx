// PageTransition - "Digital Slice" Transition Effect
// Features: Content split into 3 horizontal slices with staggered slide animations

import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

interface DigitalSliceWrapperProps {
  children: ReactNode
}

// Digital Slice Animation Variants
const sliceVariants = {
  initial: { opacity: 0, x: 100 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1, // Staggered slice entry
      type: 'spring',
      stiffness: 80,
      damping: 15,
    },
  }),
  exit: (i: number) => ({
    opacity: 0,
    x: -100,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
    },
  }),
}

export function DigitalSliceWrapper({ children }: DigitalSliceWrapperProps) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <div key={location.pathname} className="relative overflow-hidden w-full min-h-full">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            custom={i}
            variants={sliceVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              clipPath: `inset(${i * 33.33}% 0 ${(2 - i) * 33.33}% 0)`,
              position: i === 0 ? 'relative' : 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            {children}
          </motion.div>
        ))}
      </div>
    </AnimatePresence>
  )
}

// Simpler fade transition for subtler pages
interface FadeTransitionProps {
  children: ReactNode
}

export function FadeTransition({ children }: FadeTransitionProps) {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Page wrapper with consistent padding and metadata
interface PageWrapperProps {
  children: ReactNode
  metadata?: {
    coreTemp?: string
    latency?: string
    nodeId?: string
  }
}

export function PageWrapper({ children, metadata }: PageWrapperProps) {
  const defaultMetadata = {
    coreTemp: '32C',
    latency: '42ms',
    nodeId: '0x4F2',
    ...metadata,
  }

  return (
    <div className="relative min-h-full">
      {/* Corner metadata injection */}
      <div className="absolute top-0 right-0 p-4 flex gap-4 text-[6px] font-mono text-gray-700 pointer-events-none">
        <span>CORE_TEMP: {defaultMetadata.coreTemp}</span>
        <span>LATENCY: {defaultMetadata.latency}</span>
        <span>NODE_ID: {defaultMetadata.nodeId}</span>
      </div>

      {children}
    </div>
  )
}

// Neural Search Input - Floating borderless with glow underline
interface NeuralSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
}

export function NeuralSearch({ value, onChange, placeholder = 'Search...', onFocus, onBlur }: NeuralSearchProps) {
  return (
    <div className="relative group">
      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full bg-transparent border-none outline-none px-4 py-2 text-white font-mono text-sm placeholder:text-gray-600 focus:placeholder:text-gray-500 transition-colors"
      />

      {/* Underline - glows on focus */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-800 group-focus-within:bg-[#00f0ff]"
        initial={{ scaleX: 0.3, opacity: 0.5 }}
        whileFocus={{ scaleX: 1, opacity: 1 }}
        style={{ transformOrigin: 'center' }}
      />

      {/* Glowing underline on focus */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-focus-within:opacity-100"
        style={{
          background: 'linear-gradient(90deg, transparent, #00f0ff, transparent)',
          boxShadow: '0 0 10px #00f0ff',
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Neural Search label - appears on focus */}
      <motion.span
        className="absolute -top-4 left-4 text-[8px] font-mono text-[#00f0ff] uppercase tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity"
      >
        Neural Search
      </motion.span>
    </div>
  )
}
