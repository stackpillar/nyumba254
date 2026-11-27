/**
 * Nyumba254 Design Tokens - Colors
 * Single source of truth for all color values across web and mobile
 */

export const colors = {
  // Brand colors
  green: {
    50: '#E1F5EE',
    100: '#B8E9D6',
    200: '#8FDDBD',
    300: '#66D1A4',
    400: '#3DC58B',
    500: '#1D9E75',
    600: '#0F6E56',  // Primary brand
    700: '#0C5845',
    800: '#094234',
    900: '#062C23',
    950: '#031611',
  },
  gold: {
    50: '#FAEEDA',
    100: '#F5DDB5',
    200: '#EBBB90',
    300: '#E1996B',
    400: '#D77746',
    500: '#BA7517',
    600: '#965E12',
    700: '#72470D',
    800: '#4E3009',
    900: '#2A1804',
  },
  purple: {
    50: '#EDE9FE',
    100: '#DDD6FE',
    200: '#C4B5FD',
    300: '#A78BFA',
    400: '#8B5CF6',
    500: '#7C3AED',  // Elite/Premium
    600: '#6D28D9',
    700: '#5B21B6',
    800: '#4C1D95',
    900: '#3E1A78',
  },

  // Semantic colors (CSS variables)
  semantic: {
    // Light mode
    light: {
      background: '#FFFFFF',
      foreground: '#1A1A18',
      card: '#FFFFFF',
      'card-foreground': '#1A1A18',
      popover: '#FFFFFF',
      'popover-foreground': '#1A1A18',
      primary: '#0F6E56',
      'primary-foreground': '#FFFFFF',
      secondary: '#F7F6F2',
      'secondary-foreground': '#1A1A18',
      muted: '#F7F6F2',
      'muted-foreground': '#6B6A63',
      accent: '#E1F5EE',
      'accent-foreground': '#085041',
      destructive: '#C53030',
      'destructive-foreground': '#FFFFFF',
      border: '#E0DED8',
      input: '#E0DED8',
      ring: '#0F6E56',
      surface: '#F7F6F2',
      'text-primary': '#1A1A18',
      'text-secondary': '#4A4A46',
      'text-tertiary': '#6B6A63',
      'text-inverse': '#FFFFFF',
    },
    // Dark mode
    dark: {
      background: '#0F1412',
      foreground: '#F7F6F2',
      card: '#161D1A',
      'card-foreground': '#F7F6F2',
      popover: '#161D1A',
      'popover-foreground': '#F7F6F2',
      primary: '#3DC58B',
      'primary-foreground': '#062C23',
      secondary: '#161D1A',
      'secondary-foreground': '#F7F6F2',
      muted: '#161D1A',
      'muted-foreground': '#888780',
      accent: '#085041',
      'accent-foreground': '#E1F5EE',
      destructive: '#E06B6B',
      'destructive-foreground': '#FFFFFF',
      border: '#2A3430',
      input: '#2A3430',
      ring: '#3DC58B',
      surface: '#161D1A',
      'text-primary': '#F7F6F2',
      'text-secondary': '#C4C3BB',
      'text-tertiary': '#888780',
      'text-inverse': '#0F1412',
    },
  },

  // Role-based colors
  roles: {
    owner: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    caretaker: { bg: '#EDE9FE', text: '#4C1D95', border: '#C4B5FD' },
    agent: { bg: '#FAEEDA', text: '#72470D', border: '#EBBB90' },
    company: { bg: '#1A1A18', text: '#FFFFFF', border: '#4A4A46' },
    buyer: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
  },

  // Category colors
  categories: {
    apartment: { bg: '#0F6E56', text: '#FFFFFF', lightBg: '#E1F5EE', lightText: '#085041' },
    house: { bg: '#085041', text: '#FFFFFF', lightBg: '#B8E9D6', lightText: '#062C23' },
    boarding: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    airbnb: { bg: '#FFFFFF', text: '#085041', border: '#0F6E56' },
    commercial: { bg: '#1A1A18', text: '#FFFFFF', lightBg: '#4A4A46', lightText: '#F7F6F2' },
  },

  // Status colors
  status: {
    active: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    pending: { bg: '#FAEEDA', text: '#72470D', border: '#EBBB90' },
    scheduled: { bg: '#EDE9FE', text: '#4C1D95', border: '#C4B5FD' },
    expired: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
    occupied: { bg: '#EDE9FE', text: '#4C1D95', border: '#C4B5FD' },
    disabled: { bg: '#F5F4F0', text: '#888780', border: '#E0DED8' },
    draft: { bg: '#F7F6F2', text: '#6B6A63', border: '#E0DED8' },
  },

  // Fee colors
  fee: {
    free: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    paid: { bg: '#FAEEDA', text: '#72470D', border: '#EBBB90' },
  },

  // Verification colors
  verification: {
    verified: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    pending: { bg: '#FAEEDA', text: '#72470D', border: '#EBBB90' },
    rejected: { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
    notStarted: { bg: '#F7F6F2', text: '#6B6A63', border: '#E0DED8' },
  },
} as const;

export type Colors = typeof colors;