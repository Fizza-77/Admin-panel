import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const body = req.body ?? {};
    console.error('Client runtime error', {
      error: body.error ?? null,
      context: body.context ?? null,
      userAgent: req.headers['user-agent'] ?? 'unknown',
      url: req.headers.referer ?? 'unknown',
    });
  } catch (error) {
    console.error('Failed to parse client error payload', error);
  }

  return res.status(200).json({ success: true });
}
