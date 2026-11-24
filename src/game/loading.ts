import { create } from 'zustand'

/**
 * What the loading screen waits for: each part of the world says when it's
 * on screen. The screen also counts the files downloading (drei's
 * useProgress); this covers the setup after that, which takes longer.
 */
export type LoadStep = { id: string; label: string }

type LoadState = {
  steps: LoadStep[]
  done: string[]
  /** Everything's in: the loading screen goes away (and stays away). */
  finished: boolean
}

export const useLoading = create<LoadState>(() => ({ steps: [], done: [], finished: false }))

/** The parts to wait for, in the order they load. Call once, before they start. */
export function expectSteps(steps: LoadStep[]) {
  useLoading.setState({ steps })
}

export function stepDone(id: string) {
  const { done } = useLoading.getState()
  if (!done.includes(id)) useLoading.setState({ done: [...done, id] })
}

export const finishLoading = () => useLoading.setState({ finished: true })
