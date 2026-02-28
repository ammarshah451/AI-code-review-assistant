import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, CheckCircle } from 'lucide-react'
import { useProgressContext } from '../context/ProgressContext'
import { useReviewProgress } from '../hooks/useReviewProgress'
import { useEffect } from 'react'

export function GlobalProgressBar() {
  const navigate = useNavigate()
  const { activeReview, setActiveReview } = useProgressContext()
  const progress = useReviewProgress(activeReview?.reviewId ?? null, !!activeReview)

  const handleClick = () => {
    if (activeReview) {
      navigate(`/reviews/${activeReview.reviewId}`)
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveReview(null)
  }

  // Auto-dismiss when complete
  useEffect(() => {
    if (progress.isComplete && activeReview) {
      const timeout = setTimeout(() => setActiveReview(null), 3000)
      return () => clearTimeout(timeout)
    }
  }, [progress.isComplete, activeReview, setActiveReview])

  return (
    <AnimatePresence>
      {activeReview && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed top-4 right-4 z-50 cursor-pointer"
          onClick={handleClick}
        >
          <div className="bg-void-100/95 border border-white/10 rounded-lg backdrop-blur-md shadow-lg min-w-[280px] max-w-[320px]">
            <div className="px-3 py-2">
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {progress.isComplete ? (
                    <CheckCircle className="text-cyber-green" size={14} />
                  ) : (
                    <Loader2 className="text-cyber-cyan animate-spin" size={14} />
                  )}
                  <span className="text-xs font-mono text-white">
                    {progress.isComplete ? 'Complete' : 'Reviewing'} PR #{activeReview.prNumber}
                  </span>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-0.5 rounded hover:bg-void-200 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-void-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: progress.isComplete
                        ? 'rgb(0, 255, 136)'
                        : 'linear-gradient(to right, #00f0ff, #ff00aa)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-400 w-8 text-right">
                  {progress.progress}%
                </span>
              </div>

              {/* Status message */}
              {progress.message && (
                <p className="text-[10px] text-gray-500 font-mono mt-1 truncate">
                  {progress.message}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
