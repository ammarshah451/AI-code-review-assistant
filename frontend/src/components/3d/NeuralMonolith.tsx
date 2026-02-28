import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useDeviceCapability } from '../../hooks/useDeviceCapability'

export type MonolithState = 'idle' | 'processing' | 'alert'

interface NeuralMonolithProps {
  state?: MonolithState
  position?: [number, number, number]
}
const STATE_CONFIG = {
  idle: {
    color: '#00ff88',
    rotationSpeed: 0.1,
    pulseSpeed: 0,
  },
  processing: {
    color: '#00f0ff',
    rotationSpeed: 0.5,
    pulseSpeed: 2,
  },
  alert: {
    color: '#ff00aa',
    rotationSpeed: 0.3,
    pulseSpeed: 4,
  },
}

export function NeuralMonolith({ state = 'idle', position = [0, 2, 0] }: NeuralMonolithProps) {
  const { tier } = useDeviceCapability()
  const isHighTier = tier === 'high'

  const groupRef = useRef<THREE.Group>(null)
  const monolithRef = useRef<THREE.Mesh>(null)
  const wireframeRef = useRef<THREE.Mesh>(null)
  const coreRef = useRef<THREE.Mesh>(null)

  const config = STATE_CONFIG[state]

  // Memoize colors
  const mainColor = useMemo(() => new THREE.Color(config.color), [config.color])

  useFrame((_, delta) => {
    if (!groupRef.current || !monolithRef.current || !wireframeRef.current || !coreRef.current) return

    const time = Date.now() * 0.001

    // Rotation animation
    monolithRef.current.rotation.y += delta * config.rotationSpeed
    monolithRef.current.rotation.x += delta * config.rotationSpeed * 0.3

    // Counter-rotate wireframe for visual interest
    wireframeRef.current.rotation.y -= delta * config.rotationSpeed * 0.5
    wireframeRef.current.rotation.z += delta * config.rotationSpeed * 0.2

    // Breathing animation (scale modulation 1.0 to 1.02)
    const breathScale = 1 + Math.sin(time * 2) * 0.02
    monolithRef.current.scale.setScalar(breathScale)

    // Pulse animation for processing/alert states
    if (config.pulseSpeed > 0) {
      const pulseScale = 1 + Math.sin(time * config.pulseSpeed) * 0.05
      groupRef.current.scale.setScalar(pulseScale)
    }

    // Core glow pulsation
    const coreScale = 0.3 + Math.sin(time * 3) * 0.05
    coreRef.current.scale.setScalar(coreScale)
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Main Icosahedron */}
      <mesh ref={monolithRef} castShadow>
        <icosahedronGeometry args={[1.5, 0]} />
        {isHighTier ? (
          <MeshTransmissionMaterial
            thickness={1.5}
            chromaticAberration={0.06}
            anisotropy={0.1}
            transmission={0.95}
            roughness={0.1}
            envMapIntensity={1}
            color={mainColor}
            backside
            resolution={512}
            samples={4}
          />
        ) : (
          <meshPhysicalMaterial
            transparent
            opacity={0.8}
            roughness={0.2}
            metalness={0.8}
            color={mainColor}
            envMapIntensity={1}
          />
        )}
      </mesh>


      {/* Inner core sphere with glow - Reduced segments */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={config.color} transparent opacity={0.8} />
      </mesh>

      {/* Point light inside for glow effect */}
      <pointLight
        color={config.color}
        intensity={2}
        distance={5}
        decay={2}
      />

      {/* Outer wireframe */}
      <mesh ref={wireframeRef}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshBasicMaterial
          color={config.color}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Pulse rings for alert state */}
      {state === 'alert' && <PulseRings color={config.color} />}

      {/* Agent Labels */}
      <Html position={[0, 2.5, 0]} center>
        <div className="text-[10px] font-mono tracking-wider text-[#00f0ff] whitespace-nowrap">
          LOGIC
        </div>
      </Html>

      <Html position={[-1.8, 0.5, 1.5]} center>
        <div className="text-[10px] font-mono tracking-wider text-[#ff00aa] whitespace-nowrap">
          SECURITY
        </div>
      </Html>

      <Html position={[1.8, 0.5, 1.5]} center>
        <div className="text-[10px] font-mono tracking-wider text-[#00ff88] whitespace-nowrap">
          QUALITY
        </div>
      </Html>
    </group>
  )
}

// Animated pulse rings for alert state
function PulseRings({ color }: { color: string }) {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const time = Date.now() * 0.001

    if (ring1Ref.current) {
      const scale1 = 1.5 + (time % 2) * 0.5
      ring1Ref.current.scale.setScalar(scale1)
      const material = ring1Ref.current.material as THREE.MeshBasicMaterial
      material.opacity = Math.max(0, 1 - (time % 2) * 0.5)
    }

    if (ring2Ref.current) {
      const scale2 = 1.5 + ((time + 0.66) % 2) * 0.5
      ring2Ref.current.scale.setScalar(scale2)
      const material = ring2Ref.current.material as THREE.MeshBasicMaterial
      material.opacity = Math.max(0, 1 - ((time + 0.66) % 2) * 0.5)
    }

    if (ring3Ref.current) {
      const scale3 = 1.5 + ((time + 1.33) % 2) * 0.5
      ring3Ref.current.scale.setScalar(scale3)
      const material = ring3Ref.current.material as THREE.MeshBasicMaterial
      material.opacity = Math.max(0, 1 - ((time + 1.33) % 2) * 0.5)
    }
  })

  return (
    <>
      <mesh ref={ring1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring3Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}
