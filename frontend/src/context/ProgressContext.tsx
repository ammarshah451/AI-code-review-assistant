import { createContext, useContext, useState, ReactNode } from 'react'

interface ActiveReview {
  reviewId: string
  prNumber: number
  prTitle: string
}

interface ProgressContextType {
  activeReview: ActiveReview | null
  setActiveReview: (review: ActiveReview | null) => void
}

const ProgressContext = createContext<ProgressContextType | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [activeReview, setActiveReview] = useState<ActiveReview | null>(null)

  return (
    <ProgressContext.Provider value={{ activeReview, setActiveReview }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgressContext() {
  const context = useContext(ProgressContext)
  if (!context) {
    throw new Error('useProgressContext must be used within ProgressProvider')
  }
  return context
}
