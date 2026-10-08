/**
 * NetEase credit lines (作词 / 作曲 / 制作人 / 发行信息 …).
 *
 * `/song/lyric/v1` does not send these as lyric lines. Both the `lrc` and the
 * `yrc` block carry them as one JSON object per line, mixed in with the timed
 * lyric text:
 *
 *   {"t":0,"c":[{"tx":"作词: "},{"tx":"赵雷","li":"…","or":"orpheus://…"}]}
 *   [28480,11820](28480,160,0)我(28640,420,0)带…
 *
 * LRC / YRC parsers skip the JSON lines, so the credits silently disappear.
 * Rewrite them in the native syntax of the block they sit in.
 */

export type NetEaseLyricFormat = 'lrc' | 'yrc';

interface NetEaseCreditLine {
  /** Start time in milliseconds. */
  t: number;
  /** Text segments; `li` / `or` (avatar and deep link) are dropped. */
  c: { tx?: unknown }[];
}

/** Longest a credit line stays highlighted when the next line is far away. */
const MAX_CREDIT_DURATION_MS = 1000;

const YRC_LINE_START = /^\[(\d+),\d+\]/;
const LRC_LINE_START = /^\[(\d+):(\d+)(?:[.:](\d+))?\]/;

function parseCreditLine(line: string): NetEaseCreditLine | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not a credit line (e.g. a lyric that happens to start with a brace).
    return null;
  }
  const candidate = parsed as Partial<NetEaseCreditLine> | null;
  if (typeof candidate?.t !== 'number' || !Number.isFinite(candidate.t) || candidate.t < 0) return null;
  if (!Array.isArray(candidate.c)) return null;
  return { t: Math.round(candidate.t), c: candidate.c };
}

function creditText(credit: NetEaseCreditLine): string {
  return credit.c
    .map((segment) => (typeof segment?.tx === 'string' ? segment.tx : ''))
    .join('')
    .trim();
}

/** Start time (ms) of a line in either syntax, or null when it carries none. */
function lineStartMs(line: string, format: NetEaseLyricFormat): number | null {
  const credit = parseCreditLine(line);
  if (credit) return credit.t;
  if (format === 'yrc') {
    const match = YRC_LINE_START.exec(line.trim());
    return match ? Number(match[1]) : null;
  }
  const match = LRC_LINE_START.exec(line.trim());
  if (!match) return null;
  const fraction = match[3] ? Number(`0.${match[3]}`) : 0;
  return Math.round((Number(match[1]) * 60 + Number(match[2]) + fraction) * 1000);
}

function creditDurationMs(startMs: number, following: string[], format: NetEaseLyricFormat): number {
  for (const line of following) {
    const nextStart = lineStartMs(line, format);
    if (nextStart === null) continue;
    const gap = nextStart - startMs;
    return gap > 0 ? Math.min(gap, MAX_CREDIT_DURATION_MS) : MAX_CREDIT_DURATION_MS;
  }
  return MAX_CREDIT_DURATION_MS;
}

function lrcTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}]`;
}

/**
 * Replace NetEase's JSON credit lines with real `format` lines, leaving every
 * other line exactly as it arrived.
 */
export function inlineNetEaseCredits(lyric: string, format: NetEaseLyricFormat): string {
  if (!lyric.includes('{')) return lyric;
  const lines = lyric.split('\n');
  return lines
    .map((line, index) => {
      const credit = parseCreditLine(line);
      if (!credit) return line;
      const text = creditText(credit);
      if (!text) return line;
      if (format === 'lrc') return `${lrcTimestamp(credit.t)}${text}`;
      const duration = creditDurationMs(credit.t, lines.slice(index + 1), format);
      return `[${credit.t},${duration}](${credit.t},${duration},0)${text}`;
    })
    .join('\n');
}
