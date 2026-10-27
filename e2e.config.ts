import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

export default {
  targets: [
    {
      name: 'web',
      engine: web(),
      app: {
        url: 'http://localhost:5173',
      },
    },
    {
      name: 'ios',
      engine: web({
        viewport: { width: 390, height: 844 },
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      }),
      app: {
        url: 'http://localhost:5173',
      },
    },
  ],
} satisfies E2EConfig;
