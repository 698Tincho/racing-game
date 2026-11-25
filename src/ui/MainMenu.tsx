import type { AnimationEvent, MouseEvent } from 'react'
import { CARS, carRenderUrl, type CarId } from '../game/cars'
import { ATTEMPTS, formatTime, useGame } from '../game/race/store'
import { track } from '../game/track/layout'
import { showcaseSlot } from './CarShowcase'
import { Key, WasdKeys } from './Key'

// The pictures in the car picker, fetched while the game loads so the menu shows them straight away.
for (const car of CARS) new Image().src = carRenderUrl(car.id)

const pointShowcaseHere = (element: HTMLDivElement | null) => {
  showcaseSlot.element = element
}

// After a mouse click, keep focus off the button so Enter still starts qualifying.
const keepFocus = (e: MouseEvent) => e.preventDefault()

/** The car before or after this one, wrapping round. */
export const nextCar = (id: CarId, step: 1 | -1): CarId => {
  const i = CARS.findIndex((car) => car.id === id)
  return CARS[(i + step + CARS.length) % CARS.length].id
}

/**
 * The title screen, laid out like a team-select screen: the left is a red
 * field with your car, its race number and name; the right is the track, cut
 * on a diagonal, with the circuit and the sessions. The red field, the big
 * number and the car are drawn by the 3D canvas underneath (CarShowcase), so
 * this only places the words and buttons. Designed at 1280 × 720 and scaled
 * with --u (see index.css).
 */
export function MainMenu() {
  const leaving = useGame((s) => s.leavingMenu)
  const setViewing = useGame((s) => s.setViewing)
  // Once the left side has slid out (the right leaves at the same pace), show the track.
  const onLeftGone = (e: AnimationEvent) => {
    if (e.target === e.currentTarget && e.animationName === 'menu-leave-left') setViewing(true)
  }

  return (
    <div className={`menu ${leaving ? 'is-leaving' : ''}`} inert={leaving || undefined}>
      <section className="menu-left" aria-label="Your car" onAnimationEnd={onLeftGone}>
        <Logo />
        <CarHeading />
        {/* The main canvas draws your car into this box (see CarShowcase). */}
        <div className="menu-car" ref={pointShowcaseHere} />
        <CarPicker />
      </section>

      <section className="menu-right" aria-label="Race">
        <TrackCard />
        <Sessions />
      </section>

      <Hints />
    </div>
  )
}

// The logo is drawn on the slashes' grid: 26 tall, each slash leaning 8 across.
const LOGO_HEIGHT = 26
const LEAN_DEG = (Math.atan(8 / 26) * 180) / Math.PI // about 17°
// Archivo's capital height as a share of its size (measured): sized so RACING's capitals are as tall as the slashes.
const CAP_HEIGHT = 0.688
const WORD_X = 37 // where RACING starts, the same gap after the slashes as between them
const WORD_WIDTH = 111 // its advance at that size, in the heading face (measured)

/**
 * The logo: three slashes fading out, then RACING in the heading face (Archivo,
 * condensed, black), slanted by exactly the slashes' angle and as tall as they are.
 */
function Logo() {
  return (
    <h1 className="menu-brand" aria-label="RACING">
      <svg viewBox={`0 0 ${WORD_X + WORD_WIDTH} ${LOGO_HEIGHT}`} aria-hidden>
        <polygon points="8,0 18,0 10,26 0,26" />
        <polygon points="21,0 28,0 20,26 13,26" opacity={0.7} />
        <polygon points="31,0 35,0 27,26 23,26" opacity={0.45} />
        <text
          x={WORD_X}
          y={LOGO_HEIGHT}
          fontSize={LOGO_HEIGHT / CAP_HEIGHT}
          transform={`translate(0 ${LOGO_HEIGHT}) skewX(${-LEAN_DEG}) translate(0 ${-LOGO_HEIGHT})`}
        >
          RACING
        </text>
      </svg>
    </h1>
  )
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="menu-eyebrow">
      <span>{children}</span>
    </p>
  )
}

function CarHeading() {
  const carId = useGame((s) => s.carId)
  const car = CARS.find((c) => c.id === carId) ?? CARS[0]
  return (
    <div className="menu-car-head">
      <Eyebrow>Choose your car</Eyebrow>
      <h2 className="menu-car-name" aria-live="polite">
        #{car.number} {car.name}
      </h2>
      <p className="menu-car-kind">{car.kind}</p>
      <p className="menu-car-note">Same engine, grip and weight as every other car. Only the livery changes.</p>
    </div>
  )
}

/** Arrows either side of a tile per car. Keys: ← →, or 1–3. */
function CarPicker() {
  const carId = useGame((s) => s.carId)
  const setCar = useGame((s) => s.setCar)
  return (
    <div className="menu-picker">
      <button className="menu-arrow" aria-label="Previous car" onMouseDown={keepFocus} onClick={() => setCar(nextCar(carId, -1))}>
        <Chevron dir="left" />
      </button>
      <div className="menu-tiles" role="radiogroup" aria-label="Choose your car">
        {CARS.map((car, i) => (
          <button
            key={car.id}
            className={`menu-tile ${car.id === carId ? 'is-on' : ''}`}
            role="radio"
            aria-checked={car.id === carId}
            aria-label={`#${car.number} ${car.name}`}
            onMouseDown={keepFocus}
            onClick={() => setCar(car.id)}
          >
            <img src={carRenderUrl(car.id)} alt="" />
            <span className="menu-tile-key">{i + 1}</span>
          </button>
        ))}
      </div>
      <button className="menu-arrow" aria-label="Next car" onMouseDown={keepFocus} onClick={() => setCar(nextCar(carId, 1))}>
        <Chevron dir="right" />
      </button>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 14 14" aria-hidden>
      <path d={dir === 'left' ? 'M9 2 4 7l5 5' : 'm5 2 5 5-5 5'} />
    </svg>
  )
}

// The circuit's outline for the map, from the centreline, fitted into a 240 × 180 box.
const MAP = (() => {
  const W = 240
  const H = 180
  const PAD = 10
  const points = track.path.filter((_, i) => i % 4 === 0)
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  const minX = Math.min(...xs)
  const minZ = Math.min(...zs)
  const scale = Math.min((W - 2 * PAD) / (Math.max(...xs) - minX), (H - 2 * PAD) / (Math.max(...zs) - minZ))
  const offX = (W - (Math.max(...xs) - minX) * scale) / 2
  const offZ = (H - (Math.max(...zs) - minZ) * scale) / 2
  const at = (x: number, z: number) => [offX + (x - minX) * scale, offZ + (z - minZ) * scale]
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${at(p.x, p.z).map((v) => v.toFixed(1)).join(' ')}`).join('') + 'Z'
  // The start/finish line: a short bar across the road.
  const [fx, fz] = at(track.finish.x, track.finish.z)
  const across = [Math.cos(track.finish.yaw) * 9, -Math.sin(track.finish.yaw) * 9]
  return { line, finish: [fx - across[0], fz - across[1], fx + across[0], fz + across[1]] }
})()

const SECTORS = track.sectorEnds.length + 1

function TrackCard() {
  const personalBest = useGame((s) => s.personalBest)
  return (
    <div className="menu-track">
      <Eyebrow>Track</Eyebrow>
      <h2 className="menu-track-name">Circuit 01</h2>
      <div className="menu-track-body">
        <svg className="menu-map" viewBox="0 0 240 180" role="img" aria-label="Map of Circuit 01">
          <path d={MAP.line} />
          <line x1={MAP.finish[0]} y1={MAP.finish[1]} x2={MAP.finish[2]} y2={MAP.finish[3]} />
        </svg>
        <dl className="menu-stats">
          <div>
            <dt>Length</dt>
            <dd>{Math.round(track.length)} m</dd>
          </div>
          <div>
            <dt>Sectors</dt>
            <dd>{SECTORS}</dd>
          </div>
          <div>
            <dt>Your record</dt>
            {personalBest === null ? (
              <dd className="menu-stats-empty">No time yet</dd>
            ) : (
              <dd className="menu-stats-record">{formatTime(personalBest)}</dd>
            )}
          </div>
        </dl>
      </div>
    </div>
  )
}

function Sessions() {
  const startQualy = useGame((s) => s.startQualy)
  const startPractice = useGame((s) => s.startPractice)
  const viewTrack = useGame((s) => s.viewTrack)
  return (
    <div className="menu-sessions">
      <Eyebrow>Session</Eyebrow>
      <button className="menu-session menu-session-main" onMouseDown={keepFocus} onClick={startQualy}>
        <span className="menu-session-index">01</span>
        <span className="menu-session-text">
          <strong>Qualifying</strong>
          <small>{ATTEMPTS} flying laps. Your best one counts.</small>
        </span>
        <Key>Enter</Key>
      </button>
      <button className="menu-session" onMouseDown={keepFocus} onClick={startPractice}>
        <span className="menu-session-index">02</span>
        <span className="menu-session-text">
          <strong>Practice</strong>
          <small>Unlimited laps. Times aren't saved.</small>
        </span>
        <Key>P</Key>
      </button>
      <button className="menu-preview" onMouseDown={keepFocus} onClick={viewTrack}>
        <span>Preview the track</span>
        <Key>V</Key>
      </button>
    </div>
  )
}

/** Every key the menu answers to, and how to drive, along the bottom. */
function Hints() {
  return (
    <footer className="menu-hints">
      <ul>
        <li>
          <Key>←</Key>
          <Key>→</Key>
          Change car
        </li>
        <li>
          <Key>Enter</Key>
          Qualifying
        </li>
        <li>
          <Key>P</Key>
          Practice
        </li>
        <li>
          <Key>V</Key>
          Track preview
        </li>
      </ul>
      <ul>
        <li>
          <WasdKeys />
          Drive, or the arrow keys
        </li>
        <li>
          <Key>R</Key>
          Back on track
        </li>
      </ul>
    </footer>
  )
}
