// HolographicHUD - Arc container for HUD panels
// Positions panels in an arc around the scene center

import { type ReactNode } from 'react'

interface PanelConfig {
  id: string
  content: ReactNode
  angle: number // degrees from center
  title?: string
  width?: number
  height?: number
}

interface HolographicHUDProps {
  panels: PanelConfig[]
  radius?: number
  height?: number
}

export function HolographicHUD({ panels, radius = 10, height = 3 }: HolographicHUDProps) {
  return (
    <group>
      {panels.map((panel) => {
        // Convert angle from degrees to radians
        const theta = (panel.angle * Math.PI) / 180

        // Calculate position on arc
        const x = Math.sin(theta) * radius
        const z = -Math.cos(theta) * radius

        // Rotation to face center
        const rotationY = theta

        return (
          <HUDPanelWrapper
            key={panel.id}
            position={[x, height, z]}
            rotation={[0, rotationY, 0]}
            title={panel.title}
            width={panel.width}
            height={panel.height}
          >
            {panel.content}
          </HUDPanelWrapper>
        )
      })}
    </group>
  )
}

// Internal wrapper to avoid circular import
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface HUDPanelWrapperProps {
  children: ReactNode
  position: [number, number, number]
  rotation: [number, number, number]
  title?: string
  width?: number
  height?: number
}

function HUDPanelWrapper({
  children,
  position,
  rotation,
  title,
  width = 280,
  height = 200,
}: HUDPanelWrapperProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* Holographic frame plane */}
      <mesh>
        <planeGeometry args={[3, 2.5]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Frame border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(3, 2.5)]} />
        <lineBasicMaterial color="#00f0ff" transparent opacity={0.3} />
      </lineSegments>

      {/* Corner brackets */}
      <CornerBracket position={[-1.4, 1.2, 0.01]} rotation={0} />
      <CornerBracket position={[1.4, 1.2, 0.01]} rotation={Math.PI / 2} />
      <CornerBracket position={[1.4, -1.2, 0.01]} rotation={Math.PI} />
      <CornerBracket position={[-1.4, -1.2, 0.01]} rotation={-Math.PI / 2} />

      {/* Html content */}
      <Html
        transform
        occlude
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <div
          className="w-full h-full bg-[#050508]/80 backdrop-blur-sm border border-[#00f0ff]/20 rounded-sm overflow-hidden"
          style={{ padding: '12px' }}
        >
          {title && (
            <div className="text-[8px] font-mono text-[#00f0ff]/60 uppercase tracking-widest mb-2 border-b border-[#00f0ff]/10 pb-1">
              {title}
            </div>
          )}
          <div className="text-white font-mono text-xs">
            {children}
          </div>
        </div>
      </Html>
    </group>
  )
}

function CornerBracket({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const bracketSize = 0.2
  return (
    <group position={position} rotation={[0, 0, rotation]}>
      <mesh position={[bracketSize / 2, 0, 0]}>
        <planeGeometry args={[bracketSize, 0.02]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, -bracketSize / 2, 0]}>
        <planeGeometry args={[0.02, bracketSize]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
