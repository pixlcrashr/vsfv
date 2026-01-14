import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, type Permission, checkPermission, deleteAllPermissionsForRole, addPermission } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.GROUPS_UPDATE);

interface PermissionItem extends Permission {
  key: string;
  assigned: boolean;
}

async function getGroupPermissions(groupName: string): Promise<PermissionItem[]> {
  const permissionChecks = await Promise.all(
    Object.entries(Permissions).map(async ([key, perm]) => ({
      key,
      ...perm,
      assigned: await checkPermission(groupName, perm.resource, perm.action)
    }))
  );

  return permissionChecks;
}

export const useGetGroupLoader = routeLoader$(async (req) => {
  const groupId = decodeURIComponent(req.params.groupName);
  
  const group = await Prisma.user_groups.findUnique({
    where: {
      id: groupId
    }
  });

  if (!group) {
    throw req.redirect(307, "/admin/groups");
  }

  const permissions = await getGroupPermissions(groupId);

  return { 
    groupId: group.id,
    groupName: group.name,
    description: group.description,
    isSystem: group.is_system,
    permissions 
  };
});

const SaveGroupPermissionsSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().optional(),
  permissions: z.record(z.string(), z.record(z.string(), z.coerce.boolean()))
});

export const useSaveGroupPermissionsAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.GROUPS_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const group = await Prisma.user_groups.findUnique({
    where: { id: values.groupId }
  });

  if (!group) {
    return fail(404, { message: 'Gruppe nicht gefunden' });
  }

  if (group.is_system) {
    return fail(403, { message: 'Systemgruppen können nicht bearbeitet werden' });
  }

  // Update group description
  await Prisma.user_groups.update({
    where: { id: values.groupId },
    data: {
      description: values.description || ''
    }
  });

  // Delete all existing permissions for this role using Casbin API
  await deleteAllPermissionsForRole(values.groupId);

  // Add new permissions using Casbin API
  for (const [resource, actions] of Object.entries(values.permissions)) {
    for (const [action, enabled] of Object.entries(actions)) {
      if (enabled) {
        await addPermission(values.groupId, resource, action);
      }
    }
  }

  return {
    success: true
  };
}, zod$(SaveGroupPermissionsSchema));

export default component$(() => {
  const data = useGetGroupLoader();
  const saveAction = useSaveGroupPermissionsAction();

  const isSystemGroup = data.value.isSystem;

  const permissionsByCategory = data.value.permissions
    .filter(perm => perm.category && perm.name && perm.description)
    .reduce((acc, perm) => {
      const category = perm.category!;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(perm);
      return acc;
    }, {} as Record<string, PermissionItem[]>);

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li>{_`Admin`}</li>
              <li><Link href="/admin/groups">{_`Gruppen`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{data.value.groupName}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          <Link href="/admin/groups" class="button">
            <span class="icon is-small">
              <i class="fas fa-arrow-left"></i>
            </span>
            <span>{_`Zurück`}</span>
          </Link>
        </HeaderButtons>
      </Header>

      <div>
        <h2 class="title is-4">{_`Gruppe bearbeiten`}: {data.value.groupName}</h2>
        {isSystemGroup ? (
          <div class="notification is-info mb-5">
            <p><strong>{_`Systemgruppe`}:</strong> {_`Diese Gruppe ist eine Systemgruppe und kann nicht bearbeitet werden.`}</p>
          </div>
        ) : (
          <p class="subtitle is-6 mb-5">
            {_`Bearbeiten Sie die Gruppenbeschreibung und wählen Sie die Berechtigungen aus, die Mitglieder dieser Gruppe erhalten sollen.`}
          </p>
        )}
        
        <Form action={saveAction}>
          <input type="hidden" name="groupId" value={data.value.groupId} />
          
          {!isSystemGroup && (
            <div class="field mb-5">
              <label class="label">{_`Beschreibung`}</label>
              <div class="control">
                <textarea
                  name="description"
                  class="textarea"
                  placeholder={_`Beschreibung der Gruppe`}
                  rows={3}
                  value={data.value.description}
                  disabled={isSystemGroup}
                />
              </div>
            </div>
          )}
          
          {Object.entries(permissionsByCategory).map(([category, perms]) => (
            <div key={category} class="mb-5">
              <h3 class="title is-5 mb-3">{category}</h3>
              <div class="field">
                {perms.map((perm) => (
                  <div key={perm.key} class="control mb-3">
                    <label class="checkbox">
                      <input
                        type="checkbox"
                        name={`permissions.${perm.resource}.${perm.action}`}
                        checked={perm.assigned}
                        disabled={isSystemGroup}
                      />
                      {' '}<strong>{perm.name}</strong>
                      <br />
                      <span class="has-text-grey is-size-7 ml-4">{perm.description}</span>
                    </label>
                  </div>
                ))}
              </div>
              <hr />
            </div>
          ))}

          {!isSystemGroup && (
            <div class="field is-grouped mt-5">
              <div class="control">
                <button type="submit" class="button is-primary">
                  <span class="icon is-small">
                    <i class="fas fa-save"></i>
                  </span>
                  <span>{_`Speichern`}</span>
                </button>
              </div>
            </div>
          )}

          {saveAction.value?.failed && (
            <div class="notification is-danger mt-4">
              {saveAction.value.message || _`Fehler beim Speichern der Berechtigungen`}
            </div>
          )}

          {saveAction.value?.success && (
            <div class="notification is-success mt-4">
              {_`Berechtigungen erfolgreich gespeichert.`}
            </div>
          )}
        </Form>
      </div>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Gruppe bearbeiten`,
  meta: [],
};
