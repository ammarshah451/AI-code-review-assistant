import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToast, ToastType } from '../context/ToastContext'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const colors: Record<ToastType, string> = {
  success: 'rgb(0, 255, 136)', // cyber-green
  error: 'rgb(255, 0, 85)', // cyber-crimson
  info: 'rgb(0, 255, 255)', // cyber-cyan
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => {
          const Icon = icons[toast.type]
          const color = colors[toast.type]

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className="glass-card p-4 min-w-[300px] max-w-[400px]"
              style={{ borderColor: `${color}30` }}
            >
              <div className="flex items-start gap-3">
                <Icon size={20} style={{ color }} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-white">{toast.message}</p>
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="text-xs font-mono mt-1 hover:underline"
                      style={{ color }}
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 rounded hover:bg-void-200 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
