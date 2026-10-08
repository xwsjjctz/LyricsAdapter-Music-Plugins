import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlugin } from '../src/qq/index';

const credential = {
  musicid: 12345, musickey: 'old', refreshKey: 'rk1', refreshToken: 'rt1', loginType: 2,
  musickeyCreateTime: 1_700_000_000, keyExpiresIn: 259200, openId: 'open1', accessToken: 'access1', expiredIn: 1_700_100_000,
};
const cookie = 'uin=o12345; qm_keyst=old';
const refreshed = { code: 0, req: { code: 0, data: { musicid: 12345, musickey: 'new', refresh_key: 'rk2', refresh_token: 'rt2' } } };
const expired = { code: 500001 };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); });

describe('QQ credential refresh', () => {
  it('spends the refresh token once when the host schedule and an expired request overlap', async () => {
    const secrets: Record<string, string> = { credential: JSON.stringify(credential), cookie };
    const writeSecrets = vi.fn((entries: Record<string, string>) => { Object.assign(secrets, entries); });
    const exchanges: Array<(response: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => String(init?.body).includes('LoginServer')
      ? new Promise<Response>(resolve => { exchanges.push(resolve); })
      : Promise.resolve(json(expired))));
    const plugin = createPlugin({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      readSecret: name => secrets[name] ?? '', writeSecrets });

    const scheduled = plugin.invoke('qq-login-refresh', [credential, cookie]);
    const request = plugin.provider.searchMusic('x').catch(error => error as Error);
    await vi.waitFor(() => { expect(exchanges).toHaveLength(1); });
    // Give the expired request time to reach the refresh path before the exchange settles.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(exchanges).toHaveLength(1);
    exchanges[0]!(json(refreshed));

    await expect(scheduled).resolves.toMatchObject({ success: true, credential: { musickey: 'new', refreshKey: 'rk2' } });
    await request;
    expect(exchanges).toHaveLength(1);
    expect(writeSecrets).toHaveBeenCalledTimes(1);
    expect(secrets['cookie']).toContain('qm_keyst=new');
  });
});
