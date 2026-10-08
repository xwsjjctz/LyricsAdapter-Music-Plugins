import type { MusicPlugin, PluginHost, OnlineMusicElectronAPI } from '../sdk';
import { configureHost, invoke } from '../runtime';
import { createContext } from '../shared/context';
import { NetEaseMusicAPI } from './provider';
import { refreshNetEaseLogin, registerNetEaseHandlers } from './requests';
import { createCookieRenewal } from './renewal';
export function createPlugin(host: PluginHost): MusicPlugin {
  configureHost(host); registerNetEaseHandlers();
  const renewal = createCookieRenewal(host, refreshNetEaseLogin);
  const bridge: OnlineMusicElectronAPI = {
    // Using the source is what keeps its login alive: once the request settles, extend
    // the stored session if that has not happened for a day.
    neteaseRequest: (channel, params, cookie) => (invoke('netease-request', [channel, params, cookie]) as ReturnType<NonNullable<OnlineMusicElectronAPI['neteaseRequest']>>)
      .finally(() => { renewal.renewIfDue(); }),
  };
  return { provider: new NetEaseMusicAPI(createContext(host, bridge, renewal.renew)), invoke,
    validateCookie: async cookie => {
      const result = await bridge.neteaseRequest!('/nuser/account/get', { csrf_token: '' }, cookie);
      const data = result.data as { code?: number; account?: unknown; profile?: unknown } | undefined;
      return result.success && data?.code === 200 && Boolean(data.account || data.profile)
        ? { valid: true } : { valid: false, message: result.error || 'Cookie 无效或已过期' };
    },
    streamHeaders: cookie => ({ 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/', Origin: 'https://music.163.com', ...(cookie ? { Cookie: cookie } : {}) }) };
}
