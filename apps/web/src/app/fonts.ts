import localFont from 'next/font/local';

// Fonts are self-hosted from src/fonts (no request to Google at build time).
// English: DM Sans. Arabic: IBM Plex Sans Arabic (Latin text inside Arabic falls back to DM Sans).

export const dmSans = localFont({
  src: [
    {
      path: '../fonts/dm-sans-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/dm-sans-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-dm',
  display: 'swap',
});

export const plexArabic = localFont({
  src: [
    {
      path: '../fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-plex',
  display: 'swap',
});
