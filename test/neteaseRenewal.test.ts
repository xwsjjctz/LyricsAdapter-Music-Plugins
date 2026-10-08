import { describe, expect, it, vi } from 'vitest';
import { createCookieRenewal, mergeSetCookies } from '../src/netease/renewal';
import { NetEaseMusicAPI } from '../src/netease/provider';
import type { NetEaseRawResult } from '../src/netease/requests';
import { context } from './context';

const DAY = 24 * 60 * 60 * 1000;
const rotated: NetEaseRawResult = { success: true, data: { code: 200 }, setCookies: [
  'MUSIC_U=new; Max-Age=15552000; Path=/; HttpOnly', '__csrf=csrf2; Path=/', 'MUSIC_A_T=; Max-Age=0; Path=/',
] };
function fixture(secrets: Record<string, string>, request: (cookie: string) => Promise<NetEaseRawResult>) {
  const clock = { now: 10 * DAY };
  const writeSecrets = vi.fn((entries: Record<string, string>) => { Object.assign(secrets, entries); });
  const host = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, readSecret: (name: string) => secrets[name] ?? '', writeSecrets };
  return { clock, writeSecrets, secrets, renewal: createCookieRenewal(host, request, () => clock.now) };
}

describe('NetEase login renewal', () => {
  it('merges rotated cookies, drops cleared ones and keeps unrelated entries', () => {
    expect(mergeSetCookies('os=pc; MUSIC_U=old; MUSIC_A_T=stale; __csrf=csrf1', rotated.setCookies))
      .toBe('os=pc; MUSIC_U=new; __csrf=csrf2');
    expect(mergeSetCookies('MUSIC_U=a=b', [])).toBe('MUSIC_U=a=b');
  });
  it('stores the rotated cookie once for overlapping renewals', async () => {
    const request = vi.fn(async () => rotated);
    const { renewal, secrets, writeSecrets } = fixture({ cookie: 'MUSIC_U=old; __csrf=csrf1' }, request);
    await expect(Promise.all([renewal.renew(), renewal.renew()])).resolves.toEqual([true, true]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('MUSIC_U=old; __csrf=csrf1');
    expect(writeSecrets).toHaveBeenCalledTimes(1);
    expect(secrets).toEqual({ cookie: 'MUSIC_U=new; __csrf=csrf2', 'renewal-checked-at': String(10 * DAY) });
  });
  it('renews in the background once a day and never without a stored login', async () => {
    const request = vi.fn(async () => rotated);
    const anonymous = fixture({}, request);
    anonymous.renewal.renewIfDue();
    expect(request).not.toHaveBeenCalled();

    const { renewal, clock, writeSecrets } = fixture({ cookie: 'MUSIC_U=old' }, request);
    renewal.renewIfDue(); renewal.renewIfDue();
    await vi.waitFor(() => { expect(writeSecrets).toHaveBeenCalledTimes(1); });
    expect(request).toHaveBeenCalledTimes(1);
    clock.now += DAY - 1; renewal.renewIfDue();
    expect(request).toHaveBeenCalledTimes(1);
    clock.now += 1; renewal.renewIfDue();
    await vi.waitFor(() => { expect(request).toHaveBeenCalledTimes(2); });
  });
  it('keeps the cookie and stops asking for a day when the session is rejected', async () => {
    const request = vi.fn(async (): Promise<NetEaseRawResult> => ({ success: true, data: { code: 301 }, setCookies: ['MUSIC_U=; Max-Age=0'] }));
    const { renewal, secrets, clock } = fixture({ cookie: 'MUSIC_U=old' }, request);
    await expect(renewal.renew()).resolves.toBe(false);
    expect(secrets['cookie']).toBe('MUSIC_U=old');
    clock.now += 60 * 60 * 1000; renewal.renewIfDue();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('retries a failed transport after the attempt spacing instead of waiting a day', async () => {
    const request = vi.fn(async (): Promise<NetEaseRawResult> => ({ success: false, error: 'offline' }));
    const { renewal, writeSecrets, clock } = fixture({ cookie: 'MUSIC_U=old' }, request);
    await expect(renewal.renew()).resolves.toBe(false);
    renewal.renewIfDue();
    expect(request).toHaveBeenCalledTimes(1);
    clock.now += 10 * 60 * 1000; renewal.renewIfDue();
    await vi.waitFor(() => { expect(request).toHaveBeenCalledTimes(2); });
    expect(writeSecrets).not.toHaveBeenCalled();
  });
  it('does not overwrite a login that changed while the renewal was pending', async () => {
    const secrets: Record<string, string> = { cookie: 'MUSIC_U=old' };
    const { renewal, writeSecrets } = fixture(secrets, async () => { secrets['cookie'] = 'MUSIC_U=relogin'; return rotated; });
    await expect(renewal.renew()).resolves.toBe(false);
    expect(writeSecrets).not.toHaveBeenCalled();
    expect(secrets['cookie']).toBe('MUSIC_U=relogin');
  });
});

describe('NetEase request retry', () => {
  const api = (neteaseRequest: ReturnType<typeof vi.fn>, refresh: () => Promise<boolean>, hasCookie = true) => new NetEaseMusicAPI(context({
    refresh, bridge: { neteaseRequest },
    cookie: { hasCookie: () => hasCookie, getCookie: () => (hasCookie ? 'MUSIC_U=old' : ''), parseCookie: () => ({}), ensureLoaded: async () => {} },
  }));
  it('renews a lapsed login and retries the request once', async () => {
    const neteaseRequest = vi.fn()
      .mockResolvedValueOnce({ success: true, data: { code: 301 } })
      .mockResolvedValueOnce({ success: true, data: { code: 200, result: { songs: [] } } });
    const refresh = vi.fn(async () => true);
    await expect(api(neteaseRequest, refresh).searchMusic('x')).resolves.toEqual([]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(neteaseRequest).toHaveBeenCalledTimes(2);
  });
  it('does not attempt a renewal for anonymous use', async () => {
    const neteaseRequest = vi.fn().mockResolvedValue({ success: true, data: { code: 301 } });
    const refresh = vi.fn(async () => true);
    await api(neteaseRequest, refresh, false).searchMusic('x').catch(() => undefined);
    expect(refresh).not.toHaveBeenCalled();
    expect(neteaseRequest).toHaveBeenCalledTimes(1);
  });
});
