// API Client for CodeGuard AI

import type {
  DashboardStats,
  Finding,
  PaginatedResponse,
  Repository,
  RepositoryCreate,
  Review,
  ReviewWithFindings,
  Settings,
  SettingsUpdate,
} from '../types'

export interface FalsePositiveRequest {
  is_false_positive: boolean
  reason?: string
}

/** Structured API error with status code and detail message. */
export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(`API Error: ${status} — ${detail}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

const API_BASE = '/api'

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    // Try to extract a detailed error message from the response body
    let detail = response.statusText
    try {
      const body = await response.json()
      detail = body?.detail || body?.message || detail
    } catch {
      // Response body wasn't JSON — use statusText
    }
    throw new ApiError(response.status, detail)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Stats API
export async function getStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>('/stats')
}

// Reviews API
export async function getReviews(
  page = 1,
  perPage = 20
): Promise<PaginatedResponse<Review>> {
  return fetchApi<PaginatedResponse<Review>>(
    `/reviews?page=${page}&per_page=${perPage}`
  )
}

export async function getReview(reviewId: string): Promise<ReviewWithFindings> {
  return fetchApi<ReviewWithFindings>(`/reviews/${reviewId}`)
}

export async function getRepositoryReviews(
  repoId: string,
  limit = 50
): Promise<Review[]> {
  return fetchApi<Review[]>(`/repositories/${repoId}/reviews?limit=${limit}`)
}

// Repositories API
export async function getRepositories(
  page = 1,
  perPage = 20
): Promise<PaginatedResponse<Repository>> {
  return fetchApi<PaginatedResponse<Repository>>(
    `/repositories?page=${page}&per_page=${perPage}`
  )
}

export async function getRepository(repoId: string): Promise<Repository> {
  return fetchApi<Repository>(`/repositories/${repoId}`)
}

export async function createRepository(
  data: RepositoryCreate
): Promise<Repository> {
  return fetchApi<Repository>('/repositories', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteRepository(repoId: string): Promise<void> {
  return fetchApi<void>(`/repositories/${repoId}`, {
    method: 'DELETE',
  })
}

// Settings API
export async function getRepositorySettings(repoId: string): Promise<Settings> {
  return fetchApi<Settings>(`/repositories/${repoId}/settings`)
}

export async function updateRepositorySettings(
  repoId: string,
  data: SettingsUpdate
): Promise<Settings> {
  return fetchApi<Settings>(`/repositories/${repoId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// Findings API
export async function markFalsePositive(
  findingId: string,
  data: FalsePositiveRequest
): Promise<Finding> {
  return fetchApi<Finding>(`/findings/${findingId}/false-positive`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
