import { getUserFromSession } from './user';
import { allMenuItems } from './menu-items';
import { redirect } from 'next/navigation';
import type { Permissions } from './types';

export const PermissionSets = ['read', 'create', 'update', 'delete', 'approve'] as const;
export type PermissionSet = typeof PermissionSets[number];

function pascalOrCamelToKebab(name: string) {
  if (!name) return name;
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

export function entityTypeToPermissionKeys(entityType: string) {
  const kebab = pascalOrCamelToKebab(entityType || '');
  const flat = (entityType || '').toLowerCase();
  const keys = [kebab, flat];

  // common fallbacks
  if (flat.includes('product')) keys.push('products');
  if (flat.includes('provider')) keys.push('providers', 'settings');
  if (flat.includes('tax')) keys.push('tax');
  if (flat.includes('approval') || flat.includes('approvals')) keys.push('approvals');

  // include UI menu-based modules
  keys.push(...allMenuItems.map(i => i.label.toLowerCase().replace(/\s+/g, '-')));

  // unique
  return Array.from(new Set(keys));
}

export function hasPermission(user: { permissions?: Permissions }, moduleKey: string, action: PermissionSet) {
  if (!user) return false;
  const perms = user.permissions || {};
  const key = moduleKey?.toLowerCase();
  return !!perms?.[key]?.[action];
}

export function hasPermissionForEntity(user: { permissions?: Permissions }, entityType: string, action: PermissionSet) {
  const keys = entityTypeToPermissionKeys(entityType);
  for (const k of keys) {
    if (hasPermission(user, k, action)) return true;
  }
  return false;
}

export async function requireServerPermission(moduleName?: string, action: PermissionSet = 'read') {
  const user = await getUserFromSession();
  if (!user?.id) {
    redirect('/admin/login');
  }

  if (!moduleName) return;

  const allowed = !!user.permissions?.[moduleName]?.[action];
  if (!allowed) {
    redirect('/admin/forbidden');
  }
}
