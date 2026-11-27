/**
 * Toaster Component
 * Toast notifications for the web app
 */

'use client';

import { useToast } from '@nyumba254/ui';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      expand={false}
      gap={12}
      richColors
      theme="system"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
        },
        success: {
          iconTheme: {
            primary: '#0F6E56',
            secondary: '#FFFFFF',
          },
        },
        error: {
          iconTheme: {
            primary: '#C53030',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}