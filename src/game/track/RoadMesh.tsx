import { useMemo } from 'react'
import * as THREE from 'three'
import { PIECES } from './pieces'
import {
  EDGE_LINE_WIDTH,
  GRAVEL_WIDTH,
  KERB_WIDTH,
  ROAD_HALF_WIDTH,
  isGravelSide,
  offsetLeft,
  track,
  type BuiltTrack,
} from './layout'

const HALF = ROAD_HALF_WIDTH

export const ROAD_COLORS = {
  asphalt: '#454a55',
  line: '#f4f3ee',
  kerbRed: '#d93a2b',
  kerbWhite: '#f1efe8',
  gravel: '#d8c59b',
}

// Heights above the grass (y = 0). Tiny steps avoid flicker between layers.
const Y = { gravel: 0.012, asphalt: 0.02, line: 0.03, kerbIn: 0.025, kerbOut: 0.07 }
const KERB_BLOCK = 1.5 // length of each red/white block, meters

type Band = {
  from: number // signed offset from the centerline, + = left
  to: number
  yFrom: number
  yTo: number
  color: (i: number) => THREE.Color
}

// Small deterministic jitter so big flat areas don't look like plastic.
const jitter = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return (s - Math.floor(s) - 0.5) * 2
}

/**
 * Builds the whole circuit surface as one mesh from the track's dense
 * centerline: asphalt, white edge lines, kerbs on every corner and gravel
 * traps on the outside of the large corners. One quad per band per meter,
 * coloured per vertex, so it's a single draw call.
 */
export function buildRoadGeometry(t: BuiltTrack = track) {
  const positions: number[] = []
  const colors: number[] = []
  const path = t.path
  const N = path.length

  const asphalt = new THREE.Color(ROAD_COLORS.asphalt)
  const line = new THREE.Color(ROAD_COLORS.line)
  const red = new THREE.Color(ROAD_COLORS.kerbRed)
  const white = new THREE.Color(ROAD_COLORS.kerbWhite)
  const gravel = new THREE.Color(ROAD_COLORS.gravel)
  const tmp = new THREE.Color()

  const pushQuad = (i: number, band: Band) => {
    const a = path[i]
    const b = path[(i + 1) % N]
    const color = band.color(i)
    const corners = [
      { ...offsetLeft(a, band.from), y: band.yFrom },
      { ...offsetLeft(a, band.to), y: band.yTo },
      { ...offsetLeft(b, band.from), y: band.yFrom },
      { ...offsetLeft(b, band.to), y: band.yTo },
    ]
    // Two triangles; flip the winding if needed so the face points up.
    const tri = (p: (typeof corners)[number], q: (typeof corners)[number], r: (typeof corners)[number]) => {
      const up = (q.z - p.z) * (r.x - p.x) - (q.x - p.x) * (r.z - p.z)
      const order = up >= 0 ? [p, q, r] : [p, r, q]
      for (const v of order) {
        positions.push(v.x, v.y, v.z)
        colors.push(color.r, color.g, color.b)
      }
    }
    tri(corners[0], corners[1], corners[2])
    tri(corners[1], corners[3], corners[2])
  }

  for (let i = 0; i < N; i++) {
    const p = path[i]
    const id = t.pieces[p.piece].id
    const isCorner = PIECES[id].corner !== 'none'

    pushQuad(i, {
      from: -HALF,
      to: HALF,
      yFrom: Y.asphalt,
      yTo: Y.asphalt,
      color: () => tmp.copy(asphalt).multiplyScalar(1 + jitter(i, 1) * 0.035),
    })

    for (const side of [1, -1]) {
      pushQuad(i, {
        from: side * (HALF - EDGE_LINE_WIDTH),
        to: side * HALF,
        yFrom: Y.line,
        yTo: Y.line,
        color: () => line,
      })

      if (isCorner) {
        pushQuad(i, {
          from: side * HALF,
          to: side * (HALF + KERB_WIDTH),
          yFrom: Y.kerbIn,
          yTo: Y.kerbOut,
          color: () => (Math.floor(p.s / KERB_BLOCK) % 2 === 0 ? red : white),
        })
      }

      if (isGravelSide(id, side)) {
        const wall = (side === 1 ? t.barrierOffset.left : t.barrierOffset.right)[i]
        const outer = Math.min(HALF + KERB_WIDTH + GRAVEL_WIDTH, wall - 0.9)
        pushQuad(i, {
          from: side * (HALF + KERB_WIDTH),
          to: side * outer,
          yFrom: Y.gravel,
          yTo: Y.gravel,
          color: () => tmp.copy(gravel).multiplyScalar(1 + jitter(i, 2 + side) * 0.06),
        })
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

export function RoadMesh() {
  const geometry = useMemo(() => buildRoadGeometry(), [])
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}
