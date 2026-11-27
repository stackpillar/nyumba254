import baseConfig from './index.ts';
import type { Config } from 'tailwindcss';

const nativeConfig: Config = {
  ...baseConfig,
  content: [
    '../../apps/mobile/app/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  // NativeWind doesn't support all CSS features, so we disable some
  corePlugins: {
    ...baseConfig.corePlugins,
    preflight: false,
  },
};

export default nativeConfig;