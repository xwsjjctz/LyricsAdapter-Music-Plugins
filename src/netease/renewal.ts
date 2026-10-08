import type { PluginHost } from '../sdk';
import type { NetEaseRawResult } from './requests';

/** How often a stored login is extended; NetEase sessions outlive this by a wide margin. */
const RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Minimum spacing between attempts so a dead session or an offline device is not hammered. */
const MIN_ATTEMPT_INTERVAL_MS = 10 * 60 * 1000;
/** Epoch ms of the last renewal NetEase answered, stored next to the cookie. */
const CHECKED_AT = 'renewal-checked-at';

/** Apply `Set-Cookie` header values to a `k=v; k=v` cookie string, keeping unrelated entries. */
export function mergeSetCookies(cookie: string, setCookies: string[] = []): string {
  const jar = new Map<string, string>();
  const put = (pair: string | undefined) => {
    const index = pair?.indexOf('=') ?? -1;
    if (!pair || index <= 0) return;
    const [name, value] = [pair.slice(0, index).trim(), pair.slice(index + 1).trim()];
    // An empty value is a deletion (e.g. clearing a stale token), not a new credential.
    if (value) jar.set(name, value); else jar.delete(name);
  };
  for (const pair of cookie.split(/;\s*/)) put(pair);
  for (const header of setCookies) put(header.split(';')[0]);
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

export interface CookieRenewal {
  /** Extend the stored login now. Resolves true only when NetEase confirmed the session. */
  renew(): Promise<boolean>;
  /** Start a background renewal when the stored login has not been extended recently. */
  renewIfDue(): void;
}

export function createCookieRenewal(
  host: PluginHost,
  request: (cookie: string) => Promise<NetEaseRawResult>,
  now: () => number = Date.now
): CookieRenewal {
  let inFlight: Promise<boolean> | null = null;
  let lastAttempt = Number.NEGATIVE_INFINITY;

  const exchange = async (): Promise<boolean> => {
    const cookie = host.readSecret('cookie');
    if (!cookie) return false;
    const result = await request(cookie);
    // A transport failure says nothing about the session; try again after the attempt spacing.
    if (!result.success) return false;
    // The user logged in again or out while the request was pending: keep their cookie.
    if (host.readSecret('cookie') !== cookie) return false;
    const confirmed = (result.data as { code?: number } | undefined)?.code === 200;
    const renewed = confirmed ? mergeSetCookies(cookie, result.setCookies) : cookie;
    host.writeSecrets({ [CHECKED_AT]: String(now()), ...(renewed !== cookie ? { cookie: renewed } : {}) });
    if (!confirmed) host.logger.warn('[NetEase] Login renewal was rejected; a new QR login may be needed');
    return confirmed;
  };

  const renew = (): Promise<boolean> => {
    if (inFlight) return inFlight;
    if (now() - lastAttempt < MIN_ATTEMPT_INTERVAL_MS) return Promise.resolve(false);
    lastAttempt = now();
    inFlight = exchange()
      .catch(error => { host.logger.warn('[NetEase] Login renewal failed', error); return false; })
      .finally(() => { inFlight = null; });
    return inFlight;
  };

  return {
    renew,
    renewIfDue: () => {
      if (!host.readSecret('cookie')) return;
      const checkedAt = Number(host.readSecret(CHECKED_AT)) || 0;
      if (now() - checkedAt >= RENEW_INTERVAL_MS) void renew();
    },
  };
}
