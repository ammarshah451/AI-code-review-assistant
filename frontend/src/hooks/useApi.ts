// React Query hooks for API calls

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/client'
import type { FalsePositiveRequest } from '../api/client'
import type { RepositoryCreate, SettingsUpdate } from '../types'

// Stats
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}

// Reviews — smart polling: fast when active, slow when idle
export function useReviews(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['reviews', page, perPage],
    queryFn: () => api.getReviews(page, perPage),
    refetchInterval: (query) => {
      // Poll quickly only when reviews are actively processing
      const hasActive = query.state.data?.items?.some(
        (r: { status: string }) => r.status === 'processing' || r.status === 'pending'
      )
      return hasActive ? 3000 : 30000 // 3s when active, 30s when idle
    },
  })
}

export function useReview(reviewId: string) {
  return useQuery({
    queryKey: ['review', reviewId],
    queryFn: () => api.getReview(reviewId),
    enabled: !!reviewId,
  })
}

export function useRepositoryReviews(repoId: string, limit = 50) {
  return useQuery({
    queryKey: ['repository-reviews', repoId, limit],
    queryFn: () => api.getRepositoryReviews(repoId, limit),
    enabled: !!repoId,
  })
}

// Repositories
export function useRepositories(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['repositories', page, perPage],
    queryFn: () => api.getRepositories(page, perPage),
  })
}

export function useRepository(repoId: string) {
  return useQuery({
    queryKey: ['repository', repoId],
    queryFn: () => api.getRepository(repoId),
    enabled: !!repoId,
  })
}

export function useCreateRepository() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: RepositoryCreate) => api.createRepository(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteRepository() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (repoId: string) => api.deleteRepository(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// Settings
export function useRepositorySettings(repoId: string) {
  return useQuery({
    queryKey: ['settings', repoId],
    queryFn: () => api.getRepositorySettings(repoId),
    enabled: !!repoId,
  })
}

export function useUpdateRepositorySettings(repoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SettingsUpdate) =>
      api.updateRepositorySettings(repoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', repoId] })
    },
  })
}

// Findings
export function useMarkFalsePositive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ findingId, data }: { findingId: string; data: FalsePositiveRequest }) =>
      api.markFalsePositive(findingId, data),
    onSuccess: () => {
      // Invalidate the review that contains this finding
      queryClient.invalidateQueries({ queryKey: ['review'] })
    },
  })
}
