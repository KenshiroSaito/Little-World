import type { ShopPurchase } from '../shop/inventory';
// The tree canvas from main's placeholder, with the real renderer behind it.
// Keep the onSelect prop and the CanvasSelection type so C's App.tsx keeps working.
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { CanvasSelection, RelicId, Segment } from '../types.ts'
import { NATURAL_BARK } from './palette.ts'
import { WorldRenderer } from './renderer.ts'

export type TreeCanvasHandle = {
  zoomIn(): void
  zoomOut(): void
  fitTree(): void
}

export type TreeCanvasProps = {
  /** Clicks on a branch segment, a relic or the tablets. */
  onSelect: (selection: CanvasSelection) => void
  /** buildTree output; the bare sapling until B's state is wired in. Compared by content. */
  purchases?: readonly ShopPurchase[]
  segments?: readonly Segment[]
  /** revealedRelics(state) ids. The ruin lights up once heartwood_relic is in here. */
  revealedRelics?: readonly RelicId[]
  /** Reflections with text or mood; that many tablet lines glow in the lit ruin. */
  inscriptionCount?: number
  /** totalLP(state): the wood and leaves grow with it, and from 40 LP it builds tree houses. */
  lp?: number
  /** One colour for all the wood (trunk, branches, roots), as '#rrggbb'; the kit's natural bark if left out. */
  barkColor?: string
  /** Highlights leaf clusters on hover. */
  paintMode?: boolean
  reducedMotion?: boolean
  /** The tree spirit, sitting in the canopy. */
  spiritEnabled?: boolean
  className?: string
  ref?: Ref<TreeCanvasHandle>
}

const NONE: readonly never[] = []

export default function TreeCanvas({
  onSelect,
  segments = NONE,
  purchases = NONE,
  revealedRelics = NONE,
  inscriptionCount = 0,
  lp = 0,
  barkColor = NATURAL_BARK,
  paintMode = false,
  reducedMotion = false,
  spiritEnabled = true,
  className,
  ref,
}: TreeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WorldRenderer | null>(null)

  useEffect(() => {
    const renderer = new WorldRenderer(canvasRef.current!)
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    rendererRef.current?.setScene({
      segments,
      purchases,
      revealedRelics,
      inscriptionCount,
      lp,
      barkColor,
      paintMode,
      reducedMotion,
      spiritEnabled,
    })
  }, [purchases, segments, revealedRelics, inscriptionCount, lp, barkColor, paintMode, reducedMotion, spiritEnabled])

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.events = { onSelect }
  }, [onSelect])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => rendererRef.current?.zoomIn(),
      zoomOut: () => rendererRef.current?.zoomOut(),
      fitTree: () => rendererRef.current?.fitTree(),
    }),
    [],
  )

  return (
    <canvas
      ref={canvasRef}
      className={className}
      tabIndex={0}
      role="application"
      aria-roledescription="tree view"
      aria-label="Your tree. Drag or use the arrow keys to look around, plus and minus to zoom, F to fit the tree."
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', touchAction: 'none' }}
    />
  )
}
