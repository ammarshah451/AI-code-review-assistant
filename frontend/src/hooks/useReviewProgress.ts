import { useState, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

interface ProgressData {
  stage: string
  progress: number
  message: string
}

interface ProgressState {
  stage: string
  progress: number
  message: string
  isConnected: boolean
  isComplete: boolean
}

export function useReviewProgress(reviewId: string | null, enabled = true) {
  const [state, setState] = useState<ProgressState>({
    stage: '',
    progress: 0,
    message: '',
    isConnected: false,
    isComplete: false,
  })

  // Determine WebSocket URL based on environment
  const getWsUrl = () => {
    if (!enabled || !reviewId) return null

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // In dev (Vite port 5173), the API server runs on port 5000; in prod, use the same host
    const isDev = window.location.port === '5173'
    const host = isDev
      ? `${window.location.hostname}:5000`
      : window.location.host

    return `${protocol}//${host}/ws/reviews/${reviewId}`
  }

  const wsUrl = getWsUrl()

  const { isConnected } = useWebSocket(wsUrl, {
    onMessage: (data) => {
      const progressData = data as ProgressData
      setState(prev => ({
        ...prev,
        stage: progressData.stage,
        progress: progressData.progress,
        message: progressData.message,
        isComplete: progressData.stage === 'complete',
      }))
    },
    onConnect: () => {
      setState(prev => ({ ...prev, isConnected: true }))
    },
    onDisconnect: () => {
      setState(prev => ({ ...prev, isConnected: false }))
    },
  })

  useEffect(() => {
    setState(prev => ({ ...prev, isConnected }))
  }, [isConnected])

  return state
}
