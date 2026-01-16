import { checkPermission } from './rbac';
import { Permissions } from './permissions';
import { _ } from 'compiled-i18n';



export interface MenuItem {
  name: string;
  path: string;
  permission?: { resource: string; action: string };
  excludePaths?: string[];
}

export const menuItems: MenuItem[] = [
  {
    name: _`Dashboard`,
    path: '/dashboard',
    permission: Permissions.DASHBOARD_READ
  },
  {
    name: _`Matrix`,
    path: '/matrix',
    permission: Permissions.MATRIX_READ
  },
  {
    name: _`Pläne`,
    path: '/budgets',
    permission: Permissions.BUDGETS_READ
  },
  {
    name: _`Konten`,
    path: '/accounts',
    permission: Permissions.ACCOUNTS_READ,
    excludePaths: ['/accounts/compare']
  },
  {
    name: _`Kontenvergleich`,
    path: '/accounts/compare',
    permission: Permissions.ACCOUNTS_READ
  },
  {
    name: _`Kontengruppen`,
    path: '/accountGroups',
    permission: Permissions.ACCOUNT_GROUPS_READ
  },
  {
    name: _`Journal`,
    path: '/journal',
    permission: Permissions.JOURNAL_READ
  },
  {
    name: _`Berichte`,
    path: '/reports',
    permission: Permissions.REPORTS_READ
  },
  {
    name: _`Berichtsvorlagen`,
    path: '/reportTemplates',
    permission: Permissions.REPORT_TEMPLATES_READ
  }
];

export const menuItemsAdmin: MenuItem[] = [
  {
    name: _`Einstellungen`,
    path: '/admin/settings',
    permission: Permissions.SETTINGS_READ
  },
  {
    name: _`Benutzer`,
    path: '/admin/users',
    permission: Permissions.USERS_READ
  },
  {
    name: _`Gruppen`,
    path: '/admin/groups',
    permission: Permissions.GROUPS_READ
  },
  {
    name: _`Importquellen`,
    path: '/admin/importSources',
    permission: Permissions.IMPORT_SOURCES_READ
  }
];

export async function getAccessibleMenuItems(
  userId: string,
  items: MenuItem[]
): Promise<MenuItem[]> {
  const accessibleItems: MenuItem[] = [];

  for (const item of items) {
    if (!item.permission) {
      accessibleItems.push(item);
      continue;
    }

    const hasAccess = await checkPermission(
      userId,
      item.permission.resource,
      item.permission.action
    );

    if (hasAccess) {
      accessibleItems.push(item);
    }
  }

  return accessibleItems;
}
