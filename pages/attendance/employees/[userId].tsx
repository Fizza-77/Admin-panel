import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const userId = context.params?.userId;
  const destination =
    typeof userId === 'string'
      ? `/employees/${encodeURIComponent(userId)}`
      : '/employees';

  return {
    redirect: { destination, permanent: true },
  };
};

export default function AttendanceEmployeeRedirect() {
  return null;
}
