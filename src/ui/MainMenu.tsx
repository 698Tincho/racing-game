import type { MouseEvent } from 'react'
import { CARS, carPreviewUrl } from '../game/cars'
import { ATTEMPTS, formatTime, useGame } from '../game/race/store'
import { CarShowcase } from './CarShowcase'
import { Key, WasdKeys } from './Key'

// After a mouse click, keep focus off the button so Enter still starts qualy.
const keepFocus = (e: MouseEvent) => e.preventDefault()

/** The title screen: race modes on a kerbed panel, your car on a turntable beside it. */
export function MainMenu() {
  const personalBest = useGame((s) => s.personalBest)
  const startQualy = useGame((s) => s.startQualy)
  const startPractice = useGame((s) => s.startPractice)
  const setViewing = useGame((s) => s.setViewing)

  return (
    <div className="menu">
      <section className="menu-panel">
        <KerbEdge />
        <div className="menu-content">
          <h1 className="menu-title">
            <span>Kart</span> <span>Race</span>
          </h1>

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

          {personalBest === null ? (
            <p className="menu-record">No record yet. Finish a qualy lap to set one.</p>
          ) : (
            <p className="menu-record">
              Track record <strong>{formatTime(personalBest)}</strong>
            </p>
          )}

          <div className="menu-links">
            <button className="menu-link" onMouseDown={keepFocus} onClick={() => setViewing(true)}>
              View the track <Key>V</Key>
            </button>
            <a className="menu-link" href="?garage">
              Open the garage
            </a>
          </div>

          <div className="menu-help">
            <span className="menu-help-item">
              <WasdKeys />
              <span>Drive, or use the arrow keys</span>
            </span>
            <span className="menu-help-item">
              <Key>R</Key>
              <span>Back on track</span>
            </span>
          </div>
        </div>
      </section>

      <section className="menu-stage" aria-label="Your car">
        <div className="menu-showcase">
          <CarShowcase />
        </div>
        <CarGrid />
      </section>
    </div>
  )
}

/** The panel's edge: a hairpin of red and white kerb. */
function KerbEdge() {
  const curve = 'M82,0 C104,28 104,72 82,100'
  return (
    <svg className="menu-edge" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <path className="menu-edge-fill" d={`${curve} L0,100 L0,0 Z`} />
      <path className="menu-edge-chalk" d={curve} />
      <path className="menu-edge-red" d={curve} />
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
