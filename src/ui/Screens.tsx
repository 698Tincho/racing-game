import { useEffect } from 'react'
import { ATTEMPTS, bestOf, formatDelta, formatTime, useGame } from '../game/race/store'

/**
 * Menu, the between-laps screen in qualy, and results.
 * Keys: Enter = start qualy / next attempt, P = practice, G = ghost on/off, Esc = menu.
 */
export function Screens() {
  const phase = useGame((s) => s.phase)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const { phase, startQualy, startPractice, advance, backToMenu } = useGame.getState()
      const confirm = e.code === 'Enter' || e.code === 'Space'
      if (phase === 'menu' || phase === 'results') {
        if (confirm) {
          e.preventDefault()
          startQualy()
        } else if (e.code === 'KeyP') startPractice()
      } else if (phase === 'finished' && confirm) {
        e.preventDefault()
        advance()
      }
      if (e.code === 'Escape' && phase !== 'menu') backToMenu()
      if (e.code === 'KeyG') useGame.getState().toggleGhost()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (phase === 'menu') return <Menu />
  if (phase === 'finished') return <BetweenLaps />
  if (phase === 'results') return <Results />
  return null
}

function Menu() {
  const personalBest = useGame((s) => s.personalBest)
  const startQualy = useGame((s) => s.startQualy)
  const startPractice = useGame((s) => s.startPractice)
  return (
    <div className="screen screen-dim">
      <div className="card">
        <p className="eyebrow">Kart hall · time trial</p>
        <h1>Kart Race</h1>
        <div className="modes">
          <button className="mode" onClick={startPractice}>
            <span className="mode-name">
              Practice <kbd>P</kbd>
            </span>
            <span className="mode-info">Unlimited laps to learn the track. Times aren't saved.</span>
          </button>
          <button className="mode mode-primary" onClick={startQualy}>
            <span className="mode-name">
              Start qualy <kbd>Enter</kbd>
            </span>
            <span className="mode-info">{ATTEMPTS} timed attempts from pole. Your best one counts.</span>
          </button>
        </div>
        <p className="record">
          Track record <strong>{formatTime(personalBest)}</strong>
        </p>
        <p className="controls">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> or arrows to drive · <kbd>R</kbd> back on track
        </p>
      </div>
    </div>
  )
}

/** Qualy: shown after each attempt until the player presses Enter. */
function BetweenLaps() {
  const attempts = useGame((s) => s.attempts)
  const previousBest = useGame((s) => s.previousBest)
  const advance = useGame((s) => s.advance)

  const done = attempts.length
  const time = attempts[done - 1]
  const bestBefore = bestOf(attempts.slice(0, -1))
  const delta = bestBefore !== null ? time - bestBefore : null
  // A record only if it beats the old record *and* this session's earlier attempts.
  const isRecord = (previousBest === null || time < previousBest) && (bestBefore === null || time < bestBefore)
  const last = done >= ATTEMPTS

  return (
    <div className="screen">
      <div className="banner banner-wait">
        <p className="eyebrow">
          Attempt {done} of {ATTEMPTS}
        </p>
        <p className="banner-time">{formatTime(time)}</p>
        {isRecord ? (
          <p className="tag tag-gold">New record!</p>
        ) : delta !== null ? (
          <p className={`tag ${delta < 0 ? 'tag-good' : 'tag-bad'}`}>{formatDelta(delta)}</p>
        ) : null}
        <button className="cta banner-cta" onClick={advance}>
          {last ? 'See results' : `Start attempt ${done + 1}`} <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  )
}

function Results() {
  const attempts = useGame((s) => s.attempts)
  const personalBest = useGame((s) => s.personalBest)
  const previousBest = useGame((s) => s.previousBest)
  const startQualy = useGame((s) => s.startQualy)
  const menu = useGame((s) => s.backToMenu)

  const best = bestOf(attempts)
  const isRecord = best !== null && (previousBest === null || best < previousBest)

  return (
    <div className="screen screen-dim">
      <div className="card">
        <p className="eyebrow">Qualifying results</p>
        <h1 className="results-time">{formatTime(best)}</h1>
        {isRecord && <p className="tag tag-gold">New record!</p>}

        <ol className="laps">
          {attempts.map((t, i) => (
            <li key={i} className={t === best ? 'lap-best' : ''}>
              <span>Attempt {i + 1}</span>
              <span>{formatTime(t)}</span>
            </li>
          ))}
        </ol>

        <p className="record">
          Track record <strong>{formatTime(personalBest)}</strong>
        </p>
        <div className="actions">
          <button className="cta" onClick={startQualy}>
            Qualy again <kbd>Enter</kbd>
          </button>
          <button className="ghost" onClick={menu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
