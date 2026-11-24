import { useEffect } from 'react'
import { stepDone } from './loading'

/**
 * Tells the loading screen a part is in: once what's around it (in its
 * Suspense boundary) has loaded and it has been drawn once, so its shaders
 * are compiled and its meshes are on the graphics card by the time the
 * loading screen goes away.
 */
export function Ready({ id }: { id: string }) {
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      // The frame it first appears in is drawn after this one.
      frame = requestAnimationFrame(() => stepDone(id))
    })
    return () => cancelAnimationFrame(frame)
  }, [id])
  return null
}
