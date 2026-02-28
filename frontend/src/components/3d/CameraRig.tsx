// CameraRig - Mouse-following camera with smooth interpolation
// Applies ±5° tilt based on mouse position

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const MAX_TILT = 0.0873 // ±5° in radians
const LERP_FACTOR = 0.05
const CAMERA_TARGET = new THREE.Vector3(0, 2, 0)

export function CameraRig() {
  const { camera, mouse } = useThree()
  const targetRotation = useRef({ x: 0, y: 0 })

  useFrame(() => {
    // Calculate target rotation based on mouse position
    targetRotation.current.x = -mouse.y * MAX_TILT
    targetRotation.current.y = -mouse.x * MAX_TILT

    // Smoothly interpolate current rotation towards target
    camera.rotation.x = THREE.MathUtils.lerp(
      camera.rotation.x,
      targetRotation.current.x,
      LERP_FACTOR
    )
    camera.rotation.y = THREE.MathUtils.lerp(
      camera.rotation.y,
      targetRotation.current.y,
      LERP_FACTOR
    )

    // Ensure camera looks at the target
    const currentLookAt = new THREE.Vector3()
    camera.getWorldDirection(currentLookAt)
    currentLookAt.add(camera.position)

    // Apply slight offset based on rotation
    const offsetTarget = CAMERA_TARGET.clone()
    offsetTarget.x += mouse.x * 0.5
    offsetTarget.y += mouse.y * 0.3

    camera.lookAt(offsetTarget)
  })

  return null
}
