/**
 * Nyumba254 Design Tokens - Animation & Motion
 * Respects prefers-reduced-motion
 */

export const animation = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },

  // Easings
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.7, 0, 0.84, 0)',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    springGentle: 'cubic-bezier(0.25, 1.5, 0.5, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Keyframes (for CSS-in-JS or CSS modules)
  keyframes: {
    fadeIn: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    fadeOut: {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    slideUp: {
      from: { opacity: 0, transform: 'translateY(10px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    slideDown: {
      from: { opacity: 0, transform: 'translateY(-10px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    slideLeft: {
      from: { opacity: 0, transform: 'translateX(10px)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
    slideRight: {
      from: { opacity: 0, transform: 'translateX(-10px)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
    scaleIn: {
      from: { opacity: 0, transform: 'scale(0.95)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    scaleOut: {
      from: { opacity: 1, transform: 'scale(1)' },
      to: { opacity: 0, transform: 'scale(0.95)' },
    },
    shimmer: {
      from: { backgroundPosition: '200% 0' },
      to: { backgroundPosition: '-200% 0' },
    },
    pulseSoft: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.6 },
    },
    spin: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' },
    },
    wiggle: {
      '0%, 100%': { transform: 'rotate(-3deg)' },
      '50%': { transform: 'rotate(3deg)' },
    },
    shake: {
      '0%, 100%': { transform: 'translateX(0)' },
      '25%': { transform: 'translateX(-4px)' },
      '75%': { transform: 'translateX(4px)' },
    },
  },

  // Preset animations
  presets: {
    // Entrance
    enter: {
      modal: { animation: 'slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
      dropdown: { animation: 'slideDown 200ms cubic-bezier(0.16, 1, 0.3, 1)' },
      toast: { animation: 'slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
      tooltip: { animation: 'scaleIn 150ms cubic-bezier(0.16, 1, 0.3, 1)' },
      card: { animation: 'fadeIn 200ms ease-out, slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
      page: { animation: 'fadeIn 300ms ease-out' },
      listItem: { animation: 'slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
    },

    // Exit
    exit: {
      modal: { animation: 'scaleOut 200ms ease-in' },
      dropdown: { animation: 'fadeOut 150ms ease-in' },
      toast: { animation: 'slideDown 200ms ease-in' },
      tooltip: { animation: 'scaleOut 100ms ease-in' },
      card: { animation: 'fadeOut 150ms ease-in' },
    },

    // Interactions
    interaction: {
      buttonPress: { animation: 'scaleIn 100ms ease-out' },
      buttonHover: { transition: 'transform 150ms ease-out, box-shadow 150ms ease-out' },
      cardHover: { transition: 'transform 200ms ease-out, box-shadow 200ms ease-out' },
      linkHover: { transition: 'color 150ms ease-out' },
      inputFocus: { transition: 'box-shadow 150ms ease-out, border-color 150ms ease-out' },
      tabSwitch: { transition: 'color 150ms ease-out, background-color 150ms ease-out' },
      checkboxToggle: { animation: 'scaleIn 150ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
      switchToggle: { transition: 'background-color 200ms ease-out, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
    },

    // Loading states
    loading: {
      skeleton: { animation: 'shimmer 1.4s infinite linear' },
      spinner: { animation: 'spin 1s linear infinite' },
      pulse: { animation: 'pulseSoft 2s infinite ease-in-out' },
      dots: { animation: 'pulseSoft 1.4s infinite ease-in-out' },
    },

    // Feedback
    feedback: {
      success: { animation: 'scaleIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
      error: { animation: 'shake 400ms ease-in-out' },
      warning: { animation: 'wiggle 500ms ease-in-out' },
      notification: { animation: 'slideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' },
    },
  },

  // Reduced motion fallbacks
  reducedMotion: {
    duration: '0.01ms',
    animation: 'none',
    transition: 'none',
  },
} as const;

export type Animation = typeof animation;