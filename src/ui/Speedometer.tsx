import { useEffect, useRef } from 'react'
import { kartState } from '../game/kartState'
import { TUNING as T } from '../game/tuning'

const MAX_KMH = Math.ceil((T.maxSpeed * 3.6) / 10) * 10
const BLOCKS = 20
const START = 150 // degrees, where 0 km/h sits (SVG angles: 0 = right, clockwise)
const SWEEP = 240
const BLOCK_GAP = 2.4 // degrees between blocks
const RADIUS = 74
/** The top of the range, where the gauge turns red. */
const RED_BLOCKS = 4

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return [90 + Math.cos(a) * r, 90 + Math.sin(a) * r]
}

const blockPath = (i: number) => {
  const step = SWEEP / BLOCKS
  const [sx, sy] = polar(START + i * step + BLOCK_GAP / 2, RADIUS)
  const [ex, ey] = polar(START + (i + 1) * step - BLOCK_GAP / 2, RADIUS)
  return `M ${sx} ${sy} A ${RADIUS} ${RADIUS} 0 0 1 ${ex} ${ey}`
}

/** Speed as a segmented gauge, white rising to red near the top. Updated straight from the frame loop. */
export function Speedometer() {
  const blocks = useRef<(SVGPathElement | null)[]>([])
  const value = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let shownSpeed = -1
    let shownBlocks = -1
    const tick = () => {
      const kmh = Math.abs(kartState.speed) * 3.6
      const lit = Math.round(Math.min(kmh / MAX_KMH, 1) * BLOCKS)
      if (lit !== shownBlocks) {
        shownBlocks = lit
        blocks.current.forEach((block, i) => block?.classList.toggle('is-lit', i < lit))
      }
      const rounded = Math.round(kmh)
      if (value.current && rounded !== shownSpeed) {
        shownSpeed = rounded
        value.current.textContent = String(rounded)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="speedo">
      <svg viewBox="0 0 180 180" aria-hidden>
        <circle cx="90" cy="90" r="88" className="speedo-disc" />
        {Array.from({ length: BLOCKS }, (_, i) => (
          <path
            key={i}
            ref={(el) => {
              blocks.current[i] = el
            }}
            d={blockPath(i)}
            className={`speedo-block ${i >= BLOCKS - RED_BLOCKS ? 'is-red' : ''}`}
          />
        ))}
      </svg>
      <div className="speedo-readout">
        <span ref={value}>0</span>
        <small>km/h</small>
      </div>
    </div>
  )
}
