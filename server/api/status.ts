import { runAIStatus } from '../aiHandlers.ts';

export default async function handler(_req: any, res: any) {
  const result = await runAIStatus();
  res.status(result.status).json(result.body);
}
