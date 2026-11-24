import { create } from 'zustand'

// Sounds from Kenney's Starter Kit Racing (CC0). The skid is by Landeplage.
// OGG loops cleanly, so it's tried first. The M4A is for browsers without it.
const FORMATS = ['ogg', 'm4a']
const MASTER_VOLUME = 0.55

const muteKey = 'kart-race:muted'
const loadMuted = () => {
  try {
    return localStorage.getItem(muteKey) === '1'
  } catch {
    return false
  }
}

export const useSound = create<{ muted: boolean; toggleMuted: () => void }>()((set, get) => ({
  muted: loadMuted(),
  toggleMuted: () => {
    const muted = !get().muted
    set({ muted })
    if (audio) glide(audio.master.gain, muted ? 0 : MASTER_VOLUME, 0.02)
    try {
      localStorage.setItem(muteKey, muted ? '1' : '0')
    } catch {
      // private mode etc: the choice just won't survive a reload
    }
  },
}))

type Audio = {
  ctx: AudioContext
  master: GainNode
  engine?: { gain: GainNode; source: AudioBufferSourceNode }
  skid?: { gain: GainNode; source: AudioBufferSourceNode }
  impact?: AudioBuffer
  ui: Partial<Record<UiSound, AudioBuffer>>
}
export type UiSound = 'toggle' | 'rotate'
const UI_VOLUME = 0.7
let audio: Audio | null = null

/** Moves a parameter smoothly, so per-frame changes never click. */
const glide = (param: AudioParam, value: number, smoothing: number) => {
  if (audio) param.setTargetAtTime(value, audio.ctx.currentTime, smoothing)
}

async function load(ctx: AudioContext, name: string) {
  for (const format of FORMATS) {
    try {
      const response = await fetch(`/audio/${name}.${format}`)
      if (response.ok) return await ctx.decodeAudioData(await response.arrayBuffer())
    } catch {
      // this browser can't decode it: try the next format
    }
  }
  console.warn(`Sound: could not load ${name}`)
  return undefined
}

function startLoop(a: Audio, buffer: AudioBuffer) {
  const gain = a.ctx.createGain()
  gain.gain.value = 0
  gain.connect(a.master)
  const source = a.ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.connect(gain)
  source.start()
  return { gain, source }
}

/** Browsers only allow sound after a click or key press, so call this from one. */
export async function unlockSound() {
  if (audio) {
    if (audio.ctx.state === 'suspended' && !document.hidden) void audio.ctx.resume()
    return
  }
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = useSound.getState().muted ? 0 : MASTER_VOLUME
  master.connect(ctx.destination)
  const a: Audio = { ctx, master, ui: {} }
  audio = a
  void ctx.resume()

  const [engine, skid, impact, toggle, rotate] = await Promise.all(
    ['engine', 'skid', 'impact', 'toggle', 'rotate'].map((name) => load(ctx, name)),
  )
  if (audio !== a) return // replaced by a hot reload while loading
  if (engine) a.engine = startLoop(a, engine)
  if (skid) a.skid = startLoop(a, skid)
  a.impact = impact
  a.ui = { toggle, rotate }
}

/** The game stops updating in a background tab, so the sound loops stop with it. */
export function syncSoundToTab() {
  if (!audio) return
  if (document.hidden) void audio.ctx.suspend()
  else void audio.ctx.resume()
}

export function setEngine(volume: number, rate: number) {
  if (!audio?.engine) return
  glide(audio.engine.gain.gain, volume, 0.06)
  glide(audio.engine.source.playbackRate, rate, 0.12)
}

export function setSkid(volume: number, rate: number) {
  if (!audio?.skid) return
  glide(audio.skid.gain.gain, volume, 0.05)
  glide(audio.skid.source.playbackRate, rate, 0.1)
}

function playOnce(buffer: AudioBuffer | undefined, volume: number) {
  if (!audio || !buffer) return
  const gain = audio.ctx.createGain()
  gain.gain.value = volume
  gain.connect(audio.master)
  const source = audio.ctx.createBufferSource()
  source.buffer = buffer
  source.connect(gain)
  source.onended = () => gain.disconnect()
  source.start()
}

export const playImpact = (volume: number) => playOnce(audio?.impact, volume)
export const playUiSound = (name: UiSound) => playOnce(audio?.ui[name], UI_VOLUME)

// Handy while developing: inspect the audio graph from the browser console.
if (import.meta.env.DEV) Object.assign(window, { kartAudio: () => audio })

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void audio?.ctx.close()
    audio = null
  })
}
