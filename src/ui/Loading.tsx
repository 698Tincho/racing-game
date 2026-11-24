import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { finishLoading, useLoading } from '../game/loading'
import { GANTRY_PODS, gantryMarkup } from './gantry'

const GANTRY = { __html: gantryMarkup() }

/** How much of the bar is the files downloading; the rest is the world being set up. */
const DOWNLOAD_SHARE = 0.35
/** With everything in, all five lights hold for a random moment before they go out, like a real start. */
const HOLD_MS = [350, 1100]
/** Then the screen fades out this fast (matches .loading in the CSS). */
const FADE_MS = 520
/** If something never arrives, don't keep the player waiting past this. */
const GIVE_UP_MS = 20000

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** How far along loading is, 0..1: the files, then each part of the world. */
function progressNow() {
  const { loaded, total } = useProgress.getState()
  const { steps, done } = useLoading.getState()
  const files = total > 0 ? loaded / total : 0
  const parts = steps.length > 0 ? done.length / steps.length : 0
  return DOWNLOAD_SHARE * files + (1 - DOWNLOAD_SHARE) * parts
}

/**
 * The loading screen: a start gantry whose five red lights come on one by
 * one as the game loads, hold for a random moment, then all go out, like the
 * start of a race, and the menu shows.
 */
export function Loading() {
  const [stage, setStage] = useState<'loading' | 'lit' | 'out' | 'gone'>('loading')
  const [status, setStatus] = useState('Loading')
  const gantry = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)

  /** Lights the first `count` units (each is drawn twice: lamps, and glow on top). */
  const light = (count: number) =>
    gantry.current?.querySelectorAll<SVGGElement>('[data-pod]').forEach((unit) => {
      unit.classList.toggle('is-on', Number(unit.dataset.pod) < count)
    })

  // Follow the progress every frame, without re-rendering for it.
  useEffect(() => {
    if (stage !== 'loading') return
    let shown = 0
    let frame = 0
    const started = performance.now()
    const tick = () => {
      const { steps, done } = useLoading.getState()
      const target = progressNow()
      // Glide towards it, never backwards.
      shown = Math.max(shown, reducedMotion() ? target : shown + (target - shown) * 0.12)
      light(Math.floor(shown * GANTRY_PODS + 0.02))
      if (fill.current) fill.current.style.width = `${(shown * 100).toFixed(1)}%`
      bar.current?.setAttribute('aria-valuenow', String(Math.round(shown * 100)))
      const next = steps.find((s) => !done.includes(s.id))
      setStatus(next?.label ?? 'Ready')

      const allIn = steps.length > 0 && done.length >= steps.length
      if (allIn || performance.now() - started > GIVE_UP_MS) {
        // One more frame so the last part has been drawn once, then all lights on.
        frame = requestAnimationFrame(() => setStage('lit'))
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [stage])

  // All on, hold, lights out: show the menu as the screen fades.
  useEffect(() => {
    if (stage === 'lit') {
      light(GANTRY_PODS)
      if (fill.current) fill.current.style.width = '100%'
      const hold = HOLD_MS[0] + Math.random() * (HOLD_MS[1] - HOLD_MS[0])
      const timer = setTimeout(() => setStage('out'), reducedMotion() ? 0 : hold)
      return () => clearTimeout(timer)
    }
    if (stage === 'out') {
      light(0)
      performance.mark('lights-out') // (handy for checking load times)
      finishLoading()
      const timer = setTimeout(() => setStage('gone'), reducedMotion() ? 0 : FADE_MS)
      return () => clearTimeout(timer)
    }
  }, [stage])

  if (stage === 'gone') return null
  return (
    <div className={`loading ${stage === 'out' ? 'is-out' : ''}`} aria-busy={stage === 'loading'}>
      <div className="loading-inner">
        {/* The same drawing index.html shows before this code runs. */}
        <div className="gantry" ref={gantry} dangerouslySetInnerHTML={GANTRY} />
        <div className="loading-line" ref={bar} role="progressbar" aria-label="Loading the game" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
          <div className="loading-line-fill" ref={fill} />
        </div>
        <p className="loading-status" aria-live="polite">
          {stage === 'loading' ? status : stage === 'lit' ? 'Ready' : 'Lights out'}
        </p>
      </div>
    </div>
  )
}
