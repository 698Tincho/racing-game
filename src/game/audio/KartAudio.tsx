import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { tyreScrub } from '../effects/scrub'
import { kartState } from '../kartState'
import { useGame } from '../race/store'
import { TUNING as T } from '../tuning'
import { playImpact, setEngine, setSkid, syncSoundToTab, unlockSound } from './sound'

const { clamp, mapLinear } = THREE.MathUtils
const decibels = (db: number) => 10 ** (db / 20)

const IMPACT_MIN_RISE = 0.08 // ignore tiny changes in kartState.impact
const IMPACT_COOLDOWN = 0.22 // seconds, so scraping a wall doesn't machine-gun

/** Drives the engine, skid and impact sounds from the kart. Renders nothing. */
export function KartAudio() {
  const lastImpact = useRef(0)
  const lastImpactAt = useRef(-Infinity)

  useEffect(() => {
    const unlock = () => void unlockSound()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    document.addEventListener('visibilitychange', syncSoundToTab)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      document.removeEventListener('visibilitychange', syncSoundToTab)
    }
  }, [])

  useFrame((state) => {
    const { phase, viewing } = useGame.getState()
    const onTrack = !viewing && (phase === 'countdown' || phase === 'outlap' || phase === 'racing')

    const speed = clamp(Math.abs(kartState.speed) / T.maxSpeed, 0, 1)
    const throttle = Math.abs(kartState.throttle)
    const engineDb = mapLinear(speed + throttle * 0.5, 0, 1.5, -15, -5)
    setEngine(onTrack ? decibels(engineDb) : 0, 0.55 + speed * 2.05 + (throttle > 0 ? 0.15 : 0))

    // Tyres squeal on tarmac. Off the road they only throw dust.
    const onTarmac = kartState.surface !== 'grass' && kartState.surface !== 'gravel'
    const slide = onTrack && onTarmac ? Math.max(tyreScrub(), kartState.launch * 0.6) : 0
    setSkid(slide > 0.01 ? decibels(mapLinear(slide, 0, 1, -16, -5)) : 0, 0.9 + speed * 0.5)

    const impact = kartState.impact
    const now = state.clock.elapsedTime
    if (onTrack && impact - lastImpact.current > IMPACT_MIN_RISE && now - lastImpactAt.current > IMPACT_COOLDOWN) {
      lastImpactAt.current = now
      playImpact(decibels(mapLinear(impact, 0, 1, -16, 0)))
    }
    lastImpact.current = impact
  })

  return null
}
