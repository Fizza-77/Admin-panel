import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase/server';

type SuccessResponse = {
  success: true;
  message: string;
};

type ErrorResponse = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const token = req.cookies.admin_session;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { siteId, blogId } = req.query;

  if (typeof siteId !== 'string' || typeof blogId !== 'string') {
    return res.status(400).json({ message: 'Invalid route parameters' });
  }

  const { data, error } = await supabase
    .from('blogs')
    .delete()
    .eq('id', blogId)
    .eq('site_id', siteId)
    .select('id');

  if (error) {
    console.error('Error deleting blog:', error);
    return res.status(500).json({ message: 'Failed to delete blog' });
  }

  if (!data || data.length === 0) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  return res.status(200).json({
    success: true,
    message: 'Blog deleted successfully',
  });
}
