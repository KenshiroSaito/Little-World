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
  /** Eases to a branch's leaves and outlines them for a moment. */
  focusBranch(segmentId: string): void
  /** Eases to a reflection's keepsake in the roots and outlines it for a moment. */
  focusKeepsake(logId: string): void
}

export type TreeCanvasProps = {
  /** Clicks on a branch segment, a relic, a reflection's keepsake or the tablets; E at a leaf bunch too. */
  onSelect: (selection: CanvasSelection) => void
  /** Trinkets, hung on the branches they were placed on. */
  purchases?: readonly ShopPurchase[]
  /** Item ids of the accessories the spirit wears. */
  outfit?: readonly string[]
  /** Ids of reflect logs; each buries a keepsake at the tip of its root. */
  keepsakes?: readonly string[]
  /** buildTree output; the bare sapling until B's state is wired in. Compared by content. */
  segments?: readonly Segment[]
  /** revealedRelics(state) ids. The ruin lights up once heartwood_relic is in here. */
  revealedRelics?: readonly RelicId[]
  /** Reflections with text or mood; that many tablet lines glow in the lit ruin. */
  inscriptionCount?: number
  /** totalLP(state): the wood and leaves grow with it, and from 40 LP it builds tree houses. */
  lp?: number
  /** One colour for all the wood (trunk, branches, roots), as '#rrggbb'; the kit's natural bark if left out. */
  barkColor?: string
  reducedMotion?: boolean
  /** The tree spirit, which the player walks, jumps and climbs with. */
  spiritEnabled?: boolean
  className?: string
  ref?: Ref<TreeCanvasHandle>
}

const NONE: readonly never[] = []

export default function TreeCanvas({
  onSelect,
  segments = NONE,
  purchases = NONE,
  outfit = NONE,
  keepsakes = NONE,
  revealedRelics = NONE,
  inscriptionCount = 0,
  lp = 0,
  barkColor = NATURAL_BARK,
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
      outfit,
      keepsakes,
      revealedRelics,
      inscriptionCount,
      lp,
      barkColor,
      reducedMotion,
      spiritEnabled,
    })
  }, [purchases, outfit, keepsakes, segments, revealedRelics, inscriptionCount, lp, barkColor, reducedMotion, spiritEnabled])

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.events = { onSelect }
  }, [onSelect])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => rendererRef.current?.zoomIn(),
      zoomOut: () => rendererRef.current?.zoomOut(),
      fitTree: () => rendererRef.current?.fitTree(),
      focusBranch: (segmentId: string) => rendererRef.current?.focusBranch(segmentId),
      focusKeepsake: (logId: string) => rendererRef.current?.focusKeepsake(logId),
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
      aria-label="Your tree and its spirit. Arrow keys or WASD walk, Space jumps, Up and Down climb the trunk, branches and roots, E reads the journal entry of the leaves you are at. Drag to look around, plus and minus to zoom, F to fit the tree."
      style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated', touchAction: 'none' }}
    />
  )
}
