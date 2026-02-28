// ObsidianFloor - Reflective obsidian floor plane
// Large plane with MeshReflectorMaterial for mirror-like reflections

import { MeshReflectorMaterial } from '@react-three/drei'

export function ObsidianFloor() {
  return (
    <mesh
      position={[0, -2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[100, 100]} />
      <MeshReflectorMaterial
        blur={[400, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={15}
        roughness={0.1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#050508"
        metalness={0.9}
        mirror={0.5}
      />
    </mesh>
  )
}
