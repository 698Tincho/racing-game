import type { ReactNode } from 'react'

/** A keyboard key, drawn as a chunky keycap. */
export const Key = ({ children }: { children: ReactNode }) => <kbd className="key-cap">{children}</kbd>

/** The driving keys, laid out as they are on a keyboard. */
export const WasdKeys = () => (
  <span className="key-wasd" aria-hidden>
    <Key>W</Key>
    <Key>A</Key>
    <Key>S</Key>
    <Key>D</Key>
  </span>
)
