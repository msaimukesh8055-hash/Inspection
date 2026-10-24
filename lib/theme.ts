// lib/theme.ts
// Dark, neutral palette and spacing shared by every screen.

export const colors = {
  background: '#0F1115',
  surface: '#1A1D23',
  border: '#2A2E36',
  text: '#E6E8EB',
  textMuted: '#9AA0A8',
  accent: '#4C8DFF',
} as const;

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
} as const;

/** Minimum height for anything tappable, per the spec's "large touch targets". */
export const TOUCH_TARGET = 56;
