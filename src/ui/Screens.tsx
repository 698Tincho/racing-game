import { useEffect } from 'react'
import { ATTEMPTS, formatTime, sessionBest, useGame } from '../game/race/store'

/** Menu, end-of-lap banner and results. Enter/Space continues, Esc goes to the menu. */
export function Screens() {
  const phase = useGame((s) => s.phase)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { phase, startSession, backToMenu } = useGame.getState()
      if ((e.code === 'Enter' || e.code === 'Space') && (phase === 'menu' || phase === 'results')) {
        e.preventDefault()
        startSession()
      }
      if (e.code === 'Escape' && phase !== 'menu') backToMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (phase === 'menu') return <Menu />
  if (phase === 'finished') return <LapBanner />
  if (phase === 'results') return <Results />
  return null
}

function Menu() {
  const personalBest = useGame((s) => s.personalBest)
  const start = useGame((s) => s.startSession)
  return (
    <div className="screen screen-dim">
      <div className="card">
        <p className="eyebrow">Toy track · time trial</p>
        <h1>Kart Race</h1>
        <p className="rules">
          1 practice lap, then {ATTEMPTS} timed attempts.
          <br />
          Your best attempt is your time.
        </p>
        {personalBest !== null && (
          <p className="record">
            Your record <strong>{formatTime(personalBest)}</strong>
          </p>
        )}
        <button className="cta" onClick={start}>
          Start <kbd>Enter</kbd>
        </button>
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

function LapBanner() {
  const lap = useGame((s) => s.lap)
  const time = useGame((s) => s.lastLapTime)
  const attempts = useGame((s) => s.attempts)
  const practice = useGame((s) => s.practiceTime)
  const previousBest = useGame((s) => s.previousBest)

  // Compare against the best lap before this one (practice counts as a reference).
  const earlier = lap === 0 ? [] : [practice, ...attempts.slice(0, -1)].filter((t): t is number => t !== null)
  const reference = earlier.length ? Math.min(...earlier) : null
  const delta = time !== null && reference !== null ? time - reference : null
  const isRecord = lap > 0 && time !== null && (previousBest === null || time < previousBest)

  return (
    <div className="screen">
      <div className="banner">
        <p className="eyebrow">{lap === 0 ? 'Practice done' : `Attempt ${lap} of ${ATTEMPTS}`}</p>
        <p className="banner-time">{formatTime(time)}</p>
        {isRecord ? (
          <p className="tag tag-gold">New record!</p>
        ) : delta !== null ? (
          <p className={`tag ${delta < 0 ? 'tag-good' : 'tag-bad'}`}>
            {delta < 0 ? '−' : '+'}
            {Math.abs(delta).toFixed(3)}
          </p>
        ) : null}
        <p className="banner-next">{lap < ATTEMPTS ? `Get ready for attempt ${lap + 1}` : 'Last one done!'}</p>
      </div>
    </div>
  )
}

function Results() {
  const practice = useGame((s) => s.practiceTime)
  const attempts = useGame((s) => s.attempts)
  const personalBest = useGame((s) => s.personalBest)
  const previousBest = useGame((s) => s.previousBest)
  const start = useGame((s) => s.startSession)
  const menu = useGame((s) => s.backToMenu)

  const best = sessionBest(attempts)
  const isRecord = best !== null && (previousBest === null || best < previousBest)

  return (
    <div className="screen screen-dim">
      <div className="card">
        <p className="eyebrow">Results</p>
        <h1 className="results-time">{formatTime(best)}</h1>
        {isRecord && <p className="tag tag-gold">New record!</p>}

        <ol className="laps">
          <li className="lap-practice">
            <span>Practice</span>
            <span>{formatTime(practice)}</span>
          </li>
          {attempts.map((t, i) => (
            <li key={i} className={t === best ? 'lap-best' : ''}>
              <span>Attempt {i + 1}</span>
              <span>{formatTime(t)}</span>
            </li>
          ))}
        </ol>

        <p className="record">
          Record <strong>{formatTime(personalBest)}</strong>
        </p>
        <div className="actions">
          <button className="cta" onClick={start}>
            Race again <kbd>Enter</kbd>
          </button>
          <button className="ghost" onClick={menu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
