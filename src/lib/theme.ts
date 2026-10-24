/** Color tokens mirrored in tailwind.config.js. Use these for non-className props (SVG, gradients). */
export const colors = {
  bg: '#0A0F0C',
  surface: '#121A15',
  surface2: '#1B271F',
  line: '#24352B',
  pitch: '#22C55E',
  pitchDark: '#15803D',
  pitchSoft: '#86EFAC',
  ink: '#F4F8F5',
  muted: '#8DA595',
  gold: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const fonts = {
  display: 'BarlowCondensed_900Black',
  displayBold: 'BarlowCondensed_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

/** Rating → color band used by rings, cards and history rows. */
export function ratingColor(rating: number | null | undefined): string {
  if (rating == null) return colors.muted;
  if (rating >= 85) return colors.gold;
  if (rating >= 70) return colors.pitch;
  if (rating >= 50) return colors.info;
  return colors.danger;
}

export function ratingLabelKey(rating: number | null | undefined): string {
  if (rating == null) return 'rating.unrated';
  if (rating >= 90) return 'rating.elite';
  if (rating >= 80) return 'rating.academy';
  if (rating >= 70) return 'rating.club';
  if (rating >= 55) return 'rating.developing';
  return 'rating.foundation';
}
