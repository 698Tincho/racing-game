import * as THREE from 'three'

let texture: THREE.CanvasTexture | null = null

/** A soft round glow, shared by lamp halos and the pools of light on the road. */
export function glowTexture() {
  if (texture) return texture
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.14)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
