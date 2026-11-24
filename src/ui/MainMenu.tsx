import type { AnimationEvent, MouseEvent } from 'react'
import { CARS, carPreviewUrl } from '../game/cars'
import { ATTEMPTS, formatTime, useGame } from '../game/race/store'
import { showcaseSlot } from './CarShowcase'
import { Key, WasdKeys } from './Key'

// The pictures in the car picker, fetched while the game loads so the menu shows them straight away.
for (const car of CARS) new Image().src = carPreviewUrl(car.id)

const pointShowcaseHere = (element: HTMLDivElement | null) => {
  showcaseSlot.element = element
}

// After a mouse click, keep focus off the button so Enter still starts qualy.
const keepFocus = (e: MouseEvent) => e.preventDefault()

/** The title screen: race modes on a slanted panel, your car on a turntable beside it. */
export function MainMenu() {
  const personalBest = useGame((s) => s.personalBest)
  const startQualy = useGame((s) => s.startQualy)
  const startPractice = useGame((s) => s.startPractice)
  const setViewing = useGame((s) => s.setViewing)
  const viewTrack = useGame((s) => s.viewTrack)
  const leaving = useGame((s) => s.leavingMenu)
  // Once the panel has slid out (the car leaves at the same pace), show the track.
  const onPanelGone = (e: AnimationEvent) => {
    if (e.target === e.currentTarget && e.animationName === 'menu-leave-left') setViewing(true)
  }

  return (
    <div className={`menu ${leaving ? 'is-leaving' : ''}`} inert={leaving || undefined}>
      <section className="menu-panel" onAnimationEnd={onPanelGone}>
        <SlashEdge />
        <div className="menu-content">
          <header className="menu-head">
            <h1 className="menu-title">
              <span>Fastest</span> <span>Lap</span>
            </h1>
            {/* Your record, as the "fastest lap" caption on a race broadcast. */}
            <p className="menu-record">
              <span className="menu-record-chip">Track record</span>
              {personalBest === null ? (
                <span className="menu-record-empty">No time yet. Set one in qualifying.</span>
              ) : (
                <strong className="menu-record-time">{formatTime(personalBest)}</strong>
              )}
            </p>
          </header>

          <div className="menu-actions">
            <button className="menu-action menu-action-start" onMouseDown={keepFocus} onClick={startQualy}>
              <span className="menu-action-text">
                <strong>Start qualy</strong>
                <small>{ATTEMPTS} flying laps from your pit box. Your best one counts.</small>
              </span>
              <Key>Enter</Key>
            </button>
            <button className="menu-action" onMouseDown={keepFocus} onClick={startPractice}>
              <span className="menu-action-text">
                <strong>Practice</strong>
                <small>Unlimited laps. Times aren't saved.</small>
              </span>
              <Key>P</Key>
            </button>
          </div>

          <nav className="menu-links" aria-label="More">
            <button className="menu-link" onMouseDown={keepFocus} onClick={viewTrack}>
              View the track <Key>V</Key>
            </button>
            <a className="menu-link" href="?garage">
              Open the garage
            </a>
          </nav>
        </div>

        <footer className="menu-help">
            <span className="menu-help-item">
              <WasdKeys />
              <span>Drive, or use the arrow keys</span>
            </span>
            <span className="menu-help-item">
              <Key>R</Key>
              <span>Back on track</span>
            </span>
        </footer>
      </section>

      <section className="menu-stage" aria-label="Your car">
        {/* The main canvas draws your car on its turntable into this box (see CarShowcase). */}
        <div className="menu-showcase" ref={pointShowcaseHere} />
        <CarGrid />
      </section>
    </div>
  )
}

/** The panel's edge: a slanted cut, with a red stripe running along it. */
function SlashEdge() {
  return (
    <svg className="menu-edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <path className="menu-edge-fill" d="M0,0 H96 L84,100 H0 Z" />
      <path className="menu-edge-stripe" d="M96,0 H99.5 L87.5,100 H84 Z" />
    </svg>
  )
}

/** Pick a car from staggered boxes, like a starting grid. */
function CarGrid() {
  const carId = useGame((s) => s.carId)
  const setCar = useGame((s) => s.setCar)
  const selected = CARS.find((car) => car.id === carId) ?? CARS[0]
  return (
    <div className="menu-garage">
      <p className="menu-car-name" aria-live="polite">
        {selected.name}
      </p>
      <div className="menu-grid" role="radiogroup" aria-label="Choose your car">
        {CARS.map((car, i) => (
          <button
            key={car.id}
            className={`menu-slot ${car.id === carId ? 'is-on' : ''}`}
            role="radio"
            aria-checked={car.id === carId}
            aria-label={car.name}
            onMouseDown={keepFocus}
            onClick={() => setCar(car.id)}
          >
            <img src={carPreviewUrl(car.id)} alt="" width={64} height={64} />
            <Key>{i + 1}</Key>
          </button>
        ))}
      </div>
      <p className="menu-car-note">Every car drives the same, so lap times stay fair.</p>
    </div>
  )
}
