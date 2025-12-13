import { $, component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import { Prisma } from "~/lib/prisma";
import { useMinLoading } from "~/lib/delay";
import MainContent from "~/components/layout/MainContent";
import { checkPermission } from "~/lib/auth";

interface AccountGroup {
  id: string;
  name: string;
}

async function getAccountGroup(id: string): Promise<AccountGroup | null> {
  try {
    const m = await Prisma.account_groups.findUnique({
      where: {
        id: id,
      },
    });
    if (!m) {
      return null;
    }

    return {
      id: m.id,
      name: m.display_name,
    };
  } catch {
    return null;
  }
}

async function deleteAccountGroup(accountGroupId: string): Promise<void> {
  await Prisma.account_group_assignments.deleteMany({
    where: {
      account_group_id: accountGroupId,
    },
  });

  await Prisma.view_account_group_assignments.deleteMany({
    where: {
      account_group_id: accountGroupId,
    },
  });

  await Prisma.account_groups.delete({
    where: {
      id: accountGroupId,
    },
  });
}

export const useGetAccountGroup = routeLoader$<AccountGroup>(async (req) => {
  const g = await getAccountGroup(req.params.accountGroupId);

  if (!g) {
    throw req.redirect(307, "/accountGroups");
  }

  return g;
});

export const useDeleteAccountGroupAction = routeAction$(async (_, req) => {
  const userId = req.sharedMap.get('userId') as string | undefined;
  
  if (!userId) {
    return req.fail(401, { message: 'Unauthorized' });
  }
  
  const canDelete = await checkPermission(userId, 'accountGroups', 'delete');
  if (!canDelete) {
    return req.fail(403, { message: 'Forbidden: Insufficient permissions to delete account groups' });
  }
  
  await deleteAccountGroup(req.params.accountGroupId);

  throw req.redirect(307, "/accountGroups");
});

export default component$(() => {
  const accountGroup = useGetAccountGroup();
  const deleteAccountGroupAction = useDeleteAccountGroupAction();
  const isLoading = useMinLoading($(() => deleteAccountGroupAction.isRunning));

  return (
    <>
      <MainContent>
        <Form action={deleteAccountGroupAction}>
          <Header>
            <HeaderTitle>
              <nav class="breadcrumb" aria-label="breadcrumbs">
                <ul>
                  <li><Link href="/accountGroups">{_`Kontengruppen`}</Link></li>
                  <li class="is-active"><Link href="#" aria-current="page">{_`Kontengruppe ${accountGroup.value.name} entfernen`}</Link></li>
                </ul>
              </nav>
            </HeaderTitle>
            <HeaderButtons>
            </HeaderButtons>
          </Header>

          <div>
            <p class="has-text-centered is-size-5">{_`Möchtest du die Kontengruppe ${accountGroup.value.name} wirklich entfernen?`}</p>
          </div>

          <div class="buttons mt-6 is-centered">
            <button type="submit" class={[
              'button',
              'is-danger',
              {
                'is-loading': isLoading.value
              }
            ]}>{_`Entfernen`}</button>
          </div>
        </Form>
      </MainContent>
    </>
  );
});
