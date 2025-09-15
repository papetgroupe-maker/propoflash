// /api/index.ts  (Vercel – Node/TypeScript)
// Petit health-check compatible Node. Aucun Deno ici.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    name: 'PropoFlash API',
    endpoints: ['/api/chat'],
    runtime: 'vercel-node',
  });
}
