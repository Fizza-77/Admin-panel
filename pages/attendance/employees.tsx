import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/employees', permanent: true },
});

export default function AttendanceEmployeesRedirect() {
  return null;
}
