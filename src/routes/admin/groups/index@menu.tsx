import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, deleteAllPermissionsForRole, deleteAllRolesForRole, getUsersForRole, checkPermissions } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.GROUPS_READ);

interface Group {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  isDefault: boolean;
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
        isDefault: group.is_default,
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

export const CreateGroupSchema = {
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Nur Buchstaben, Zahlen, - und _ erlaubt'),
  name: z.string().min(1),
  description: z.string().optional()
};

export const useCreateGroupAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.GROUPS_CREATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const existing = await Prisma.user_groups.findUnique({
    where: { id: values.id }
  });

  if (existing) {
    return fail(400, { message: 'Eine Gruppe mit dieser ID existiert bereits' });
  }

  await Prisma.user_groups.create({
    data: {
      id: values.id,
      name: values.name,
      description: values.description || ''
    }
  });

  return {
    success: true,
    groupId: values.id
  };
}, zod$(CreateGroupSchema));

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

  if (group.is_default) {
    return fail(400, { message: 'Die Standardgruppe kann nicht gelöscht werden' });
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

enum MenuStatus {
  None,
  Create
}

export default component$(() => {
  const groups = useGetGroupsLoader();
  const deleteAction = useDeleteGroupAction();
  const createAction = useCreateGroupAction();
  const permissions = useGroupPermissions();
  
  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);
  
  const groupId = useSignal('');
  const groupName = useSignal('');
  const groupDescription = useSignal('');
  const isFormValid = useComputed$(() => 
    groupId.value.trim().length > 0 && 
    groupName.value.trim().length > 0 &&
    /^[a-zA-Z0-9_-]+$/.test(groupId.value)
  );

  return (
    <>
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><a href="#">{_`Admin`}</a></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Gruppen`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          {permissions.value.canCreate && (
            <button class="button is-primary is-rounded" onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>
              <span class="icon is-small">
                <i class="fas fa-plus"></i>
              </span>
              <span>{_`Neue Gruppe`}</span>
            </button>
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
              <th>{_`Typ`}</th>
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
                </td>
                <td>
                  {group.isSystem && <span class="tag is-info">{_`System`}</span>}
                  {group.isDefault && <span class="tag is-warning">{_`Standard`}</span>}
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
                    {!group.isSystem && !group.isDefault && permissions.value.canDelete && (
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
    
    <MainContentMenu isShown={createMenuShown}>
      <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
        {_`Neue Gruppe erstellen`}
      </MainContentMenuHeader>

      <Form action={createAction} onSubmitCompleted$={() => {
        if (createAction.value?.success) {
          menuStatus.value = MenuStatus.None;
          groupId.value = '';
          groupName.value = '';
          groupDescription.value = '';
        }
      }}>
        <div class="field">
          <label class="label">{_`Gruppen-ID`}</label>
          <div class="control">
            <input
              type="text"
              name="id"
              class={['input', 'is-small', { 'is-danger': createAction.value?.fieldErrors?.id }]}
              placeholder={_`z.B. editors`}
              value={groupId.value}
              onInput$={(e) => groupId.value = (e.target as HTMLInputElement).value}
            />
          </div>
          <p class="help">{_`Eindeutige ID für die Gruppe. Nur Buchstaben, Zahlen, Bindestriche und Unterstriche erlaubt`}</p>
          {createAction.value?.fieldErrors?.id && <p class="help is-danger">{createAction.value?.fieldErrors?.id}</p>}
        </div>

        <div class="field">
          <label class="label">{_`Gruppenname`}</label>
          <div class="control">
            <input
              type="text"
              name="name"
              class={['input', 'is-small', { 'is-danger': createAction.value?.fieldErrors?.name }]}
              placeholder={_`z.B. Redakteure`}
              value={groupName.value}
              onInput$={(e) => groupName.value = (e.target as HTMLInputElement).value}
            />
          </div>
          {createAction.value?.fieldErrors?.name && <p class="help is-danger">{createAction.value?.fieldErrors?.name}</p>}
        </div>

        <div class="field">
          <label class="label">{_`Beschreibung`}</label>
          <div class="control">
            <textarea
              name="description"
              class="textarea is-small"
              placeholder={_`Optionale Beschreibung der Gruppe`}
              rows={3}
              value={groupDescription.value}
              onInput$={(e) => groupDescription.value = (e.target as HTMLTextAreaElement).value}
            />
          </div>
        </div>

        {createAction.value?.failed && (
          <div class="notification is-danger mt-4">
            {createAction.value.message || _`Fehler beim Erstellen der Gruppe`}
          </div>
        )}

        <div class="buttons mt-5 is-right are-small">
          <button type="submit" class={['button', 'is-primary', { 'is-loading': createAction.isRunning }]} disabled={!isFormValid.value || createAction.isRunning}>
            {_`Gruppe erstellen`}
          </button>
        </div>
      </Form>
    </MainContentMenu>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Gruppen`,
  meta: [],
};
