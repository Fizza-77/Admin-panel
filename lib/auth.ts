import { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import jwt from 'jsonwebtoken';

export function requireAuthentication(gssp: any) {
  return async (context: GetServerSidePropsContext) => {
    const cookies = nookies.get(context);
    const token = cookies.admin_session;

    if (!token) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      // If valid, continue to page props
      return await gssp(context);
    } catch (err) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }
  };
}
