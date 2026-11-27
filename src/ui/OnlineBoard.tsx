import { useEffect, useState, type FormEvent } from 'react'
import { BOARD_SIZE, NICKNAME_MAX, nicknameProblem, tidyNickname } from '../../api/_rules'
import { savedNickname, useBoard } from '../game/race/leaderboard'
import { formatTime, useGame } from '../game/race/store'
import { circuitById } from '../game/track/circuits'

const ms = (seconds: number) => Math.round(seconds * 1000)

/**
 * The online top ten, beside your qualifying results. If your best lap makes the board (and beats
 * this browser's own entry), it asks for a nickname the first time and sends it; after that it
 * sends by itself with the remembered one. Shows nothing if the board can't be reached.
 */
export function OnlineBoard({ best, sectors }: { best: number | null; sectors: number[] | null }) {
  const circuitId = useGame((s) => s.circuitId)
  const board = useBoard((s) => s.board)
  const status = useBoard((s) => s.status)
  // Only once the board with this browser's own place has arrived (the menu's copy hasn't got it).
  const mine = useBoard((s) => s.mine)
  // Only laps from a run the server knows about can go on the board.
  const hasRun = useBoard((s) => s.run?.track === circuitId)
  const sending = useBoard((s) => s.sending)
  const sendError = useBoard((s) => s.sendError)
  const carId = useGame((s) => s.carId)
  const [nickname, setNickname] = useState(savedNickname)
  const [problem, setProblem] = useState<string | null>(null)

  // A fresh board, with this browser's place, each time the results come up.
  useEffect(() => {
    useBoard.getState().resetSend()
    void useBoard.getState().load(circuitId, true)
  }, [circuitId])

  const top = board?.track === circuitId ? board.top : []
  const you = board?.track === circuitId ? board.you : null
  const lap = best !== null && sectors?.length === 3 ? { time: best, sectors } : null
  const beatsOwn = lap !== null && (you === null || ms(lap.time) < you.timeMs)
  const makesBoard = lap !== null && (top.length < BOARD_SIZE || ms(lap.time) < top[top.length - 1].timeMs)
  const offer = status === 'ready' && mine && hasRun && sending === 'idle' && beatsOwn && makesBoard

  const submit = (name: string) => {
    if (!lap) return
    void useBoard.getState().send({ track: circuitId, nickname: name, carId, time: lap.time, sectors: lap.sectors })
  }

  // Already has a nickname from an earlier lap: send straight away.
  const remembered = savedNickname()
  useEffect(() => {
    if (offer && remembered) submit(remembered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer])

  if (status === 'offline' || status === 'idle') return null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const name = tidyNickname(nickname)
    const why = nicknameProblem(name)
    setProblem(why)
    if (!why) submit(name)
  }

  return (
    <section className="results-board" aria-label="Leaderboard">
      <p className="eyebrow">Leaderboard · {circuitById(circuitId).name}</p>

      {status === 'loading' && top.length === 0 ? (
        <p className="board-note">Loading the board…</p>
      ) : top.length === 0 ? (
        <p className="board-note">No times yet. Be the first.</p>
      ) : (
        <ol className="board">
          {top.map((row) => (
            <li key={row.rank} className={row.mine ? 'is-mine' : ''}>
              <span className="board-rank">{row.rank}</span>
              <span className="board-name">{row.nickname}</span>
              <span className={`board-time ${row.rank === 1 ? 'is-fastest' : ''}`}>{formatTime(row.timeMs / 1000)}</span>
            </li>
          ))}
          {you && you.rank > top.length && (
            <li className="is-mine board-you">
              <span className="board-rank">{you.rank}</span>
              <span className="board-name">{you.nickname}</span>
              <span className="board-time">{formatTime(you.timeMs / 1000)}</span>
            </li>
          )}
        </ol>
      )}

      {offer && !remembered && (
        <form className="board-form" onSubmit={onSubmit}>
          <label htmlFor="board-nickname">Your lap makes the board. Your nickname:</label>
          <div className="board-form-row">
            <input
              id="board-nickname"
              value={nickname}
              maxLength={NICKNAME_MAX + 4}
              autoComplete="nickname"
              spellCheck={false}
              placeholder="3 to 12 characters"
              onChange={(e) => setNickname(e.target.value)}
            />
            <button className="cta" type="submit">
              Send
            </button>
          </div>
          {problem && <p className="board-error">{problem}</p>}
        </form>
      )}
      {sending === 'sending' && <p className="board-note">Sending your lap…</p>}
      {sending === 'error' && <p className="board-error">{sendError ?? 'Could not send your lap'}</p>}
      {sending === 'sent' && you && (
        <p className="board-note board-done">
          {board?.improved === false ? (
            <>
              Your best on the board stays <strong>{formatTime(you.timeMs / 1000)}</strong>, <strong>P{you.rank}</strong>.
            </>
          ) : (
            <>
              You're <strong>P{you.rank}</strong> on the board as <strong>{you.nickname}</strong>.
            </>
          )}
        </p>
      )}
    </section>
  )
}
