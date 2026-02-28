// API Types for CodeGuard AI

export type ReviewStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type AgentType = 'logic' | 'security' | 'quality'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Repository {
  id: string
  github_id: number
  full_name: string
  webhook_secret?: string
  created_at: string
}

export interface RepositoryCreate {
  github_id: number
  full_name: string
  webhook_secret?: string
}

export interface Review {
  id: string
  repository_id: string
  pr_number: number
  pr_title: string
  commit_sha: string
  status: ReviewStatus
  comment_id?: number
  diff_content?: string
  created_at: string
  completed_at?: string
}

export type Confidence = 'high' | 'medium' | 'low'

export interface Finding {
  id: string
  review_id: string
  agent_type: AgentType
  severity: Severity
  file_path: string
  line_number?: number
  title: string
  description: string
  suggestion?: string
  confidence?: Confidence
  is_false_positive?: boolean
  false_positive_reason?: string
  created_at: string
}

export interface ReviewWithFindings extends Review {
  findings: Finding[]
}

export interface Settings {
  id: string
  repository_id: string
  enabled: boolean
  agents_enabled: {
    logic: boolean
    security: boolean
    quality: boolean
  }
  severity_threshold: Severity
  created_at: string
  updated_at: string
}

export interface SettingsUpdate {
  enabled?: boolean
  agents_enabled?: {
    logic: boolean
    security: boolean
    quality: boolean
  }
  severity_threshold?: Severity
}

export interface DashboardStats {
  total_repositories: number
  total_reviews: number
  reviews_by_status: {
    pending: number
    processing: number
    completed: number
    failed: number
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}
