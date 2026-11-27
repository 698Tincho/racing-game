import { useEffect } from 'react'
import { bestOf, formatDelta, formatTime, useGame } from '../game/race/store'
import { playUiSound } from '../game/audio/sound'
import { CARS } from '../game/cars'
import { MainMenu, nextCar } from './MainMenu'
import { Loading } from './Loading'
import { useLoading } from '../game/loading'
import { useBoard } from '../game/race/leaderboard'
import { OnlineBoard } from './OnlineBoard'

/**
 * Menu, and the qualifying results.
 * Keys: Enter = start qualy (or try again from the results), P = practice, 1-3 or ← → = car,
 * V = view the track, G = ghost on/off, Esc = menu (or stop viewing).
 */
export function Screens() {
  const phase = useGame((s) => s.phase)
  const viewing = useGame((s) => s.viewing)
  const loaded = useLoading((s) => s.finished)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !useLoading.getState().finished) return
      // Typing a nickname: the keys are for the field, not the game.
      if ((e.target as HTMLElement).closest?.('input, textarea')) return
      const { phase, viewing, startQualy, startPractice, backToMenu, setViewing } = useGame.getState()
      const confirm = e.code === 'Enter' || e.code === 'Space'
      // Tabbed onto a menu or results button: let Enter or Space activate that one.
      if ((phase === 'menu' || phase === 'results') && confirm && (e.target as HTMLElement).closest?.('button, a')) return
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
      if ((phase === 'menu' || phase === 'results') && confirm) {
        e.preventDefault()
        startQualy()
      } else if (phase === 'menu' && e.code === 'KeyP') startPractice()
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

/** Qualy: after the last timed lap. Your best lap counts; try again, or back to the menu. */
function Results() {
  const attempts = useGame((s) => s.attempts)
  const attemptSectors = useGame((s) => s.attemptSectors)
  const previousBest = useGame((s) => s.previousBest)
  const startQualy = useGame((s) => s.startQualy)
  const menu = useGame((s) => s.backToMenu)
  // Side by side with the online board, unless it can't be reached.
  const online = useBoard((s) => s.status !== 'offline')

  const best = bestOf(attempts)
  const bestSectors = best === null ? null : (attemptSectors[attempts.indexOf(best)] ?? null)
  const isRecord = best !== null && (previousBest === null || best < previousBest)
  // How far this run's best was from the record you had going in: under it (a new record) or off it.
  const gap = best !== null && previousBest !== null ? best - previousBest : null

  return (
    <div className="screen screen-dim">
      <div className={`card ${online ? 'card-results' : ''}`} role="dialog" aria-label="Qualifying results">
        <section className="results-run">
          <p className="eyebrow">Qualifying results</p>
          <h1 className="results-time">{formatTime(best)}</h1>
          <p className="results-verdict">
            {isRecord ? (
              <>
                <span className="tag tag-gold">New record</span>
                {gap === null ? (
                  <span>Your first record on this track.</span>
                ) : (
                  <span>
                    <strong>{formatDelta(gap)}</strong> under your old record of {formatTime(previousBest)}
                  </span>
                )}
              </>
            ) : gap !== null ? (
              <>
                <span className="tag tag-bad">{formatDelta(gap)}</span>
                <span>
                  off your record of <strong>{formatTime(previousBest)}</strong>
                </span>
              </>
            ) : null}
          </p>

          <ol className="laps">
            {attempts.map((t, i) => (
              <li key={i} className={t === best ? 'lap-best' : ''}>
                <span>Lap {i + 1}</span>
                <span>{formatTime(t)}</span>
              </li>
            ))}
          </ol>

          <div className="actions">
            <button className="cta" onClick={startQualy}>
              Try again <kbd>Enter</kbd>
            </button>
            <button className="ghost" onClick={menu}>
              Back to menu <kbd>Esc</kbd>
            </button>
          </div>
        </section>
        <OnlineBoard best={best} sectors={bestSectors} />
      </div>
    </div>
  )
}
