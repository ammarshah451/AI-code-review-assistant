// useDeviceCapability - Check if device can handle 3D rendering
// Checks WebGL2 support, screen size, device memory, and real-time FPS

import { useState, useEffect, useRef } from 'react'

export type PerformanceTier = 'high' | 'medium' | 'low'

interface DeviceCapability {
  canRender3D: boolean
  hasWebGL2: boolean
  isMobile: boolean
  hasLowMemory: boolean
  fps: number
  tier: PerformanceTier
  isLowPowerMode: boolean
}

export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>({
    canRender3D: true, // Optimistic initial state
    hasWebGL2: true,
    isMobile: false,
    hasLowMemory: false,
    fps: 60,
    tier: 'high',
    isLowPowerMode: false,
  })

  // FPS Monitoring
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const fpsHistory = useRef<number[]>([])

  useEffect(() => {
    // 1. Static Checks
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    const hasWebGL2 = !!gl
    const isMobile = window.innerWidth < 768
    // @ts-ignore - deviceMemory is non-standard but useful
    const deviceMemory = (navigator as any).deviceMemory || 4
    const hasLowMemory = deviceMemory < 4
    // @ts-ignore - hardwareConcurrency
    const cores = navigator.hardwareConcurrency || 4

    // Initial tier guess based on hardware
    let initialTier: PerformanceTier = 'high'
    if (isMobile || hasLowMemory || cores < 4) initialTier = 'medium'
    if (deviceMemory < 2) initialTier = 'low'

    // Clean up WebGL context
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    }

    setCapability(prev => ({
      ...prev,
      hasWebGL2,
      isMobile,
      hasLowMemory,
      tier: initialTier,
      canRender3D: hasWebGL2 && initialTier !== 'low',
    }))

    // 2. Dynamic FPS Monitoring loop
    let requestID: number
    const checkInterval = 1000 // Check every second

    const loop = () => {
      const now = performance.now()
      frameCount.current++

      if (now - lastTime.current >= checkInterval) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current))

        // Update FPS history (keep last 5 seconds)
        fpsHistory.current.push(fps)
        if (fpsHistory.current.length > 5) fpsHistory.current.shift()

        // Calculate average FPS
        const avgFps = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length

        // Determine if we need to downgrade tier
        setCapability(prev => {
          let newTier = prev.tier

          // Downgrade logic: sustained low FPS
          if (prev.tier === 'high' && avgFps < 45) newTier = 'medium'
          if (prev.tier === 'medium' && avgFps < 30) newTier = 'low'

          // Low power mode detection (often caps at 30fps)
          if (avgFps < 35 && avgFps > 25 && prev.tier === 'high') {
            // Ambiguous: could be 30fps cap or just slow. 
            // If it's rock solid 30 (variance low), it might be power save.
            // For safety, we treat < 30 as 'low' for 3D purposes.
          }

          // Force disable 3D if tier drops to low
          const canRender3D = prev.hasWebGL2 && !prev.isMobile && newTier !== 'low'

          if (prev.fps !== fps || prev.tier !== newTier || prev.canRender3D !== canRender3D) {
            return {
              ...prev,
              fps,
              tier: newTier,
              canRender3D,
            }
          }
          return prev
        })

        frameCount.current = 0
        lastTime.current = now
      }

      requestID = requestAnimationFrame(loop)
    }

    requestID = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(requestID)
    }
  }, [])

  return capability
}
