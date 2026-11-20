import { useMemo } from 'react'
import * as THREE from 'three'
import { EDGE_LINE_WIDTH, KERB_WIDTH, ROAD_HALF_WIDTH, hasKerb, offsetLeft, track, type BuiltTrack } from './layout'

const HALF = ROAD_HALF_WIDTH

export const ROAD_COLORS = {
  asphalt: '#3d4048',
  line: '#f2f1ec',
  kerbRed: '#e0352b',
  kerbWhite: '#f4f2ec',
}

// Heights above the hall floor (y = 0). Tiny steps avoid flicker between layers.
const Y = { asphalt: 0.02, line: 0.03, kerb: 0.03 }
const KERB_BLOCK = 1.2 // length of each red/white kerb block, meters (along the kerb itself)

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
 * Builds the whole track surface as one mesh from the dense centerline:
 * asphalt, a white edge line on the straights and red/white kerbs painted on
 * the edge in every corner. One quad per band per meter, coloured per vertex,
 * so it's a single draw call.
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
  const tmp = new THREE.Color()

  // Distance travelled along the middle of each kerb, so blocks stay the same
  // length on the outside of a corner as on the inside.
  const kerbMid = HALF - KERB_WIDTH / 2
  const kerbS = { 1: [0], [-1]: [0] } as Record<number, number[]>
  for (const side of [1, -1]) {
    for (let i = 1; i < N; i++) {
      const a = offsetLeft(path[i - 1], side * kerbMid)
      const b = offsetLeft(path[i], side * kerbMid)
      kerbS[side].push(kerbS[side][i - 1] + Math.hypot(b.x - a.x, b.z - a.z))
    }
  }

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
    const id = t.pieces[path[i].piece].id

    pushQuad(i, {
      from: -HALF,
      to: HALF,
      yFrom: Y.asphalt,
      yTo: Y.asphalt,
      color: () => tmp.copy(asphalt).multiplyScalar(1 + jitter(i, 1) * 0.04),
    })

    for (const side of [1, -1]) {
      if (hasKerb(id, side)) {
        const along = kerbS[side][i]
        pushQuad(i, {
          from: side * (HALF - KERB_WIDTH),
          to: side * HALF,
          yFrom: Y.kerb,
          yTo: Y.kerb,
          color: () => (Math.floor(along / KERB_BLOCK) % 2 === 0 ? red : white),
        })
      } else {
        pushQuad(i, {
          from: side * (HALF - EDGE_LINE_WIDTH - 0.15),
          to: side * (HALF - 0.15),
          yFrom: Y.line,
          yTo: Y.line,
          color: () => line,
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
      <meshStandardMaterial vertexColors roughness={0.6} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}
