// HelixNode - Individual node on the DNA Helix
// Sphere with status-based colors, hover states, tooltip

import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Review } from '../../types'

interface HelixNodeProps {
  review: Review
  position: [number, number, number]
  isSelected?: boolean
  onClick?: () => void
}

const STATUS_COLORS = {
  processing: '#00f0ff',
  pending: '#00f0ff',
  completed: '#00ff88',
  failed: '#ff4444',
}

export function HelixNode({ review, position, isSelected = false, onClick }: HelixNodeProps) {
  const [hovered, setHovered] = useState(false)
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  const color = STATUS_COLORS[review.status as keyof typeof STATUS_COLORS] || '#666'
  const isProcessing = review.status === 'processing' || review.status === 'pending'

  useFrame(() => {
    if (!meshRef.current) return

    // Pulse animation for processing nodes
    if (isProcessing) {
      const time = Date.now() * 0.003
      const scale = 1 + Math.sin(time) * 0.2
      meshRef.current.scale.setScalar(scale)
    }

    // Glow ring animation on hover
    if (glowRef.current && hovered) {
      const time = Date.now() * 0.002
      glowRef.current.scale.setScalar(1.5 + Math.sin(time) * 0.1)
    }
  })

  const radius = isSelected ? 0.2 : 0.15

  return (
    <group position={position}>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
        />
      </mesh>

      {/* Glow ring on hover */}
      {hovered && (
        <mesh ref={glowRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.25, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.3, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Point light for glow effect */}
      <pointLight color={color} intensity={hovered ? 1 : 0.3} distance={1} decay={2} />

      {/* Tooltip on hover */}
      {hovered && (
        <Html position={[0.5, 0.5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="bg-[#050508]/90 border border-[#00f0ff]/30 rounded px-2 py-1 whitespace-nowrap">
            <div className="text-[10px] font-mono text-white">
              PR #{review.pr_number}
            </div>
            <div className="text-[8px] font-mono text-gray-500 uppercase">
              {review.status}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
