// FogEnvironment - Atmospheric fog and lighting for the Obsidian Vault
// Creates the dark, moody atmosphere with exponential fog

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

const FOG_COLOR = '#050508'
const FOG_DENSITY = 0.05

export function FogEnvironment() {
  const { scene } = useThree()

  useEffect(() => {
    // Set scene background
    scene.background = new THREE.Color(FOG_COLOR)

    // Set exponential fog
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY)

    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene])

  return (
    <>
      {/* Ambient light - subtle cyan tint */}
      <ambientLight intensity={0.1} color="#00f0ff" />

      {/* Point light below floor for reflection glow */}
      <pointLight
        position={[0, -5, 0]}
        intensity={0.5}
        color="#00f0ff"
        distance={20}
        decay={2}
      />

      {/* Directional light from above */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.3}
        color="#ffffff"
        castShadow
      />

      {/* Secondary fill light */}
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.1}
        color="#ff00aa"
      />
    </>
  )
}
