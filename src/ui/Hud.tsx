import { useEffect, useRef } from 'react'
import { ATTEMPTS, SECTORS, bestOf, formatDelta, formatTime, race, useGame, type SectorTime } from '../game/race/store'
import { Key, WasdKeys } from './Key'
import { Speedometer } from './Speedometer'
import { kartState } from '../game/kartState'
import { PIT_SPEED } from '../game/track/pitLane'

const LAP_POPUP_SECONDS = 3
const HELP_SECONDS = 4 // how long the controls stay up after the start
const PIT_LIMIT_KMH = Math.round(PIT_SPEED * 3.6)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * In-race overlay. Things that change every frame (timer, speed, countdown,
 * lap pop-up) are written straight to the DOM from a
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
  const helpRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = ''
    const tick = () => {
      const { phase, mode, attempts } = useGame.getState()
      if (timerRef.current) timerRef.current.textContent = phase === 'outlap' ? 'Out lap' : formatTime(race.time)

      // Pit limiter, and what to do on a qualifying out-lap.
      if (statusRef.current) {
        const status = kartState.limiter
          ? `Pit limiter ${PIT_LIMIT_KMH} km/h`
          : phase === 'outlap'
            ? race.leftPits
              ? 'Out lap: your timed lap starts at the line'
              : 'Drive out of the pits'
            : ''
        if (statusRef.current.textContent !== status) statusRef.current.textContent = status
        statusRef.current.style.opacity = status ? '1' : '0'
        statusRef.current.classList.toggle('is-limiter', kartState.limiter)
      }
      if (wrongRef.current) wrongRef.current.style.opacity = phase === 'racing' && race.wrongWay ? '1' : '0'
      if (popupRef.current) {
        const visible = phase === 'racing' && race.sinceLap < LAP_POPUP_SECONDS
        popupRef.current.style.opacity = visible ? '1' : '0'
        popupRef.current.style.transform = `translateX(-50%) translateY(${visible ? 0 : -8}px)`
      }

      // The controls show at the start of a session, then get out of the way.
      if (helpRef.current) {
        const firstRun = mode === 'practice' || attempts.length === 0
        const starting =
          phase === 'countdown' ||
          (phase === 'outlap' && !race.leftPits) ||
          (phase === 'racing' && mode === 'practice' && race.sinceLap === Infinity && race.time < HELP_SECONDS)
        helpRef.current.classList.toggle('is-hidden', !(firstRun && starting))
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
        if (text && !reducedMotion()) {
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

  const inRace = phase === 'countdown' || phase === 'outlap' || phase === 'racing'
  const practice = mode === 'practice'
  const laps = practice ? practiceLaps : attempts
  const best = bestOf(laps)
  const lap = Math.min(attempts.length + 1, ATTEMPTS)

  // Pop-up: the lap just completed and how it compares to the best before it.
  const last = laps.at(-1) ?? null
  const bestBefore = bestOf(laps.slice(0, -1))
  const delta = last !== null && bestBefore !== null ? last - bestBefore : null

  return (
    <div className="hud" style={{ opacity: inRace ? 1 : 0 }}>
      <div className="hud-tower">
        <div className="hud-tower-head">
          <span>
            {practice ? `Practice lap ${practiceLaps.length + 1}` : phase === 'outlap' ? 'Qualifying · out lap' : `Qualifying · lap ${lap} of ${ATTEMPTS}`}
          </span>
          <span className="hud-ghost">
            <Key>G</Key> Ghost {showGhost ? 'on' : 'off'}
          </span>
        </div>
        <div className="hud-timer" ref={timerRef}>
          0:00.000
        </div>
        <SectorStrip sectors={sectors} lastSectors={lastSectors} />
        <dl className="hud-times">
          <div>
            <dt>Last</dt>
            <dd>{formatTime(lastLapTime)}</dd>
          </div>
          <div>
            <dt>Best</dt>
            <dd>{formatTime(best)}</dd>
          </div>
          <div>
            <dt>Browser</dt>
            <dd>{formatTime(personalBest)}</dd>
          </div>
        </dl>
      </div>

      <div className="hud-popup" ref={popupRef}>
        <span>{formatTime(last)}</span>
        {delta !== null && <span className={`tag ${delta < 0 ? 'tag-good' : 'tag-bad'}`}>{formatDelta(delta)}</span>}
        {last !== null && delta === null && <span className="tag tag-gold">First lap</span>}
      </div>

      <div className="hud-countdown" ref={countRef} />
      <div className="hud-status" ref={statusRef} />
      <div className="hud-wrong" ref={wrongRef}>
        Wrong way
      </div>

      <Speedometer />
      <div className="hud-help is-hidden" ref={helpRef}>
        <span>
          <WasdKeys /> Drive
        </span>
        <span>
          <Key>R</Key> Back on track
        </span>
        <span>
          <Key>Esc</Key> {practice ? 'End practice' : 'Menu'}
        </span>
      </div>
    </div>
  )
}

/**
 * S1 / S2 / S3, like a timing screen. While a lap is running, finished sectors
 * show this lap's times; the rest still show the last lap's, dimmed, so you
 * can compare as you go.
 */
function SectorStrip({ sectors, lastSectors }: { sectors: SectorTime[]; lastSectors: SectorTime[] }) {
  return (
    <div className="hud-sectors">
      {Array.from({ length: SECTORS }, (_, i) => {
        const now = sectors[i]
        const before = lastSectors[i]
        return (
          <div key={i} className={`hud-sector ${now ? `sector-${now.status}` : 'sector-old'}`}>
            <small>S{i + 1}</small>
            <span>{now ? now.time.toFixed(3) : before ? before.time.toFixed(3) : '--.---'}</span>
          </div>
        )
      })}
    </div>
  )
}
