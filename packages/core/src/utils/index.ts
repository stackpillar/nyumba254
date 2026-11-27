/**
 * Core Utilities
 */

export const formatPrice = (
  price: number,
  frequency: string,
  category?: string
): string => {
  const freqLabels: Record<string, string> = {
    month: '/mo',
    night: '/night',
    week: '/week',
    term: '/term',
    semester: '/semester',
    once: '',
  };

  const isBoarding = category === 'boarding';
  const prefix = isBoarding ? 'From ' : '';

  return `${prefix}KES ${Number(price || 0).toLocaleString('en-KE')}${freqLabels[frequency] ?? ''}`;
};

export const formatNumber = (num: number): string => {
  return Number(num || 0).toLocaleString('en-KE');
};

export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
};

export const formatRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(d);
};

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const generateListingUrl = (listing: { id: string; listing_number: number }): string => {
  return `/listing?id=${String(listing.listing_number).padStart(6, '0')}`;
};

export const generateListerPageUrl = (handle: string): string => {
  return `/@${handle}`;
};

export const generateListingsUrl = (filters?: Record<string, string>): string => {
  const params = new URLSearchParams(filters);
  return `/listings${params.toString() ? `?${params.toString()}` : ''}`;
};

export const parsePhoneNumber = (phone: string): string => {
  // Normalize Kenyan phone numbers
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return '254' + cleaned.slice(1);
  if (cleaned.length === 9) return '254' + cleaned;
  return cleaned;
};

export const formatPhoneNumber = (phone: string): string => {
  const normalized = parsePhoneNumber(phone);
  if (normalized.length === 12 && normalized.startsWith('254')) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  }
  return phone;
};

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const normalized = parsePhoneNumber(phone);
  return normalized.length === 12 && normalized.startsWith('254');
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const classNames = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};