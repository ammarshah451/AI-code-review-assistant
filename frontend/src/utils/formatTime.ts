/**
 * Lightweight relative time formatter — no external dependencies.
 * Converts ISO date strings to human-readable relative times.
 */

const MINUTE = 60
const HOUR = 3600
const DAY = 86400
const WEEK = 604800
const MONTH = 2592000 // ~30 days
const YEAR = 31536000

/**
 * Format an ISO date string as a relative time (e.g. "2 hours ago", "Just now").
 * Falls back to a short date for anything older than ~3 months.
 */
export function formatRelativeTime(isoDate: string | undefined | null): string {
    if (!isoDate) return '—'

    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 0) return 'Just now' // Future dates (clock skew)
    if (diffSec < 30) return 'Just now'
    if (diffSec < MINUTE) return `${diffSec}s ago`
    if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}m ago`
    if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}h ago`
    if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)}d ago`
    if (diffSec < MONTH) return `${Math.floor(diffSec / WEEK)}w ago`
    if (diffSec < YEAR * 0.25) {
        // Under 3 months — show relative
        return `${Math.floor(diffSec / MONTH)}mo ago`
    }

    // Older than ~3 months — show short date
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
}
