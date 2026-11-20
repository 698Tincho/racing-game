import { useEffect, useRef } from 'react'
import { kartState } from '../game/kartState'

const MAX_KMH = 80
const START = 135 // degrees, where 0 km/h sits (SVG angles: 0 = right, clockwise)
const SWEEP = 270

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return [60 + Math.cos(a) * r, 60 + Math.sin(a) * r]
}

/** Round gauge with a needle, like a kart dash. Updated straight from the frame loop. */
export function Speedometer() {
  const needle = useRef<SVGGElement>(null)
  const value = useRef<HTMLSpanElement>(null)
  const fill = useRef<SVGPathElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = -1
    const arcLength = fill.current?.getTotalLength() ?? 1
    if (fill.current) fill.current.style.strokeDasharray = String(arcLength)
    const tick = () => {
      const kmh = Math.abs(kartState.speed) * 3.6
      const k = Math.min(kmh / MAX_KMH, 1)
      needle.current?.setAttribute('transform', `rotate(${START + k * SWEEP} 60 60)`)
      if (fill.current) fill.current.style.strokeDashoffset = String(arcLength * (1 - k))
      const rounded = Math.round(kmh)
      if (value.current && rounded !== shown) {
        shown = rounded
        value.current.textContent = String(rounded)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const [sx, sy] = polar(START, 50)
  const [ex, ey] = polar(START + SWEEP, 50)
  const arc = `M ${sx} ${sy} A 50 50 0 1 1 ${ex} ${ey}`
  const ticks = Array.from({ length: MAX_KMH / 10 + 1 }, (_, i) => i * 10)

  return (
    <div className="speedo">
      <svg viewBox="0 0 120 120" aria-hidden>
        <path d={arc} className="speedo-track" />
        <path d={arc} className="speedo-fill" ref={fill} />
        {ticks.map((t) => {
          const deg = START + (t / MAX_KMH) * SWEEP
          const [x1, y1] = polar(deg, 43)
          const [x2, y2] = polar(deg, 38)
          const [lx, ly] = polar(deg, 30)
          return (
            <g key={t}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="speedo-tick" />
              {t % 20 === 0 && (
                <text x={lx} y={ly} className="speedo-label">
                  {t}
                </text>
              )}
            </g>
          )
        })}
        <g ref={needle} transform={`rotate(${START} 60 60)`}>
          <line x1="60" y1="60" x2="104" y2="60" className="speedo-needle" />
        </g>
        <circle cx="60" cy="60" r="5" className="speedo-hub" />
      </svg>
      <div className="speedo-readout">
        <span ref={value}>0</span>
        <small>km/h</small>
      </div>
    </div>
  )
}
