import { component$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, Permissions, checkPermissions } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.USERS_READ);

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

async function getUsers(): Promise<User[]> {
  return (await Prisma.users.findMany({
    orderBy: {
      email: 'asc'
    }
  })).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.created_at
  }));
}

export const useGetUsersLoader = routeLoader$(async () => {
  return await getUsers();
});

export const useUserPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canUpdate: Permissions.USERS_UPDATE
  });
});

export default component$(() => {
  const users = useGetUsersLoader();
  const permissions = useUserPermissions();

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li>{_`Admin`}</li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Benutzer`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
        </HeaderButtons>
      </Header>

      <div class="table-container">
        <table class="table is-fullwidth is-hoverable">
          <thead>
            <tr>
              <th>{_`E-Mail`}</th>
              <th>{_`Name`}</th>
              <th>{_`Erstellt am`}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.value.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name}</td>
                <td>{formatDateShort(user.createdAt)}</td>
                <td class="has-text-right">
                  {permissions.value.canUpdate && (
                    <Link href={`/admin/users/${user.id}/edit`} class="button is-small">
                      <span class="icon is-small">
                        <i class="fas fa-edit"></i>
                      </span>
                      <span>{_`Bearbeiten`}</span>
                    </Link>
                  )}
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
  title: _`VSFV | Benutzer`,
  meta: [],
};
