// Inline Diff Viewer — renders unified diff with finding overlays
// Custom zero-dependency diff parser & renderer

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, AlertTriangle, AlertCircle, Info, FileCode } from 'lucide-react'
import type { Finding, Severity } from '../types'

// ─── Types ──────────────────────────────────────────

interface DiffLine {
    type: 'added' | 'removed' | 'context' | 'header'
    content: string
    oldLineNumber?: number
    newLineNumber?: number
}

interface DiffFile {
    filePath: string
    lines: DiffLine[]
}

interface DiffViewerProps {
    diff: string
    findings: Finding[]
    scrollToFinding?: string // finding ID to scroll to
}

// ─── Parser ─────────────────────────────────────────

function parseDiff(diff: string): DiffFile[] {
    const files: DiffFile[] = []
    const sections = diff.split(/(?=^diff --git )/m)

    for (const section of sections) {
        if (!section.trim()) continue

        const fileMatch = section.match(/^diff --git a\/(.+?) b\//)
        if (!fileMatch) continue

        const filePath = fileMatch[1]
        const lines: DiffLine[] = []

        const rawLines = section.split('\n')
        let oldLine = 0
        let newLine = 0

        for (const raw of rawLines) {
            if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('---') || raw.startsWith('+++')) {
                continue
            }

            if (raw.startsWith('@@')) {
                // Parse hunk header: @@ -old,count +new,count @@
                const hunkMatch = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/)
                if (hunkMatch) {
                    oldLine = parseInt(hunkMatch[1], 10)
                    newLine = parseInt(hunkMatch[2], 10)
                    lines.push({ type: 'header', content: raw })
                }
                continue
            }

            if (raw.startsWith('+')) {
                lines.push({
                    type: 'added',
                    content: raw.substring(1),
                    newLineNumber: newLine,
                })
                newLine++
            } else if (raw.startsWith('-')) {
                lines.push({
                    type: 'removed',
                    content: raw.substring(1),
                    oldLineNumber: oldLine,
                })
                oldLine++
            } else if (raw.startsWith(' ') || raw === '') {
                // Context line (or empty line in diff)
                if (oldLine > 0 || newLine > 0) {
                    lines.push({
                        type: 'context',
                        content: raw.startsWith(' ') ? raw.substring(1) : raw,
                        oldLineNumber: oldLine,
                        newLineNumber: newLine,
                    })
                    oldLine++
                    newLine++
                }
            }
        }

        if (lines.length > 0) {
            files.push({ filePath, lines })
        }
    }

    return files
}

// ─── Severity config ────────────────────────────────

const severityIcon: Record<Severity, typeof AlertTriangle> = {
    critical: AlertTriangle,
    high: AlertTriangle,
    medium: AlertCircle,
    low: AlertCircle,
    info: Info,
}

const severityColor: Record<Severity, string> = {
    critical: '#ff3366',
    high: '#ff6644',
    medium: '#ffaa00',
    low: '#88cc00',
    info: '#00f0ff',
}

// ─── FileSection Component ──────────────────────────

function FileSection({
    file,
    fileFindings,
    scrollToFinding,
}: {
    file: DiffFile
    fileFindings: Finding[]
    scrollToFinding?: string
}) {
    const [isExpanded, setIsExpanded] = useState(true)
    const lineRefs = useRef<Map<string, HTMLDivElement>>(new Map())

    // Scroll to finding when requested
    useEffect(() => {
        if (!scrollToFinding) return
        const finding = fileFindings.find(f => f.id === scrollToFinding)
        if (!finding?.line_number) return

        const ref = lineRefs.current.get(`new-${finding.line_number}`)
        if (ref) {
            ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [scrollToFinding, fileFindings])

    // Build a map of line_number → findings for quick lookup
    const findingsByLine = new Map<number, Finding[]>()
    for (const f of fileFindings) {
        if (f.line_number) {
            const existing = findingsByLine.get(f.line_number) || []
            existing.push(f)
            findingsByLine.set(f.line_number, existing)
        }
    }

    const addedCount = file.lines.filter(l => l.type === 'added').length
    const removedCount = file.lines.filter(l => l.type === 'removed').length

    return (
        <div style={{
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 15, 25, 0.6)',
            overflow: 'hidden',
            marginBottom: '16px',
        }}>
            {/* File header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: 'none',
                    borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                    color: '#e0e0e0',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    textAlign: 'left',
                }}
            >
                {isExpanded ? (
                    <ChevronDown size={16} style={{ color: '#888', flexShrink: 0 }} />
                ) : (
                    <ChevronRight size={16} style={{ color: '#888', flexShrink: 0 }} />
                )}
                <FileCode size={16} style={{ color: '#00f0ff', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.filePath}
                </span>
                <span style={{ display: 'flex', gap: '8px', flexShrink: 0, fontSize: '12px' }}>
                    {addedCount > 0 && (
                        <span style={{ color: '#3fb950' }}>+{addedCount}</span>
                    )}
                    {removedCount > 0 && (
                        <span style={{ color: '#f85149' }}>-{removedCount}</span>
                    )}
                    {fileFindings.length > 0 && (
                        <span style={{
                            background: 'rgba(255, 170, 0, 0.15)',
                            color: '#ffaa00',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                        }}>
                            {fileFindings.length} finding{fileFindings.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </span>
            </button>

            {/* Diff content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            overflowX: 'auto',
                            fontSize: '13px',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            lineHeight: '1.6',
                        }}>
                            {file.lines.map((line, idx) => {
                                const lineFindings = line.newLineNumber
                                    ? findingsByLine.get(line.newLineNumber) || []
                                    : []
                                const hasFinding = lineFindings.length > 0

                                return (
                                    <div key={idx}>
                                        <DiffLineRow
                                            line={line}
                                            hasFinding={hasFinding}
                                            ref={(el: HTMLDivElement | null) => {
                                                if (el && line.newLineNumber) {
                                                    lineRefs.current.set(`new-${line.newLineNumber}`, el)
                                                }
                                            }}
                                        />
                                        {/* Render inline finding annotations */}
                                        {lineFindings.map(finding => (
                                            <FindingAnnotation key={finding.id} finding={finding} />
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── DiffLineRow ────────────────────────────────────

import { forwardRef } from 'react'

const DiffLineRow = forwardRef<HTMLDivElement, { line: DiffLine; hasFinding: boolean }>(
    function DiffLineRow({ line, hasFinding }, ref) {
        const bgColors: Record<DiffLine['type'], string> = {
            added: 'rgba(63, 185, 80, 0.1)',
            removed: 'rgba(248, 81, 73, 0.1)',
            context: 'transparent',
            header: 'rgba(56, 139, 253, 0.08)',
        }

        const gutterColors: Record<DiffLine['type'], string> = {
            added: '#3fb950',
            removed: '#f85149',
            context: '#484848',
            header: '#388bfd',
        }

        const prefix: Record<DiffLine['type'], string> = {
            added: '+',
            removed: '-',
            context: ' ',
            header: '',
        }

        if (line.type === 'header') {
            return (
                <div style={{
                    padding: '4px 16px',
                    background: bgColors.header,
                    color: '#388bfd',
                    fontSize: '12px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                }}>
                    {line.content}
                </div>
            )
        }

        return (
            <div
                ref={ref}
                style={{
                    display: 'flex',
                    background: hasFinding
                        ? 'rgba(255, 170, 0, 0.08)'
                        : bgColors[line.type],
                    borderLeft: hasFinding ? '3px solid #ffaa00' : '3px solid transparent',
                    minWidth: 'fit-content',
                }}
            >
                {/* Old line number */}
                <span style={{
                    display: 'inline-block',
                    width: '50px',
                    textAlign: 'right',
                    padding: '0 8px',
                    color: gutterColors[line.type],
                    opacity: 0.5,
                    userSelect: 'none',
                    flexShrink: 0,
                    borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                }}>
                    {line.oldLineNumber ?? ''}
                </span>

                {/* New line number */}
                <span style={{
                    display: 'inline-block',
                    width: '50px',
                    textAlign: 'right',
                    padding: '0 8px',
                    color: gutterColors[line.type],
                    opacity: 0.5,
                    userSelect: 'none',
                    flexShrink: 0,
                    borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                }}>
                    {line.newLineNumber ?? ''}
                </span>

                {/* Prefix (+/-/ ) */}
                <span style={{
                    display: 'inline-block',
                    width: '20px',
                    textAlign: 'center',
                    color: gutterColors[line.type],
                    flexShrink: 0,
                    fontWeight: 600,
                }}>
                    {prefix[line.type]}
                </span>

                {/* Content */}
                <span style={{
                    flex: 1,
                    padding: '0 8px',
                    color: line.type === 'added' ? '#aaffa8'
                        : line.type === 'removed' ? '#ffa8a8'
                            : '#d0d0d0',
                    whiteSpace: 'pre',
                }}>
                    {line.content}
                </span>
            </div>
        )
    }
)

// ─── FindingAnnotation ──────────────────────────────

function FindingAnnotation({ finding }: { finding: Finding }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const Icon = severityIcon[finding.severity]
    const color = severityColor[finding.severity]

    return (
        <div style={{
            margin: '0 16px 0 123px',
            borderRadius: '8px',
            border: `1px solid ${color}33`,
            background: `${color}0a`,
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '6px 12px',
                    background: 'none',
                    border: 'none',
                    color,
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: "'Inter', sans-serif",
                    textAlign: 'left',
                }}
            >
                <Icon size={14} />
                <span style={{ fontWeight: 600 }}>{finding.title}</span>
                <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    opacity: 0.6,
                    textTransform: 'uppercase',
                }}>
                    {finding.agent_type} · {finding.severity}
                </span>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            padding: '8px 12px 12px',
                            borderTop: `1px solid ${color}22`,
                            color: '#c0c0c0',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            fontFamily: "'Inter', sans-serif",
                        }}>
                            <p style={{ margin: '0 0 8px' }}>{finding.description}</p>
                            {finding.suggestion && (
                                <div style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    background: 'rgba(0, 240, 255, 0.05)',
                                    border: '1px solid rgba(0, 240, 255, 0.1)',
                                    color: '#a0e0e0',
                                    fontSize: '12px',
                                }}>
                                    <strong style={{ color: '#00f0ff' }}>💡 Suggestion:</strong> {finding.suggestion}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Main DiffViewer Component ──────────────────────

export default function DiffViewer({ diff, findings, scrollToFinding }: DiffViewerProps) {
    const files = parseDiff(diff)

    if (files.length === 0) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#666',
                fontStyle: 'italic',
            }}>
                No diff content to display
            </div>
        )
    }

    return (
        <div>
            {files.map(file => {
                const fileFindings = findings.filter(f =>
                    f.file_path === file.filePath ||
                    f.file_path.endsWith('/' + file.filePath) ||
                    file.filePath.endsWith('/' + f.file_path)
                )

                return (
                    <FileSection
                        key={file.filePath}
                        file={file}
                        fileFindings={fileFindings}
                        scrollToFinding={scrollToFinding}
                    />
                )
            })}
        </div>
    )
}
