import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";
import { getUserRoles, addRoleForUser, deleteRoleForUser } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.USERS_UPDATE);

interface User {
  id: string;
  email: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  assigned: boolean;
}

async function getUser(id: string): Promise<User | null> {
  const user = await Prisma.users.findUnique({
    where: { id }
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}

async function getAllGroups(userId: string): Promise<Group[]> {
  const userRoles = await getUserRoles(userId);

  const groups = await Prisma.user_groups.findMany({
    orderBy: {
      id: 'asc'
    }
  });

  return groups.map(g => ({
    id: g.id,
    name: g.name,
    assigned: userRoles.includes(g.id)
  }));
}

async function getUserGroups(userId: string): Promise<Group[]> {
  return await getAllGroups(userId);
}

export const useGetUserLoader = routeLoader$(async (req) => {
  const user = await getUser(req.params.userId);
  if (!user) {
    throw req.redirect(307, "/admin/users");
  }

  const groups = await getUserGroups(user.id);

  return { user, groups };
});

export const SaveUserGroupsSchema = {
  userId: z.string().uuid(),
  groups: z.record(z.string(), z.coerce.boolean())
};

export const useSaveUserGroupsAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.USERS_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const allGroups = await getAllGroups(values.userId);

  for (const group of allGroups) {
    const shouldHave = values.groups[group.id] === true;
    const currentlyHas = group.assigned;

    if (shouldHave && !currentlyHas) {
      await addRoleForUser(values.userId, group.id);
    } else if (!shouldHave && currentlyHas) {
      await deleteRoleForUser(values.userId, group.id);
    }
  }

  return {
    success: true
  };
}, zod$(SaveUserGroupsSchema));

export default component$(() => {
  const data = useGetUserLoader();
  const saveAction = useSaveUserGroupsAction();

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="#">{_`Admin`}</Link></li>
              <li><Link href="/admin/users">{_`Benutzer`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{data.value.user.name}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          <Link href="/admin/users" class="button">
            <span class="icon is-small">
              <i class="fas fa-arrow-left"></i>
            </span>
            <span>{_`Zurück`}</span>
          </Link>
        </HeaderButtons>
      </Header>

      <div>
        <h2 class="title is-4">{_`Benutzerinformationen`}</h2>
        <div class="content mb-5">
          <p><strong>{_`E-Mail`}:</strong> {data.value.user.email}</p>
          <p><strong>{_`Name`}:</strong> {data.value.user.name}</p>
        </div>
        <hr />
      </div>

      <div class="mt-5">
        <h2 class="title is-4">{_`Gruppenzuweisungen`}</h2>
        <p class="subtitle is-6 mb-4">
          {_`Weisen Sie diesem Benutzer Gruppen zu, um Berechtigungen zu vergeben.`}
        </p>
        
        <Form action={saveAction}>
          <input type="hidden" name="userId" value={data.value.user.id} />
          
          <div class="field">
            {data.value.groups.map((group) => (
              <div key={group.name} class="control mb-2">
                <label class="checkbox">
                  <input
                    type="checkbox"
                    name={`groups.${group.id}`}
                    checked={group.assigned}
                    disabled={group.name === 'admin'}
                  />
                  {' '}<strong>{group.name}</strong>
                  {group.name === 'admin' && <span class="has-text-grey"> ({_`nicht editierbar`})</span>}
                </label>
              </div>
            ))}
          </div>

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

          {saveAction.value?.success && (
            <div class="notification is-success mt-4">
              {_`Gruppenzuweisungen erfolgreich gespeichert.`}
            </div>
          )}
        </Form>
      </div>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Benutzer bearbeiten`,
  meta: [],
};
