import { useEffect, useRef } from 'react'
import { ATTEMPTS, SECTORS, bestOf, formatDelta, formatTime, race, useGame, type SectorTime } from '../game/race/store'
import { Speedometer } from './Speedometer'

const LAP_POPUP_SECONDS = 3

/**
 * In-race overlay. Things that change every frame (timer, speed, countdown,
 * practice lap pop-up) are written straight to the DOM from a
 * requestAnimationFrame loop; things that change once in a while (lap count,
 * best times) come from zustand.
 */
export function Hud() {
  const mode = useGame((s) => s.mode)
  const phase = useGame((s) => s.phase)
  const attempts = useGame((s) => s.attempts)
  const practiceLaps = useGame((s) => s.practiceLaps)
  const personalBest = useGame((s) => s.personalBest)
  const sectors = useGame((s) => s.sectors)
  const lastSectors = useGame((s) => s.lastSectors)
  const lastLapTime = useGame((s) => s.lastLapTime)
  const showGhost = useGame((s) => s.showGhost)

  const timerRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const wrongRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = ''
    const tick = () => {
      const { phase } = useGame.getState()
      if (timerRef.current) timerRef.current.textContent = formatTime(race.time)
      if (wrongRef.current) wrongRef.current.style.opacity = phase === 'racing' && race.wrongWay ? '1' : '0'
      if (popupRef.current) {
        const visible = phase === 'racing' && race.sinceLap < LAP_POPUP_SECONDS
        popupRef.current.style.opacity = visible ? '1' : '0'
        popupRef.current.style.transform = `translateX(-50%) translateY(${visible ? 0 : -8}px)`
      }

      // 3 / 2 / 1 / GO! — pop each number in as it changes.
      let text = ''
      if (phase === 'countdown') text = String(Math.ceil(race.countdown))
      else if (phase === 'racing' && race.time < 0.8 && race.sinceLap === Infinity) text = 'GO!'
      const el = countRef.current
      if (el && text !== shown) {
        shown = text
        el.textContent = text
        el.classList.toggle('is-go', text === 'GO!')
        if (text) {
          el.animate(
            [
              { transform: 'scale(1.8)', opacity: 0 },
              { transform: 'scale(1)', opacity: 1, offset: 0.35 },
              { transform: 'scale(1)', opacity: 1 },
            ],
            { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' },
          )
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const inRace = phase === 'countdown' || phase === 'racing' || phase === 'finished'
  const practice = mode === 'practice'
  const laps = practice ? practiceLaps : attempts
  const best = bestOf(laps)

  // Practice pop-up: the lap just completed and how it compares to the best before it.
  const last = practiceLaps.at(-1) ?? null
  const bestBefore = bestOf(practiceLaps.slice(0, -1))
  const delta = last !== null && bestBefore !== null ? last - bestBefore : null

  return (
    <div className="hud" style={{ opacity: inRace ? 1 : 0 }}>
      <div className="hud-top">
        <div className="hud-lap">
          <span className="hud-label">{practice ? 'Practice · lap' : 'Qualifying · attempt'}</span>
          <span className="hud-lap-count">
            {/* While waiting after a qualy lap, keep showing the attempt just done. */}
            {practice ? practiceLaps.length + 1 : phase === 'finished' ? attempts.length : Math.min(attempts.length + 1, ATTEMPTS)}
            {!practice && <small>/{ATTEMPTS}</small>}
          </span>
        </div>

        <div className="hud-center">
          <div className="hud-timer" ref={timerRef}>
            0:00.000
          </div>
          <SectorPanel sectors={sectors} lastSectors={lastSectors} last={lastLapTime} best={best} />
          <div className="hud-popup" ref={popupRef}>
            <span>{formatTime(last)}</span>
            {delta !== null && <span className={`tag ${delta < 0 ? 'tag-good' : 'tag-bad'}`}>{formatDelta(delta)}</span>}
            {last !== null && delta === null && <span className="tag tag-gold">First lap</span>}
          </div>
        </div>

        <div className="hud-bests">
          <div>
            <span className="hud-label">Record</span>
            <span>{formatTime(personalBest)}</span>
          </div>
        </div>
      </div>

      <div className="hud-countdown" ref={countRef} />
      <div className="hud-wrong" ref={wrongRef}>
        Wrong way!
      </div>

      <Speedometer />
      <div className="hud-help">
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> drive · <kbd>R</kbd> back on track · <kbd>G</kbd> ghost {showGhost ? 'on' : 'off'} · <kbd>Esc</kbd> {practice ? 'end practice' : 'menu'}
      </div>
    </div>
  )
}

/**
 * S1 / S2 / S3 / LAST / BEST, like a timing screen. While a lap is running,
 * finished sectors show this lap's times; the rest still show the last lap's,
 * dimmed, so you can compare as you go.
 */
function SectorPanel({
  sectors,
  lastSectors,
  last,
  best,
}: {
  sectors: SectorTime[]
  lastSectors: SectorTime[]
  last: number | null
  best: number | null
}) {
  const cells = Array.from({ length: SECTORS }, (_, i) => {
    const now = sectors[i]
    if (now) return { text: now.time.toFixed(3), className: `sector-${now.status}` }
    const before = lastSectors[i]
    return before ? { text: before.time.toFixed(3), className: 'sector-old' } : { text: '--.---', className: 'sector-old' }
  })
  return (
    <div className="sectors">
      {cells.map((c, i) => (
        <div key={i}>
          <span className="hud-label">S{i + 1}</span>
          <span className={c.className}>{c.text}</span>
        </div>
      ))}
      <div>
        <span className="hud-label">Last</span>
        <span>{formatTime(last)}</span>
      </div>
      <div>
        <span className="hud-label">Best</span>
        <span>{formatTime(best)}</span>
      </div>
    </div>
  )
}
