import { describe, expect, it, vi } from 'vitest';
import { inlineNetEaseCredits } from '../src/netease/lyricCredits';
import { NetEaseMusicAPI } from '../src/netease/provider';
import { context } from './context';

const CREDITS = [
  '{"t":0,"c":[{"tx":"作词: "},{"tx":"赵雷","li":"http://p1.music.126.net/a.jpg","or":"orpheus://nm/artist/home?id=6731&type=artist"}]}',
  '{"t":867,"c":[{"tx":" 制作人: "},{"tx":"刘涛"},{"tx":"/"},{"tx":"李浩瑞"}]}',
].join('\n');

describe('NetEase lyric credits', () => {
  it('rewrites JSON credit lines as YRC lines the word-lyric parser can read', () => {
    const yrc = `${CREDITS}\n[28480,400](28480,160,0)我(28640,240,0)带`;

    expect(inlineNetEaseCredits(yrc, 'yrc')).toBe(
      [
        '[0,867](0,867,0)作词: 赵雷',
        '[867,1000](867,1000,0)制作人: 刘涛/李浩瑞',
        '[28480,400](28480,160,0)我(28640,240,0)带',
      ].join('\n')
    );
  });

  it('rewrites JSON credit lines as LRC lines', () => {
    const lrc = `${CREDITS}\n[00:28.15]我带着比身体重的行李`;

    expect(inlineNetEaseCredits(lrc, 'lrc')).toBe(
      ['[00:00.000]作词: 赵雷', '[00:00.867]制作人: 刘涛/李浩瑞', '[00:28.15]我带着比身体重的行李'].join('\n')
    );
  });

  it('formats LRC timestamps past one minute', () => {
    expect(inlineNetEaseCredits('{"t":225040,"c":[{"tx":"混音: "},{"tx":"某人"}]}', 'lrc')).toBe(
      '[03:45.040]混音: 某人'
    );
  });

  it('never lets a credit line run into the lyric line that follows it', () => {
    const yrc = '{"t":1000,"c":[{"tx":"编曲: "},{"tx":"某人"}]}\n[1300,500](1300,500,0)啊';

    expect(inlineNetEaseCredits(yrc, 'yrc').split('\n')[0]).toBe('[1000,300](1000,300,0)编曲: 某人');
  });

  it('leaves lyrics without credit lines, and malformed JSON lines, untouched', () => {
    const plain = '[00:01.20]第一行\n[00:03.40]第二行';
    expect(inlineNetEaseCredits(plain, 'lrc')).toBe(plain);

    const broken = '{"t":0,"c":[{"tx":"作词: "}\n{"t":"0","c":[]}\n{"c":[{"tx":"x"}]}\n[00:01.20]第一行';
    expect(inlineNetEaseCredits(broken, 'lrc')).toBe(broken);
  });

  it('returns credits in both the LRC and the word-timed lyrics of getLyrics', async () => {
    const neteaseRequest = vi.fn().mockResolvedValue({
      success: true,
      data: {
        code: 200,
        lrc: { lyric: `${CREDITS}\n[00:28.15]我带` },
        yrc: { lyric: `${CREDITS}\n[28480,400](28480,160,0)我(28640,240,0)带` },
      },
    });
    const api = new NetEaseMusicAPI(context({ bridge: { neteaseRequest } }));

    const result = await api.getLyrics('1974443814');

    expect(result?.wordLyricsFormat).toBe('yrc');
    expect(result?.wordLyrics?.split('\n')[0]).toBe('[0,867](0,867,0)作词: 赵雷');
    expect(result?.lyrics.split('\n')[0]).toBe('[00:00.000]作词: 赵雷');
    expect(`${result?.lyrics}${result?.wordLyrics}`).not.toContain('{"t"');
  });
});
