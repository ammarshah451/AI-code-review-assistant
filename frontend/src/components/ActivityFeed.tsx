import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { useReviews } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'

type ReviewStatus = 'completed' | 'processing' | 'pending' | 'failed'

const statusConfig: Record<ReviewStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: 'rgb(0, 255, 136)', label: 'completed' },
  processing: { icon: Clock, color: 'rgb(0, 255, 255)', label: 'started' },
  pending: { icon: Clock, color: 'rgb(255, 191, 0)', label: 'queued' },
  failed: { icon: XCircle, color: 'rgb(255, 0, 85)', label: 'failed' },
}

export function ActivityFeed() {
  const navigate = useNavigate()
  const { data } = useReviews(1, 10)

  const activities = data?.items.map(review => ({
    id: review.id,
    type: 'review' as const,
    status: review.status as ReviewStatus,
    prNumber: review.pr_number,
    prTitle: review.pr_title,
    timestamp: review.completed_at || review.created_at,
  })) ?? []

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4">
        Recent Activity
      </h3>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No recent activity
          </p>
        ) : (
          activities.map((activity, index) => {
            const config = statusConfig[activity.status]
            const Icon = config.icon

            return (
              <motion.button
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/reviews/${activity.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-void-200 transition-colors text-left"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${config.color}15` }}
                >
                  <Icon size={16} style={{ color: config.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    PR #{activity.prNumber} {config.label}
                  </p>
                  <p className="text-xs text-gray-500 font-mono truncate">
                    {activity.prTitle}
                  </p>
                </div>
                <span className="text-xs text-gray-600 font-mono whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
