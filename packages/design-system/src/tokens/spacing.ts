/**
 * Nyumba254 Design Tokens - Spacing
 * Consistent spacing scale across all platforms
 */

export const spacing = {
  // Base unit: 4px
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',  // Touch target minimum
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',

  // Semantic spacing
  semantic: {
    none: '0',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
    '4xl': '96px',

    // Component-specific
    cardPadding: '16px',
    cardPaddingSm: '12px',
    cardGap: '16px',
    sectionPadding: '48px',
    sectionPaddingMobile: '28px',
    containerPadding: '16px',
    containerPaddingLg: '32px',
    navHeight: '64px',
    tabBarHeight: '78px',
    modalPadding: '24px',
    toastGap: '12px',
  },

  // Layout
  layout: {
    maxWidth: '1200px',
    container: 'clamp(16px, 4vw, 32px)',
    gutter: '20px',
    gutterSm: '14px',
    gutterXs: '10px',
  },
} as const;

export type Spacing = typeof spacing;