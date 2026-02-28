// HUDPanel - Individual holographic panel in 3D space
// Semi-transparent panel with corner brackets and Html content

import { type ReactNode } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface HUDPanelProps {
  children: ReactNode
  position?: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
  title?: string
}

export function HUDPanel({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 280,
  height = 200,
  title,
}: HUDPanelProps) {
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

      {/* Corner brackets */}
      <CornerBrackets />

      {/* Frame border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(3, 2.5)]} />
        <lineBasicMaterial color="#00f0ff" transparent opacity={0.3} />
      </lineSegments>

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

// Corner bracket decorations
function CornerBrackets() {
  const bracketSize = 0.2
  const offset = 1.4

  const positions: [number, number, number, number][] = [
    [-offset, offset, 0, 0],           // top-left
    [offset, offset, Math.PI / 2, 0],  // top-right
    [offset, -offset, Math.PI, 0],     // bottom-right
    [-offset, -offset, -Math.PI / 2, 0], // bottom-left
  ]

  return (
    <>
      {positions.map(([x, y, rotZ], i) => (
        <group key={i} position={[x, y, 0.01]} rotation={[0, 0, rotZ]}>
          <mesh position={[bracketSize / 2, 0, 0]}>
            <planeGeometry args={[bracketSize, 0.02]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, -bracketSize / 2, 0]}>
            <planeGeometry args={[0.02, bracketSize]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  )
}
