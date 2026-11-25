import { useEffect } from 'react'
import { ATTEMPTS, bestOf, formatDelta, formatTime, useGame } from '../game/race/store'
import { playUiSound } from '../game/audio/sound'
import { CARS } from '../game/cars'
import { MainMenu, nextCar } from './MainMenu'
import { Loading } from './Loading'
import { useLoading } from '../game/loading'

/**
 * Menu, the between-laps screen in qualy, and results.
 * Keys: Enter = start qualy / next attempt, P = practice, 1-3 or ← → = car, V = view the track,
 * G = ghost on/off, Esc = menu (or stop viewing).
 */
export function Screens() {
  const phase = useGame((s) => s.phase)
  const viewing = useGame((s) => s.viewing)
  const loaded = useLoading((s) => s.finished)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !useLoading.getState().finished) return
      const { phase, viewing, startQualy, startPractice, advance, backToMenu, setViewing } = useGame.getState()
      const confirm = e.code === 'Enter' || e.code === 'Space'
      // Tabbed onto a menu control: let Enter or Space activate that one.
      if (phase === 'menu' && confirm && (e.target as HTMLElement).closest?.('button, a')) return
      if (viewing) {
        if (e.code === 'Escape' || e.code === 'KeyV') setViewing(false)
        return
      }
      if (phase === 'menu' && e.code === 'KeyV') {
        useGame.getState().viewTrack()
        return
      }
      if (phase === 'menu') {
        const { carId, setCar } = useGame.getState()
        const picked = CARS[Number(e.code.replace('Digit', '')) - 1]
        if (e.code.startsWith('Digit') && picked) setCar(picked.id)
        if (e.code === 'ArrowLeft') setCar(nextCar(carId, -1))
        if (e.code === 'ArrowRight') setCar(nextCar(carId, 1))
      }
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
    // Small sounds for picking a car, starting a race and opening the track view.
    const stopSounds = useGame.subscribe((now, before) => {
      if (now.carId !== before.carId) playUiSound('rotate')
      else if (
        (now.leavingMenu && !before.leavingMenu) ||
        (now.viewing !== before.viewing && !before.leavingMenu) ||
        (before.phase === 'menu' && now.phase === 'countdown')
      )
        playUiSound('toggle')
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      stopSounds()
    }
  }, [])

  return (
    <>
      {loaded && <Screen phase={phase} viewing={viewing} />}
      <Loading />
    </>
  )
}

function Screen({ phase, viewing }: { phase: string; viewing: boolean }) {
  if (viewing) return <Viewing />
  if (phase === 'menu') return <MainMenu />
  if (phase === 'finished') return <BetweenLaps />
  if (phase === 'results') return <Results />
  return null
}

/** The menu hidden, so you can orbit around the whole track. */
function Viewing() {
  const setViewing = useGame((s) => s.setViewing)
  return (
    <div className="viewing">
      <span>Drag to orbit · right-drag to pan · scroll to zoom</span>
      <button className="cta" onClick={() => setViewing(false)}>
        Back to menu <kbd>V</kbd>
      </button>
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
          <p className="tag tag-gold">New record</p>
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
        {isRecord && <p className="tag tag-gold">New record</p>}

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
            Qualify again <kbd>Enter</kbd>
          </button>
          <button className="ghost" onClick={menu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
