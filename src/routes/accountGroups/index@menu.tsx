import { component$, useComputed$, useSignal, useStylesScoped$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeAction$, routeLoader$, zod$, z, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import { Prisma } from "~/lib/prisma";
import styles from "./index@menu.scss?inline";
import CreateAccountGroupMenu from "~/components/accountGroups/CreateAccountGroupMenu";
import { checkPermission, requirePermission, Permissions, checkPermissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.ACCOUNT_GROUPS_READ);

export const CreateAccountGroupSchema = {
  name: z.string().min(1),
  description: z.string()
};

async function createAccountGroup(name: string, description: string): Promise<void> {
  await Prisma.account_groups.create({
    data: {
      display_name: name,
      display_description: description
    }
  });
}

export const useCreateAccountGroupRouteAction = routeAction$(async (args, { sharedMap, fail }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  
  if (!userId) {
    return fail(401, { message: 'Unauthorized' });
  }
  
  const canCreate = await checkPermission(userId, 'accountGroups', 'create');
  if (!canCreate) {
    return fail(403, { message: 'Forbidden: Insufficient permissions to create account groups' });
  }
  
  await createAccountGroup(args.name, args.description);

  return {
    success: true
  };
}, zod$(CreateAccountGroupSchema));

export enum MenuStatus {
  None,
  Create
}

interface AccountGroup {
  id: string;
  displayName: string;
  displayDescription: string;
  assignmentCount: number;
}

async function getAccountGroups(offset: number, limit: number): Promise<AccountGroup[]> {
  const res = await Prisma.account_groups.findMany({
    skip: offset,
    take: limit,
    include: {
      _count: {
        select: { account_group_assignments: true }
      }
    },
    orderBy: {
      display_name: 'asc'
    }
  });

  return res.map((group) => ({
    id: group.id,
    displayName: group.display_name,
    displayDescription: group.display_description,
    assignmentCount: group._count.account_group_assignments
  }));
}

export const useGetAccountGroups = routeLoader$<AccountGroup[]>(async () => await getAccountGroups(0, 100));

export const useAccountGroupPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canCreate: Permissions.ACCOUNT_GROUPS_CREATE,
    canUpdate: Permissions.ACCOUNT_GROUPS_UPDATE,
    canDelete: Permissions.ACCOUNT_GROUPS_DELETE
  });
});

export default component$(() => {
  useStylesScoped$(styles);

  const accountGroups = useGetAccountGroups();
  const permissions = useAccountGroupPermissions();
  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);

  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active"><Link href="#" aria-current="page">{_`Kontengruppen`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            {permissions.value.canCreate && (
              <button class="button is-primary is-rounded"
                onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>{_`Hinzufügen`}</button>
            )}
          </HeaderButtons>
        </Header>
        <table class="table is-narrow is-hoverable is-striped is-fullwidth">
          <thead>
            <tr>
              <th>{_`Name`}</th>
              <th>{_`Beschreibung`}</th>
              <th>{_`Anzahl Konten`}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accountGroups.value.map((group) => (
              <tr key={group.id}>
                <td class="is-vcentered">{group.displayName}</td>
                <td class="is-vcentered" style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title={group.displayDescription}>{group.displayDescription}</td>
                <td class="is-vcentered">{group.assignmentCount}</td>
                <td class="is-vcentered">
                  <p class="buttons are-small is-right">
                    <Link class="button is-info is-outlined" href={`/accountGroups/${group.id}`}>{_`Statistik`}</Link>
                    {permissions.value.canUpdate && (
                      <Link class="button" href={`/accountGroups/${group.id}/edit`}>{_`Bearbeiten`}</Link>
                    )}
                    {permissions.value.canDelete && (
                      <Link class="button is-danger is-outlined" href={`/accountGroups/${group.id}/delete`}>{_`Entfernen`}</Link>
                    )}
                  </p>
                </td>
              </tr>
            ))}
            {accountGroups.value.length === 0 && (
              <tr>
                <td colSpan={4} class="has-text-centered">
                  <p class="is-size-6">{_`Keine Kontengruppen gefunden`}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MainContent>

      <MainContentMenu isShown={createMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          {_`Kontengruppe erstellen`}
        </MainContentMenuHeader>

        <CreateAccountGroupMenu />
      </MainContentMenu>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Kontengruppen`,
  meta: [],
};
