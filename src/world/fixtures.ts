// A hand-made tree for drawing before B's buildTree lands: 16 records, each
// with one branch and one root segment, in creation order. The taproot ends at
// depth 8 after 4 records (20 LP, stone) and depth 16 after 8 (40 LP, ruin).
import type { ActivityId, Segment } from '../types.ts'

type P = [number, number]
// [activity, branch parent log, branch from, branch to, root parent log, root from, root to]
type Row = [ActivityId, number | null, P, P, number | null, P, P]

const ROWS: Row[] = [
  ['walk', null, [0, -3], [0, -7], null, [0, 1], [-3, 3]],
  ['connect', 1, [0, -6], [-4, -9], null, [0, 0], [0, 4]],
  ['break', 1, [0, -5], [4, -8], 2, [0, 2], [3, 4]],
  ['reflect', 1, [0, -7], [1, -11], 2, [0, 4], [0, 8]],
  ['walk', 2, [-4, -9], [-7, -10], 1, [-3, 3], [-6, 6]],
  ['connect', 3, [4, -8], [7, -11], 4, [0, 8], [-1, 12]],
  ['break', 4, [1, -11], [-2, -14], 3, [3, 4], [6, 7]],
  ['reflect', 4, [0.75, -10], [4, -13], 6, [-1, 12], [0, 16]],
  ['walk', 5, [-7, -10], [-10, -8], 6, [-0.5, 10], [-5, 14]],
  ['connect', 6, [7, -11], [10, -9], 8, [0, 16], [2, 20]],
  ['break', 7, [-2, -14], [-1, -17], 7, [6, 7], [9, 9]],
  ['reflect', 2, [-2, -7.5], [-6, -6], 10, [2, 20], [3, 24]],
  ['walk', 8, [4, -13], [7, -15], 5, [-6, 6], [-9, 8]],
  ['connect', 3, [2, -6.5], [6, -5], 12, [3, 24], [3, 28]],
  ['break', 11, [-1, -17], [2, -18], 9, [-5, 14], [-8, 15]],
  ['reflect', 7, [-1, -13], [-5, -15], 14, [3, 28], [2, 32]],
]

const logId = (n: number) => `log-${String(n).padStart(2, '0')}`
const pt = ([x, y]: P) => ({ x, y })

export const FIXTURE_LOGS: { id: string; activityId: ActivityId }[] = ROWS.map(([activityId], i) => ({
  id: logId(i + 1),
  activityId,
}))

export const FIXTURE_SEGMENTS: Segment[] = ROWS.flatMap(([activityId, bParent, bFrom, bTo, rParent, rFrom, rTo], i) => {
  const id = logId(i + 1)
  return [
    {
      id: `${id}:b`,
      kind: 'branch' as const,
      parentId: bParent === null ? null : `${logId(bParent)}:b`,
      from: pt(bFrom),
      to: pt(bTo),
      leafColor: activityId,
    },
    {
      id: `${id}:r`,
      kind: 'root' as const,
      parentId: rParent === null ? null : `${logId(rParent)}:r`,
      from: pt(rFrom),
      to: pt(rTo),
    },
  ]
})
