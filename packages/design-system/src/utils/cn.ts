/**
 * Utility to merge class names with Tailwind
 * Similar to clsx + tailwind-merge
 */

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Creates a variant-based className generator
 * Usage: const buttonVariants = cva('base-classes', { variants: { size: { sm: 'px-2', md: 'px-4' } } })
 */
export function cva(
  base: string,
  config?: {
    variants?: Record<string, Record<string, string>>;
    compoundVariants?: Array<{ class: string; [key: string]: string }>;
    defaultVariants?: Record<string, string>;
  }
) {
  return (props?: Record<string, unknown>) => {
    let className = base;

    if (config?.variants && props) {
      for (const [variantKey, variantMap] of Object.entries(config.variants)) {
        const value = props[variantKey] as string;
        if (value && variantMap[value]) {
          className += ` ${variantMap[value]}`;
        }
      }
    }

    if (config?.compoundVariants && props) {
      for (const compound of config.compoundVariants) {
        const matches = Object.entries(compound).every(
          ([key, value]) => key !== 'class' && props[key] === value
        );
        if (matches) {
          className += ` ${compound.class}`;
        }
      }
    }

    if (config?.defaultVariants) {
      for (const [variantKey, defaultValue] of Object.entries(config.defaultVariants)) {
        if (!props || props[variantKey] === undefined) {
          const variantMap = config.variants?.[variantKey];
          if (variantMap && variantMap[defaultValue]) {
            className += ` ${variantMap[defaultValue]}`;
          }
        }
      }
    }

    return className;
  };
}