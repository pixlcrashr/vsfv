import { component$, useComputed$, useSignal, useStylesScoped$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeAction$, routeLoader$, zod$, z } from "@builder.io/qwik-city";
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
import EditAccountGroupMenu from "~/components/accountGroups/EditAccountGroupMenu";
import { checkPermission } from "~/lib/auth";

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

export const SaveAccountGroupSchema = {
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  assignments: z.array(z.object({
    accountId: z.string().uuid(),
    mode: z.string()
  })).optional()
};

async function saveAccountGroup(
  id: string,
  name: string,
  description: string,
  assignments: { accountId: string; mode: string }[]
): Promise<void> {
  await Prisma.account_groups.update({
    where: {
      id: id
    },
    data: {
      display_name: name,
      display_description: description
    }
  });

  await Prisma.account_group_assignments.deleteMany({
    where: {
      account_group_id: id
    }
  });

  const filteredAssignments = assignments.filter(a => a.mode === 'positive' || a.mode === 'negative');
  if (filteredAssignments.length > 0) {
    await Prisma.account_group_assignments.createMany({
      data: filteredAssignments.map(a => ({
        account_group_id: id,
        account_id: a.accountId,
        negate: a.mode === 'negative'
      }))
    });
  }
}

export const useSaveAccountGroupRouteAction = routeAction$(async (values, { sharedMap, fail }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  
  if (!userId) {
    return fail(401, { message: 'Unauthorized' });
  }
  
  const canUpdate = await checkPermission(userId, 'accountGroups', 'update');
  if (!canUpdate) {
    return fail(403, { message: 'Forbidden: Insufficient permissions to update account groups' });
  }
  
  await saveAccountGroup(
    values.id,
    values.name,
    values.description,
    values.assignments ?? []
  );

  return {
    status: "success"
  };
}, zod$(SaveAccountGroupSchema));

export enum MenuStatus {
  None,
  Create,
  Edit
}

interface AccountGroupAssignment {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  negate: boolean;
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

export default component$(() => {
  useStylesScoped$(styles);

  const accountGroups = useGetAccountGroups();
  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);
  const editMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Edit);
  const editMenuAccountGroupId = useSignal<string>('');

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
            <button class="button is-primary is-rounded"
              onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>{_`Hinzufügen`}</button>
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
                <td class="is-vcentered">{group.displayDescription}</td>
                <td class="is-vcentered">{group.assignmentCount}</td>
                <td class="is-vcentered">
                  <p class="buttons are-small is-right">
                    <Link class="button is-info is-outlined" href={`/accountGroups/${group.id}`}>{_`Statistik`}</Link>
                    <button class="button" onClick$={() => {
                      editMenuAccountGroupId.value = group.id;
                      menuStatus.value = MenuStatus.Edit;
                    }}>{_`Bearbeiten`}</button>
                    <Link class="button is-danger is-outlined" href={`/accountGroups/${group.id}/delete`}>{_`Entfernen`}</Link>
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

      <MainContentMenu isShown={editMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          {_`Kontengruppe bearbeiten`}
        </MainContentMenuHeader>

        <EditAccountGroupMenu accountGroupId={editMenuAccountGroupId}></EditAccountGroupMenu>
      </MainContentMenu>

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
