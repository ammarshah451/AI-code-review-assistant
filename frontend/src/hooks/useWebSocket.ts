import { useState, useEffect, useRef, useCallback } from 'react'

interface WebSocketOptions {
  onMessage?: (data: unknown) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnectAttempts?: number
  reconnectInterval?: number
}

interface WebSocketState {
  isConnected: boolean
  lastMessage: unknown | null
  error: Event | null
}

export function useWebSocket(url: string | null, options: WebSocketOptions = {}) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    reconnectAttempts = 2,
    reconnectInterval = 5000,
  } = options

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    error: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const urlRef = useRef<string | null>(null)
  const isCleaningUpRef = useRef(false)

  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      if (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close()
      }
      wsRef.current = null
    }
    isCleaningUpRef.current = false
  }, [])

  const connect = useCallback(() => {
    if (!url || isCleaningUpRef.current) return

    // Clean up any existing connection first
    cleanup()

    reconnectCountRef.current = 0

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (wsRef.current === ws) {
          setState(prev => ({ ...prev, isConnected: true, error: null }))
          reconnectCountRef.current = 0
          onConnect?.()
        }
      }

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return
        try {
          const data = JSON.parse(event.data)
          setState(prev => ({ ...prev, lastMessage: data }))
          onMessage?.(data)
        } catch {
          setState(prev => ({ ...prev, lastMessage: event.data }))
          onMessage?.(event.data)
        }
      }

      ws.onclose = () => {
        if (wsRef.current !== ws || isCleaningUpRef.current) return

        setState(prev => ({ ...prev, isConnected: false }))
        onDisconnect?.()

        // Only attempt reconnect if we haven't exceeded attempts and URL hasn't changed
        if (reconnectCountRef.current < reconnectAttempts && urlRef.current === url) {
          reconnectCountRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            if (urlRef.current === url) {
              connect()
            }
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        if (wsRef.current === ws) {
          setState(prev => ({ ...prev, error }))
          onError?.(error)
        }
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
    }
  }, [url, onMessage, onConnect, onDisconnect, onError, reconnectAttempts, reconnectInterval, cleanup])

  const disconnect = useCallback(() => {
    cleanup()
    reconnectCountRef.current = reconnectAttempts
  }, [cleanup, reconnectAttempts])

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  // Track URL changes and manage connection lifecycle
  useEffect(() => {
    const previousUrl = urlRef.current
    urlRef.current = url

    // If URL changed, clean up old connection
    if (previousUrl !== url) {
      cleanup()
      setState({ isConnected: false, lastMessage: null, error: null })
    }

    // Connect if we have a URL
    if (url) {
      connect()
    }

    return () => {
      cleanup()
    }
  }, [url, connect, cleanup])

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  }
}
