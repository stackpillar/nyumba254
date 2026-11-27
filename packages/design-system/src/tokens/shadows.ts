/**
 * Nyumba254 Design Tokens - Shadows & Elevation
 */

export const shadows = {
  // Elevation levels
  level0: 'none',
  level1: '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(15,110,86,0.07)',
  level2: '0 4px 12px rgba(15,26,22,0.08), 0 8px 24px rgba(15,26,22,0.1)',
  level3: '0 8px 24px rgba(15,26,22,0.12), 0 16px 32px rgba(15,26,22,0.14)',
  level4: '0 12px 36px rgba(15,26,22,0.18), 0 24px 48px rgba(15,26,22,0.2)',

  // Component-specific
  card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(15,110,86,0.07)',
  cardHover: '0 12px 36px rgba(15,110,86,0.22)',
  cardActive: '0 2px 8px rgba(15,110,86,0.15)',
  cardFocus: '0 0 0 2px #FFFFFF, 0 0 0 4px #0F6E56',

  modal: '0 24px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.08)',
  modalMobile: '0 16px 48px rgba(0,0,0,0.2)',

  dropdown: '0 12px 32px rgba(0,0,0,0.18)',
  dropdownMobile: '0 8px 24px rgba(0,0,0,0.15)',

  toast: '0 8px 24px rgba(0,0,0,0.2)',
  toastMobile: '0 8px 32px rgba(0,0,0,0.25)',

  input: '0 0 0 2px #0F6E56',
  inputFocus: '0 0 0 2px #FFFFFF, 0 0 0 4px #0F6E56',

  button: '0 4px 14px rgba(15,110,86,0.35)',
  buttonHover: '0 6px 20px rgba(15,110,86,0.4)',
  buttonActive: '0 1px 4px rgba(15,110,86,0.3)',

  floating: '0 4px 20px rgba(0,0,0,0.15)',
  floatingLarge: '0 8px 32px rgba(0,0,0,0.2)',

  // Inner shadows
  inner: 'inset 0 2px 4px rgba(0,0,0,0.06)',
  innerStrong: 'inset 0 4px 8px rgba(0,0,0,0.1)',

  // Focus ring (accessible)
  focusRing: '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary))',
  focusRingInset: 'inset 0 0 0 2px hsl(var(--primary))',
} as const;

export type Shadows = typeof shadows;