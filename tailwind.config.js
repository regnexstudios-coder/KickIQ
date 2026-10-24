/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        display: ['BarlowCondensed_900Black'],
        displayBold: ['BarlowCondensed_700Bold'],
        sans: ['Inter_400Regular'],
        sansMedium: ['Inter_500Medium'],
        sansSemi: ['Inter_600SemiBold'],
        sansBold: ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
