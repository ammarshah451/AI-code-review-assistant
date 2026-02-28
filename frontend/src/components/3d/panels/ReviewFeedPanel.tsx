// ReviewFeedPanel - Recent reviews list for 3D HUD
// Compact list of recent PR reviews

import type { Review } from '../../../types'

interface ReviewFeedPanelProps {
  reviews?: Review[]
  onReviewClick?: (review: Review) => void
}

export function ReviewFeedPanel({ reviews = [], onReviewClick }: ReviewFeedPanelProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center text-gray-600 text-[10px] py-4">
        No recent reviews
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {reviews.slice(0, 5).map((review) => (
        <button
          key={review.id}
          onClick={() => onReviewClick?.(review)}
          className="w-full flex items-center gap-2 px-1 py-1 hover:bg-white/5 rounded transition-colors text-left"
        >
          <StatusDot status={review.status} />
          <span className="text-[10px] text-white truncate flex-1">
            PR #{review.pr_number}
          </span>
          <span className="text-[8px] text-gray-600">
            {getStatusLabel(review.status)}
          </span>
        </button>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color = getStatusColor(status)
  return (
    <div
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'processing':
    case 'pending':
      return '#00f0ff'
    case 'completed':
      return '#00ff88'
    case 'failed':
      return '#ff4444'
    default:
      return '#666'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'processing':
      return 'PROC'
    case 'pending':
      return 'WAIT'
    case 'completed':
      return 'DONE'
    case 'failed':
      return 'FAIL'
    default:
      return status.toUpperCase().slice(0, 4)
  }
}
