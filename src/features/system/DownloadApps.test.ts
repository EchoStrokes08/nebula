import { detectTarget } from './DownloadApps';

describe('detectTarget', () => {
  it('reconoce el sistema de quien visita la web', () => {
    expect(detectTarget('Mozilla/5.0 (Linux; Android 14; 23078PND5G) Mobile Safari/537.36')).toBe('android');
    expect(detectTarget('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140')).toBe('windows');
    expect(detectTarget('Mozilla/5.0 (X11; Linux x86_64) Chrome/140')).toBe('linux');
  });
  it('no destaca ninguna descarga en iPhone ni Mac', () => {
    expect(detectTarget('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBeNull();
    expect(detectTarget('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)')).toBeNull();
  });
});
