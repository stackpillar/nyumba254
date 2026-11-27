/**
 * Nyumba254 Design Tokens - Typography
 * Unified type scale for web and mobile
 */

export const typography = {
  fontFamily: {
    sans: {
      name: 'Inter',
      fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      weights: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
      },
      variable: '--font-sans',
    },
    serif: {
      name: 'Playfair Display',
      fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      weights: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      variable: '--font-serif',
    },
    mono: {
      name: 'JetBrains Mono',
      fallback: ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'monospace'],
      weights: {
        regular: 400,
        medium: 500,
      },
      variable: '--font-mono',
    },
  },

  // Fluid type scale using clamp()
  fontSize: {
    'display-xl': {
      size: 'clamp(48px, 6vw, 72px)',
      lineHeight: '1.1',
      letterSpacing: '-0.02em',
      weight: 700,
    },
    'display-lg': {
      size: 'clamp(36px, 5vw, 56px)',
      lineHeight: '1.15',
      letterSpacing: '-0.01em',
      weight: 700,
    },
    'display-md': {
      size: 'clamp(28px, 4vw, 42px)',
      lineHeight: '1.2',
      letterSpacing: '0',
      weight: 700,
    },
    'display-sm': {
      size: 'clamp(22px, 3vw, 32px)',
      lineHeight: '1.25',
      letterSpacing: '0',
      weight: 600,
    },
    'heading-lg': {
      size: 'clamp(20px, 2.5vw, 26px)',
      lineHeight: '1.3',
      letterSpacing: '0',
      weight: 600,
    },
    'heading-md': {
      size: 'clamp(18px, 2vw, 22px)',
      lineHeight: '1.35',
      letterSpacing: '0',
      weight: 600,
    },
    'heading-sm': {
      size: 'clamp(16px, 1.5vw, 18px)',
      lineHeight: '1.4',
      letterSpacing: '0',
      weight: 600,
    },
    'body-lg': {
      size: '16px',
      lineHeight: '1.6',
      letterSpacing: '0',
      weight: 400,
    },
    'body-md': {
      size: '15px',
      lineHeight: '1.6',
      letterSpacing: '0',
      weight: 400,
    },
    'body-sm': {
      size: '14px',
      lineHeight: '1.55',
      letterSpacing: '0',
      weight: 400,
    },
    'caption': {
      size: '13px',
      lineHeight: '1.5',
      letterSpacing: '0',
      weight: 400,
    },
    'caption-sm': {
      size: '12px',
      lineHeight: '1.45',
      letterSpacing: '0',
      weight: 400,
    },
    'micro': {
      size: '11px',
      lineHeight: '1.4',
      letterSpacing: '0',
      weight: 400,
    },
  },

  // Semantic text styles
  semantic: {
    // Headings
    h1: 'display-lg',
    h2: 'display-md',
    h3: 'display-sm',
    h4: 'heading-lg',
    h5: 'heading-md',
    h6: 'heading-sm',

    // Body
    'body-large': 'body-lg',
    'body-medium': 'body-md',
    'body-small': 'body-sm',

    // UI
    'button-large': 'body-lg',
    'button-medium': 'body-md',
    'button-small': 'body-sm',
    'label': 'caption',
    'label-small': 'caption-sm',
    'overline': 'micro',

    // Special
    'price-large': { ...typography.fontSize['display-md'], weight: 700 },
    'price-medium': { ...typography.fontSize['heading-lg'], weight: 700 },
    'price-small': { ...typography.fontSize['body-lg'], weight: 600 },
    'stat-value': { ...typography.fontSize['display-sm'], weight: 700 },
    'stat-label': { ...typography.fontSize['caption-sm'], weight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  },

  // Line heights
  lineHeight: {
    none: '1',
    tight: '1.1',
    snug: '1.25',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.02em',
    normal: '0',
    wide: '0.02em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const;

export type Typography = typeof typography;