import React from 'react';
import AdminLayoutClient from './AdminLayoutClient';
import type { AppPermissions } from '@/lib/permissions/types';

interface AdminLayoutProps {
  children: React.ReactNode;
  permissions?: AppPermissions;
}

export default function AdminLayout({ children, permissions }: AdminLayoutProps) {
  return <AdminLayoutClient permissions={permissions}>{children}</AdminLayoutClient>;
}
