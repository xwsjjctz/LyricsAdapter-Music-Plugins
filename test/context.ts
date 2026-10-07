import { vi } from 'vitest';
import type { ProviderContext } from '../src/sdk';
export function context(overrides: Partial<ProviderContext> = {}): ProviderContext {
  return { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cookie: { hasCookie: () => true, getCookie: () => 'uin=1', parseCookie: () => ({ uin: '1' }), ensureLoaded: async () => {} },
    bridge: {}, refresh: vi.fn().mockResolvedValue(false), lyricsCache: { getOrLoad: (_source, _id, load) => load() }, ...overrides };
}
