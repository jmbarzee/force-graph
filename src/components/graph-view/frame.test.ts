import { describe, expect, it } from 'vitest'
import { worldToScreen } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'
import { frameQueue, frameView } from './frame'
import type { FrameRequest } from './frame'

const node = (id: string, x: number, y: number) => ({ id, x, y }) as SimNode
const drawn = [node('a', -100, -50), node('b', 200, 80), node('c', 40, 300)]
const area = { width: 800, height: 600, overlay: 120 }
const vp = { x: 10, y: 20, scale: 0.5 }

describe('frameView', () => {
  it('places every drawn node, and no hidden one, inside the canvas below the overlay', () => {
    const hidden = node('h', 5000, -5000)
    const next = frameView(vp, { ids: ['a', 'b', 'c', 'h'] }, drawn, area)
    const inside = (n: SimNode) => {
      const [x, y] = worldToScreen(next, n.x, n.y)
      return x >= 60 && x <= area.width - 60 && y >= area.overlay + 60 && y <= area.height - 60
    }
    expect(drawn.every(inside)).toBe(true)
    expect(inside(hidden)).toBe(false)
  })

  it('leaves the viewport as it is when the request names no drawn node', () => {
    expect(frameView(vp, { ids: ['h'] }, drawn, area)).toBe(vp)
  })

  it('centres at the current scale raised to minScale', () => {
    const next = frameView(vp, { ids: ['b'], minScale: 1.2 }, drawn, area)
    expect(next.scale).toBe(1.2)
    expect(worldToScreen(next, 200, 80)).toEqual([400, 360])
    expect(frameView(vp, { ids: ['b'], minScale: 0 }, drawn, area).scale).toBe(vp.scale)
  })
})

describe('frameQueue', () => {
  const queued = () => {
    const framed: FrameRequest[] = []
    return { framed, queue: frameQueue(request => { framed.push(request); return true }) }
  }
  const opening = { ids: ['a'], when: 'warm', hold: true } as const

  it('holds a frame from the first warm tick, running its then once', () => {
    const { framed, queue } = queued()
    let thens = 0
    queue.request({ ...opening, then: () => thens++ })
    queue.tick(0.5)
    expect(framed).toEqual([])
    queue.tick(0.29); queue.tick(0.2); queue.tick(0.1)
    expect(framed).toHaveLength(3)
    expect(thens).toBe(1)
  })

  it('releases a held frame, and one waiting to hold, at once', () => {
    const { framed, queue } = queued()
    queue.request(opening)
    queue.release()
    queue.tick(0.1)
    queue.request(opening)
    queue.tick(0.1)
    queue.release()
    queue.tick(0.1)
    expect(framed).toHaveLength(1)
  })

  it('releases a held frame for a newer request, and for a next one acting after it', () => {
    const { framed, queue } = queued()
    const fit = { ids: ['b'] }
    queue.request(opening)
    queue.tick(0.1)
    queue.request(fit)
    queue.tick(0.1)
    const focus = { ids: ['c'], when: 'next' } as const
    queue.request(focus)
    queue.request(opening)
    queue.tick(0.1); queue.tick(0.1)
    expect(framed).toEqual([opening, fit, opening, focus])
  })
})
