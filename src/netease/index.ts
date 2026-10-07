import type { MusicPlugin, PluginHost, OnlineMusicElectronAPI } from '../sdk';
import { configureHost, invoke } from '../runtime';
import { createContext } from '../shared/context';
import { NetEaseMusicAPI } from './provider';
import { registerNetEaseHandlers } from './requests';
export function createPlugin(host: PluginHost): MusicPlugin {
  configureHost(host); registerNetEaseHandlers();
  const bridge: OnlineMusicElectronAPI = {
    neteaseRequest: (channel, params, cookie) => invoke('netease-request', [channel, params, cookie]) as ReturnType<NonNullable<OnlineMusicElectronAPI['neteaseRequest']>>,
  };
  return { provider: new NetEaseMusicAPI(createContext(host, bridge, async () => false)), invoke,
    validateCookie: async cookie => {
      const result = await bridge.neteaseRequest!('/nuser/account/get', { csrf_token: '' }, cookie);
      const data = result.data as { code?: number; account?: unknown; profile?: unknown } | undefined;
      return result.success && data?.code === 200 && Boolean(data.account || data.profile)
        ? { valid: true } : { valid: false, message: result.error || 'Cookie 无效或已过期' };
    },
    streamHeaders: cookie => ({ 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/', Origin: 'https://music.163.com', ...(cookie ? { Cookie: cookie } : {}) }) };
}
