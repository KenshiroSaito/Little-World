import type { SelfCareLog } from '../types';

/** One page of the journal book: some of one day's records, in the order they were made. */
export type JournalPage = { date: string; entries: SelfCareLog[]; continued: boolean };

/** Lines below the date that a page holds, and about how many characters fit on a line. */
const PAGE_LINES = 11;
const LINE_CHARS = 26;

/** Lines a row of photo thumbnails takes. */
const PHOTO_LINES = 3;

/** A record's title line, plus its reflection (in quotes), mood and photos if it has them. */
function linesOf(log: SelfCareLog): number {
  return 1 + (log.text ? Math.ceil((log.text.length + 2) / LINE_CHARS) : 0) + (log.mood ? 1 : 0) + (log.images?.length ? PHOTO_LINES : 0);
}

/**
 * The journal as book pages, oldest day first like a diary. Each day starts a
 * new page; a busy day carries on over the next pages instead of overflowing.
 */
export function journalPages(logs: readonly SelfCareLog[]): JournalPage[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const pages: JournalPage[] = [];
  let used = 0;
  for (const log of sorted) {
    const last = pages.at(-1);
    const lines = linesOf(log);
    if (last && last.date === log.date && used + lines <= PAGE_LINES) {
      last.entries.push(log);
      used += lines;
    } else {
      pages.push({ date: log.date, entries: [log], continued: last?.date === log.date });
      used = lines;
    }
  }
  return pages;
}
