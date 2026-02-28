// DNAForensicHelix - DNA-style helix visualization of reviews
// Reviews are displayed as nodes on a rotating double helix

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HelixNode } from './HelixNode'
import type { Review } from '../../types'

interface DNAForensicHelixProps {
  reviews: Review[]
  onReviewClick?: (review: Review) => void
  selectedReviewId?: string
}

const HELIX_RADIUS = 2
const VERTICAL_SPACING = 0.8
const ANGLE_INCREMENT = 0.5 // radians per node
const ROTATION_SPEED = 0.1

export function DNAForensicHelix({
  reviews,
  onReviewClick,
  selectedReviewId,
}: DNAForensicHelixProps) {
  const groupRef = useRef<THREE.Group>(null)
  const spineRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      // Gentle rotation
      groupRef.current.rotation.y += delta * ROTATION_SPEED
    }
  })

  // Calculate helix height based on number of reviews
  const helixHeight = reviews.length * VERTICAL_SPACING

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central spine */}
      <mesh ref={spineRef} position={[0, helixHeight / 2 - 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, helixHeight + 2, 16]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Helix nodes and strands */}
      {reviews.map((review, index) => {
        const angle = index * ANGLE_INCREMENT
        const y = index * VERTICAL_SPACING

        // Position on first helix strand
        const x1 = Math.sin(angle) * HELIX_RADIUS
        const z1 = Math.cos(angle) * HELIX_RADIUS

        // Position on second helix strand (180° offset)
        const x2 = Math.sin(angle + Math.PI) * HELIX_RADIUS
        const z2 = Math.cos(angle + Math.PI) * HELIX_RADIUS

        return (
          <group key={review.id}>
            {/* Primary node */}
            <HelixNode
              review={review}
              position={[x1, y, z1]}
              isSelected={review.id === selectedReviewId}
              onClick={() => onReviewClick?.(review)}
            />

            {/* Strand connection to spine */}
            <StrandConnection
              from={[x1, y, z1]}
              to={[0, y, 0]}
              color={getStatusColor(review.status)}
            />

            {/* Secondary strand connection (decorative) */}
            <StrandConnection
              from={[x2, y, z2]}
              to={[0, y, 0]}
              color="#333"
              opacity={0.3}
            />

            {/* Secondary decorative node */}
            <mesh position={[x2, y, z2]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color="#333" transparent opacity={0.5} />
            </mesh>
          </group>
        )
      })}

      {/* Base glow */}
      <pointLight position={[0, -1, 0]} color="#00f0ff" intensity={1} distance={5} />

      {/* Top glow */}
      <pointLight position={[0, helixHeight + 1, 0]} color="#ff00aa" intensity={0.5} distance={5} />
    </group>
  )
}

// Connection strand between node and spine
function StrandConnection({
  from,
  to,
  color,
  opacity = 0.6,
}: {
  from: [number, number, number]
  to: [number, number, number]
  color: string
  opacity?: number
}) {
  const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)]
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
  const lineMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity })

  return <primitive object={new THREE.Line(lineGeometry, lineMaterial)} />
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'processing':
    case 'pending':
      return '#00f0ff'
    case 'completed':
      return '#00ff88'
    case 'failed':
      return '#ff4444'
    default:
      return '#666'
  }
}
