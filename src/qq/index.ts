import type { MusicPlugin, PluginHost, OnlineMusicElectronAPI } from '../sdk';
import { configureHost, invoke } from '../runtime';
import { createContext } from '../shared/context';
import { QQMusicAPI } from './provider';
import { registerQQMusicHandlers } from './requests';
import { registerQQLoginHandlers } from './login';
import { qqMusicHeaders } from './headers';
import { isQQCredential } from './credential';
export function createPlugin(host: PluginHost): MusicPlugin {
  configureHost(host); registerQQMusicHandlers(); registerQQLoginHandlers();
  const bridge: OnlineMusicElectronAPI = {
    qqMusicRequest: options => invoke('qq-music-request', [options]) as ReturnType<NonNullable<OnlineMusicElectronAPI['qqMusicRequest']>>,
    getQQMusicUrl: (data, cookie) => invoke('get-qq-music-url', [data, cookie]),
    getQQMusicLyrics: (id, cookie) => invoke('get-qq-music-lyrics', [id, cookie]) as ReturnType<NonNullable<OnlineMusicElectronAPI['getQQMusicLyrics']>>,
  };
  let refreshing: Promise<boolean> | null = null;
  let lastAttempt = 0;
  const refresh = (): Promise<boolean> => {
    if (refreshing) return refreshing;
    if (Date.now() - lastAttempt < 10 * 60_000) return Promise.resolve(false);
    lastAttempt = Date.now();
    refreshing = (async () => {
      const raw = host.readSecret('credential');
      if (!raw) return false;
      const credential: unknown = JSON.parse(raw);
      if (!isQQCredential(credential)) return false;
      const result = await invoke('qq-login-refresh', [credential, host.readSecret('cookie')]) as {
        success: boolean; credential?: unknown; cookie?: string;
      };
      if (!result.success || !result.credential || !result.cookie) return false;
      host.writeSecrets({ credential: JSON.stringify(result.credential), cookie: result.cookie });
      return true;
    })().catch(error => { host.logger.warn('[QQ] Refresh failed', error); return false; }).finally(() => { refreshing = null; });
    return refreshing;
  };
  return { provider: new QQMusicAPI(createContext(host, bridge, refresh)), invoke, streamHeaders: qqMusicHeaders,
    validateCookie: async cookie => {
      const result = await bridge.qqMusicRequest!({ url: 'https://u.y.qq.com/cgi-bin/musicu.fcg', method: 'POST', cookie,
        body: JSON.stringify({ comm: { ct: 24, cv: 4747474, format: 'json', uin: '0', g_tk: 5381 },
          req_1: { module: 'musicToplist.ToplistInfoServer', method: 'GetAll', param: {} } }) });
      if (!result.success) return { valid: false, message: result.error || 'Network error during validation' };
      return (result.data as { code?: number })?.code === 500001
        ? { valid: false, message: 'Cookie expired or invalid' } : { valid: true };
    } };
}
