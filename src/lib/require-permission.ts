import { getUserFromSession } from './user';
import { allMenuItems } from './menu-items';
import { redirect } from 'next/navigation';

export async function requireServerPermission(moduleName?: string) {
  const user = await getUserFromSession();
  if (!user?.id) {
    redirect('/admin/login');
  }

  if (!moduleName) return;

  const has = !!user.permissions?.[moduleName]?.read;
  if (!has) {
    redirect('/admin/forbidden');
  }
}
