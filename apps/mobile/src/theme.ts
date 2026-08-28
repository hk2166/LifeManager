import { Platform } from 'react-native';

// Canvas UI–inspired monochrome system: a black canvas, white ink, neutral grays,
// and a single restrained red for what's urgent. No color as decoration, no emoji.
export const C = {
  bg: '#000000',
  panel: '#0e0e0e', // near-black cards, defined by hairline borders not fill
  panel2: '#1a1a1a', // pressed / elevated
  border: 'rgba(255,255,255,0.14)',
  hairline: 'rgba(255,255,255,0.08)',
  text: '#fafafa',
  muted: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.32)',
  accent: '#ffffff', // white is the accent
  onAccent: '#000000', // ink on a white surface
  danger: '#ff5f56', // overdue / recording — the one semantic color
  dangerBg: 'rgba(255,95,86,0.14)',
  green: '#fafafa', // success reads as ink, not green
  rec: '#ff5f56',
  fill: 'rgba(255,255,255,0.08)',
  fill2: 'rgba(255,255,255,0.16)',
  chipBg: 'rgba(255,255,255,0.08)',
  chipText: '#fafafa',
};

// Monospace for technical micro-labels and markers — the Canvas UI signature.
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
