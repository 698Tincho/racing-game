import { useEffect } from 'react'
import { useSound } from '../game/audio/sound'
import { Key } from './Key'

/** Sound on/off, top right on every screen. Key: M. */
export function SoundButton() {
  const muted = useSound((s) => s.muted)
  const toggleMuted = useSound((s) => s.toggleMuted)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) useSound.getState().toggleMuted()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <button
      className="sound-toggle"
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
      // Keep keyboard focus off it after a click, so Enter and Space still drive the menus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggleMuted}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        <path className="sound-icon-fill" d="M4 9.5v5h3.6l4.9 4V5.5l-4.9 4H4Z" />
        {muted ? (
          <path d="m16 9.5 5 5m0-5-5 5" />
        ) : (
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6m2.7-8.8a8.2 8.2 0 0 1 0 11.6" />
        )}
      </svg>
      <Key>M</Key>
    </button>
  )
}
