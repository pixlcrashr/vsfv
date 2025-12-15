import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, deleteAllPermissionsForRole, deleteAllRolesForRole, getUsersForRole, checkPermissions } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.GROUPS_READ);

interface Group {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
}

async function getGroups(): Promise<Group[]> {
  const groups = await Prisma.user_groups.findMany({
    orderBy: {
      name: 'asc'
    }
  });

  // Count users for each group using Casbin API
  const groupsWithCounts = await Promise.all(
    groups.map(async (group) => {
      const users = await getUsersForRole(group.id);
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        isSystem: group.is_system,
        userCount: users.length
      };
    })
  );

  return groupsWithCounts;
}

export const useGetGroupsLoader = routeLoader$(async () => {
  return await getGroups();
});

export const useGroupPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canCreate: Permissions.GROUPS_CREATE,
    canUpdate: Permissions.GROUPS_UPDATE,
    canDelete: Permissions.GROUPS_DELETE
  });
});

export const DeleteGroupSchema = {
  id: z.string().min(1)
};

export const useDeleteGroupAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.GROUPS_DELETE);
  if (!auth.authorized) {
    return auth.result;
  }

  const group = await Prisma.user_groups.findUnique({
    where: { id: values.id }
  });

  if (!group) {
    return fail(404, { message: 'Gruppe nicht gefunden' });
  }

  if (group.is_system) {
    return fail(400, { message: 'Systemgruppen können nicht gelöscht werden' });
  }

  // Delete all permissions for this role using Casbin API
  await deleteAllPermissionsForRole(values.id);
  
  // Delete all role assignments for this role using Casbin API
  await deleteAllRolesForRole(values.id);

  // Delete the group from user_groups table
  await Prisma.user_groups.delete({
    where: { id: values.id }
  });

  return {
    success: true
  };
}, zod$(DeleteGroupSchema));

export default component$(() => {
  const groups = useGetGroupsLoader();
  const deleteAction = useDeleteGroupAction();
  const permissions = useGroupPermissions();

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/admin/settings">{_`Einstellungen`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Gruppen`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          {permissions.value.canCreate && (
            <Link href="/admin/groups/new" class="button is-primary">
              <span class="icon is-small">
                <i class="fas fa-plus"></i>
              </span>
              <span>{_`Neue Gruppe`}</span>
            </Link>
          )}
        </HeaderButtons>
      </Header>

      {deleteAction.value?.success && (
        <div class="notification is-success">
          {_`Gruppe erfolgreich gelöscht.`}
        </div>
      )}

      <div class="table-container">
        <table class="table is-fullwidth is-hoverable">
          <thead>
            <tr>
              <th>{_`ID`}</th>
              <th>{_`Name`}</th>
              <th>{_`Beschreibung`}</th>
              <th>{_`Anzahl Benutzer`}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.value.map((group) => (
              <tr key={group.id}>
                <td>
                  <code>{group.id}</code>
                  {group.isSystem && <span class="tag is-info ml-2">{_`System`}</span>}
                </td>
                <td><strong>{group.name}</strong></td>
                <td class="has-text-grey">{group.description || '-'}</td>
                <td>{group.userCount}</td>
                <td class="has-text-right">
                  <div class="buttons is-right">
                    {permissions.value.canUpdate && (
                      <Link href={`/admin/groups/${encodeURIComponent(group.id)}/edit`} class="button is-small">
                        <span class="icon is-small">
                          <i class="fas fa-edit"></i>
                        </span>
                        <span>{_`Bearbeiten`}</span>
                      </Link>
                    )}
                    {!group.isSystem && permissions.value.canDelete && (
                      <Form action={deleteAction}>
                        <input type="hidden" name="id" value={group.id} />
                        <button type="submit" class="button is-small is-danger" disabled={deleteAction.isRunning}>
                          <span class="icon is-small">
                            <i class="fas fa-trash"></i>
                          </span>
                          <span>{_`Löschen`}</span>
                        </button>
                      </Form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Gruppen`,
  meta: [],
};
