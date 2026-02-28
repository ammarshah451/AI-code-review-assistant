// Reviews Page - List all reviews with pagination
// Features: 3D DNA Helix view toggle

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitPullRequest, Search, Filter, ChevronLeft, ChevronRight, Layers, List } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ReviewCard, ReviewCardSkeleton } from '../components/ReviewCard'
import { PageHeader, EmptyState } from '../components/Layout'
import { useReviews } from '../hooks/useApi'
import { useProgressContext } from '../context/ProgressContext'
import { useDeviceCapability } from '../hooks/useDeviceCapability'
import {
  SovereignStage,
  FogEnvironment,
  CameraRig,
  ObsidianFloor,
  DNAForensicHelix,
  Effects,
} from '../components/3d'
import type { ReviewStatus } from '../types'

type ViewMode = 'list' | '3d'

export function Reviews() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedReviewId, setSelectedReviewId] = useState<string | undefined>()
  const perPage = 10
  const { activeReview, setActiveReview } = useProgressContext()
  const { canRender3D } = useDeviceCapability()

  const { data, isLoading } = useReviews(page, perPage)

  // Auto-detect processing reviews and set activeReview for global progress bar
  useEffect(() => {
    if (data?.items && !activeReview) {
      const processingReview = data.items.find(
        r => r.status === 'processing' || r.status === 'pending'
      )
      if (processingReview) {
        setActiveReview({
          reviewId: processingReview.id,
          prNumber: processingReview.pr_number,
          prTitle: processingReview.pr_title || `PR #${processingReview.pr_number}`,
        })
      }
    }
  }, [data?.items, activeReview, setActiveReview])

  // Filter reviews by status (client-side for now)
  const filteredReviews = data?.items.filter(
    review => statusFilter === 'all' || review.status === statusFilter
  ) ?? []

  const statuses: Array<ReviewStatus | 'all'> = ['all', 'pending', 'processing', 'completed', 'failed']

  const handleReviewClick = (review: { id: string }) => {
    if (viewMode === '3d') {
      setSelectedReviewId(review.id)
      // Navigate after a short delay to show selection
      setTimeout(() => navigate(`/reviews/${review.id}`), 300)
    } else {
      navigate(`/reviews/${review.id}`)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Reviews"
        subtitle={`${data?.total ?? 0} total reviews`}
        action={
          canRender3D && (
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          )
        }
      />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 mb-6"
      >
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search (visual only for now) */}
          <div className="relative flex-1 w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search reviews..."
              className="cyber-input w-full pl-10 bg-[#0a0a0f]/50 focus:bg-[#0a0a0f]"
              disabled
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <Filter size={18} className="text-gray-500 shrink-0" />
            <div className="flex gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider transition-all border ${statusFilter === status
                      ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                      : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                >
                  {status === 'all' ? 'All' : status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3D Helix View */}
      {viewMode === '3d' && canRender3D ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card overflow-hidden mb-6"
          style={{ height: '600px' }}
        >
          <SovereignStage>
            <FogEnvironment />
            <CameraRig />
            <ObsidianFloor />
            <DNAForensicHelix
              reviews={filteredReviews}
              onReviewClick={handleReviewClick}
              selectedReviewId={selectedReviewId}
            />
            <Effects />
          </SovereignStage>
        </motion.div>
      ) : (
        /* Reviews list */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <ReviewCardSkeleton key={i} index={i} />
              ))}
            </div>
          ) : filteredReviews.length > 0 ? (
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {filteredReviews.map((review, index) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    index={index}
                    onClick={() => handleReviewClick(review)}
                  />
                ))}
              </div>
            </AnimatePresence>
          ) : (
            <EmptyState
              icon={<GitPullRequest size={32} />}
              title="No reviews found"
              description={
                statusFilter !== 'all'
                  ? `No ${statusFilter} reviews at the moment.`
                  : 'When you open a pull request on a connected repository, reviews will appear here.'
              }
            />
          )}

          {/* Pagination */}
          {data && data.pages > 1 && viewMode === 'list' && (
            <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-white/10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-void-200 text-gray-400 hover:text-white hover:bg-void-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-white">{page}</span>
                <span className="text-gray-600">/</span>
                <span className="text-gray-400">{data.pages}</span>
              </div>

              <button
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="p-2 rounded-lg bg-void-200 text-gray-400 hover:text-white hover:bg-void-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// View Mode Toggle Component
interface ViewModeToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

function ViewModeToggle({ viewMode, onViewModeChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-void-200 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('list')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-sm transition-all ${viewMode === 'list'
            ? 'bg-cyber-cyan/20 text-cyber-cyan'
            : 'text-gray-400 hover:text-white'
          }`}
      >
        <List size={16} />
        <span className="hidden sm:inline">List</span>
      </button>
      <button
        onClick={() => onViewModeChange('3d')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-sm transition-all ${viewMode === '3d'
            ? 'bg-cyber-cyan/20 text-cyber-cyan'
            : 'text-gray-400 hover:text-white'
          }`}
      >
        <Layers size={16} />
        <span className="hidden sm:inline">3D Helix</span>
      </button>
    </div>
  )
}
