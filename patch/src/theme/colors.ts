/**
 * Patch colour palette: eucalyptus green, warm sand and off-white.
 * Every colour has a light and a dark version so the app follows the
 * phone's dark mode setting.
 */
export const palette = {
  light: {
    background: '#FAF7F0', // off-white
    surface: '#FFFFFF',
    sand: '#F1E7D3', // warm sand
    sandStrong: '#E4D4B4',
    primary: '#3E6B58', // eucalyptus green
    onPrimary: '#FFFFFF',
    primarySoft: '#DFEBE3',
    onPrimarySoft: '#21413A',
    text: '#1E2823',
    textMuted: '#55625A',
    border: '#DDD3C0',
    danger: '#B3261E',
    onDanger: '#FFFFFF',
    dangerSoft: '#FCE8E6',
    onDangerSoft: '#6E140E',
    warningSoft: '#FFF3D1',
    onWarningSoft: '#5C4300',
    tabBar: '#FFFFFF',
    shadow: 'rgba(30, 40, 35, 0.08)',
  },
  dark: {
    background: '#111613',
    surface: '#1A211D',
    sand: '#2B261D',
    sandStrong: '#3A3326',
    primary: '#93C2AB',
    onPrimary: '#0D1A14',
    primarySoft: '#21332B',
    onPrimarySoft: '#CFE6DA',
    text: '#ECEFEA',
    textMuted: '#AAB5AE',
    border: '#2E3832',
    danger: '#F2B8B5',
    onDanger: '#3B0A07',
    dangerSoft: '#3D1C1A',
    onDangerSoft: '#FADCD9',
    warningSoft: '#3A3117',
    onWarningSoft: '#F2DE9E',
    tabBar: '#161C19',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type Palette = { [K in keyof typeof palette.light]: string };
