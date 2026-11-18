import { useEffect, useRef } from 'react'
import { kartState } from '../game/kartState'
import { ATTEMPTS, formatTime, race, sessionBest, useGame } from '../game/race/store'

/**
 * In-race overlay. Things that change every frame (timer, speed, countdown)
 * are written straight to the DOM from a requestAnimationFrame loop; things
 * that change once in a while (lap number, best times) come from zustand.
 */
export function Hud() {
  const phase = useGame((s) => s.phase)
  const lap = useGame((s) => s.lap)
  const attempts = useGame((s) => s.attempts)
  const personalBest = useGame((s) => s.personalBest)

  const timerRef = useRef<HTMLDivElement>(null)
  const speedRef = useRef<HTMLSpanElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const wrongRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = ''
    const tick = () => {
      const { phase } = useGame.getState()
      if (timerRef.current) timerRef.current.textContent = formatTime(race.time)
      if (speedRef.current) speedRef.current.textContent = String(Math.round(Math.abs(kartState.speed) * 3.6))
      if (wrongRef.current) wrongRef.current.style.opacity = phase === 'racing' && race.wrongWay ? '1' : '0'

      // 3 / 2 / 1 / GO! — pop each number in as it changes.
      let text = ''
      if (phase === 'countdown') text = String(Math.ceil(race.countdown))
      else if (phase === 'racing' && race.time < 0.8) text = 'GO!'
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
  const best = sessionBest(attempts)

  return (
    <div className="hud" style={{ opacity: inRace ? 1 : 0 }}>
      <div className="hud-top">
        <div className="hud-lap">
          <span className="hud-label">{lap === 0 ? 'Practice lap' : 'Attempt'}</span>
          {lap > 0 && (
            <span className="hud-lap-count">
              {lap}
              <small>/{ATTEMPTS}</small>
            </span>
          )}
        </div>

        <div className="hud-timer" ref={timerRef}>
          0:00.000
        </div>

        <div className="hud-bests">
          <div>
            <span className="hud-label">Best</span>
            <span>{formatTime(best)}</span>
          </div>
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

      <div className="hud-speed">
        <span ref={speedRef}>0</span>
        <small>km/h</small>
      </div>
      <div className="hud-help">
        <kbd>W</kbd>
        <kbd>A</kbd>
        <kbd>S</kbd>
        <kbd>D</kbd> drive · <kbd>R</kbd> back on track · <kbd>Esc</kbd> menu
      </div>
    </div>
  )
}
