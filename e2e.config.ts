import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

export default {
  targets: [
    {
      engine: web(),
      app: {
        url: 'http://localhost:5173',
      },
    },
  ],
} satisfies E2EConfig;
