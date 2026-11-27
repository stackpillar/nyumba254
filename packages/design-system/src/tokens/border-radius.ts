/**
 * Nyumba254 Design Tokens - Border Radius
 */

export const borderRadius = {
  none: '0',
  xs: '4px',
  sm: '6px',
  md: '10px',   // Default --radius
  lg: '16px',   // Default --radius-lg
  xl: '20px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',

  // Component-specific
  card: '16px',
  cardSm: '14px',
  button: '10px',
  buttonSm: '8px',
  input: '8px',
  select: '8px',
  badge: '20px',
  chip: '22px',
  pill: '9999px',
  modal: '16px',
  avatar: '50%',
  toast: '10px',
  dropdown: '12px',
} as const;

export type BorderRadius = typeof borderRadius;