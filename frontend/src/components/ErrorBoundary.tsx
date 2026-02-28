// Global Error Boundary for catching unhandled React errors
// Prevents the entire app from going white when a component crashes (especially 3D scenes)

import { Component, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
    errorInfo: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
        error: null,
        errorInfo: '',
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: { componentStack?: string | null }) {
        console.error('[ErrorBoundary] Caught error:', error)
        console.error('[ErrorBoundary] Component stack:', info.componentStack)
        this.setState({ errorInfo: info.componentStack || '' })
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: '' })
    }

    handleGoHome = () => {
        window.location.href = '/'
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

            return (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="min-h-[60vh] flex items-center justify-center p-8"
                >
                    <div className="max-w-lg w-full text-center space-y-6">
                        {/* Error Icon */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl"
                            style={{
                                background: 'rgba(255, 51, 102, 0.1)',
                                border: '1px solid rgba(255, 51, 102, 0.3)',
                            }}
                        >
                            <AlertTriangle size={36} color="#ff3366" />
                        </motion.div>

                        {/* Title */}
                        <div>
                            <h2
                                className="text-2xl font-bold mb-2"
                                style={{
                                    fontFamily: "'Clash Display', sans-serif",
                                    color: '#ff3366',
                                }}
                            >
                                System Anomaly Detected
                            </h2>
                            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                A component encountered an unexpected error.
                            </p>
                        </div>

                        {/* Error Details */}
                        {this.state.error && (
                            <div
                                className="text-left p-4 rounded-xl overflow-auto max-h-48"
                                style={{
                                    background: 'rgba(255, 51, 102, 0.05)',
                                    border: '1px solid rgba(255, 51, 102, 0.15)',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.6)',
                                }}
                            >
                                <p style={{ color: '#ff3366' }}>{this.state.error.message}</p>
                                {this.state.errorInfo && (
                                    <pre className="mt-2 whitespace-pre-wrap text-xs opacity-50">
                                        {this.state.errorInfo.slice(0, 500)}
                                    </pre>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                                style={{
                                    background: 'linear-gradient(135deg, #00f0ff, #00c4cc)',
                                    color: '#0a0a0f',
                                }}
                            >
                                <RefreshCw size={16} />
                                Retry
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-105"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'rgba(255,255,255,0.8)',
                                }}
                            >
                                <Home size={16} />
                                Dashboard
                            </button>
                        </div>
                    </div>
                </motion.div>
            )
        }

        return this.props.children
    }
}
