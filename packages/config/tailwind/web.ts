import baseConfig from './index.ts';
import type { Config } from 'tailwindcss';

const webConfig: Config = {
  ...baseConfig,
  content: [
    '../../apps/web/src/**/*.{ts,tsx}',
    '../../apps/web/app/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default webConfig;