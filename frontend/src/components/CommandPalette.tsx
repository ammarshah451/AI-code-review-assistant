// CommandPalette - Keyboard-accessible (Cmd+K) floating search with cyber-noir aesthetic

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, GitPullRequest, Settings, BarChart3, Home, X, Command } from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate?: (path: string) => void
}

export function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Define available commands
  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Go to main dashboard',
      icon: <Home size={16} />,
      shortcut: 'G D',
      action: () => onNavigate?.('/'),
    },
    {
      id: 'reviews',
      label: 'Reviews',
      description: 'View all code reviews',
      icon: <GitPullRequest size={16} />,
      shortcut: 'G R',
      action: () => onNavigate?.('/reviews'),
    },
    {
      id: 'stats',
      label: 'Statistics',
      description: 'View analytics and metrics',
      icon: <BarChart3 size={16} />,
      shortcut: 'G S',
      action: () => onNavigate?.('/stats'),
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure application settings',
      icon: <Settings size={16} />,
      shortcut: 'G ,',
      action: () => onNavigate?.('/settings'),
    },
  ]

  // Filter commands based on query
  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase())
  )

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [filteredCommands, selectedIndex, onClose]
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="command-palette-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            className="command-palette"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="schematic-card overflow-hidden">
              {/* Search input */}
              <div className="relative border-b border-white/10">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00f0ff]">
                  <Search size={18} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or search..."
                  className="w-full bg-transparent py-4 pl-12 pr-12 text-white font-mono text-sm focus:outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={onClose}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Command list */}
              <div className="max-h-80 overflow-y-auto py-2">
                {filteredCommands.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-gray-500 font-mono text-sm">No commands found</p>
                  </div>
                ) : (
                  filteredCommands.map((command, index) => (
                    <motion.button
                      key={command.id}
                      onClick={() => {
                        command.action()
                        onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full px-4 py-3 flex items-center gap-3 transition-all ${
                        index === selectedIndex
                          ? 'bg-[#00f0ff]/10 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      {/* Icon */}
                      <span
                        className={`shrink-0 ${
                          index === selectedIndex ? 'text-[#00f0ff]' : 'text-gray-500'
                        }`}
                      >
                        {command.icon}
                      </span>

                      {/* Label and description */}
                      <div className="flex-1 text-left">
                        <span className="block font-mono text-sm">{command.label}</span>
                        {command.description && (
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {command.description}
                          </span>
                        )}
                      </div>

                      {/* Shortcut */}
                      {command.shortcut && (
                        <span className="shrink-0 text-xs font-mono text-gray-600 bg-[#1a1a24] px-2 py-1 rounded">
                          {command.shortcut}
                        </span>
                      )}

                      {/* Selection indicator */}
                      {index === selectedIndex && (
                        <motion.div
                          className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00f0ff]"
                          layoutId="command-indicator"
                          style={{ boxShadow: '0 0 8px #00f0ff' }}
                        />
                      )}
                    </motion.button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs font-mono text-gray-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1a1a24] rounded text-gray-500">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1a1a24] rounded text-gray-500">↵</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-[#1a1a24] rounded text-gray-500">esc</kbd>
                    Close
                  </span>
                </div>
                <span className="text-[#00f0ff]/50">CODEGUARD_CMD</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Hook to handle Cmd+K shortcut
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  }
}

// Command palette trigger button
export function CommandPaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0f] border border-white/10 rounded text-gray-500 hover:text-white hover:border-[#00f0ff]/50 transition-all group"
    >
      <Search size={14} />
      <span className="font-mono text-xs">Search...</span>
      <span className="flex items-center gap-0.5 text-xs font-mono bg-[#1a1a24] px-1.5 py-0.5 rounded group-hover:text-[#00f0ff] transition-colors">
        <Command size={10} />K
      </span>
    </button>
  )
}
