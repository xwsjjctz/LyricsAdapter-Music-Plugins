import type { PluginHost, ProviderContext, OnlineMusicElectronAPI } from '../sdk';
export function createContext(host: PluginHost, bridge: OnlineMusicElectronAPI, refresh: () => Promise<boolean>): ProviderContext {
  const getCookie = () => host.readSecret('cookie');
  return {
    logger: host.logger, bridge, refresh,
    cookie: { getCookie, hasCookie: () => Boolean(getCookie()), ensureLoaded: async () => {},
      parseCookie: () => Object.fromEntries(getCookie().split(/;\s*/).filter(Boolean).map(part => {
        const index = part.indexOf('='); return [part.slice(0, index), part.slice(index + 1)];
      })) },
    // The renderer owns bounded lyric caching, shared across all plugins.
    lyricsCache: { getOrLoad: (_source, _id, load) => load() },
  };
}
