import { describe, expect, it } from 'vitest';
import { servedNetEaseQuality } from '../src/netease/provider';

describe('NetEase served quality', () => {
  it('reads the served container and bitrate rather than trusting the request', () => {
    expect(servedNetEaseQuality({ type: 'flac', br: 999000 }, 'flac')).toBe('flac');
    expect(servedNetEaseQuality({ type: 'mp3', br: 320000 }, 'flac')).toBe('320');
    expect(servedNetEaseQuality({ type: 'MP3', br: 128000 }, 'flac')).toBe('128');
    expect(servedNetEaseQuality({ type: 'm4a', br: 192000 }, '320')).toBe('m4a');
    expect(servedNetEaseQuality({ type: null, br: 0 }, '320')).toBe('320');
  });
});
