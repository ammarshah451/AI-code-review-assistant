// SovereignStage - Main Canvas wrapper for 3D scene
// Provides the R3F Canvas with camera, suspense boundary, and performance settings

import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Preload, AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'

interface SovereignStageProps {
  children: ReactNode
  className?: string
}

export function SovereignStage({ children, className = '' }: SovereignStageProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{
          position: [0, 5, 15],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        dpr={[1, 2]} // Cap DPR at 2 for high-density screens (saves huge GPU load)
        frameloop="demand" // Only render when needed (requires invalidate interaction) - switching to 'always' with fps limit later if needed, but 'demand' is best for tools
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'default', // Don't force high-performance GPU
          stencil: false,
          depth: true,
        }}
      >
        <Suspense fallback={null}>
          <PerformanceMonitor
            onDecline={() => {
              // Performance declined - AdaptiveDpr will handle DPR reduction
            }}
          >
            <AdaptiveDpr pixelated />
            {children}
            <Preload all />
          </PerformanceMonitor>
        </Suspense>
      </Canvas>
    </div>
  )
}
