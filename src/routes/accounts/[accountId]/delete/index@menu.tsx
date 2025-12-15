import { $, component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import { Prisma } from "~/lib/prisma";
import { useMinLoading } from "~/lib/delay";
import MainContent from "~/components/layout/MainContent";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";

export const onRequest: RequestHandler = requirePermission(Permissions.ACCOUNTS_DELETE);



interface Account {
  id: string;
  code: string;
  name: string;
}

async function getAccount(id: string): Promise<Account | null> {
  try {
    const m = await Prisma.accounts.findUnique({
      where: {
        id: id,
      },
    });
    if (!m) {
      return null;
    }

    return {
      id: m.id,
      code: m.display_code,
      name: m.display_name,
    }
  } catch {
    return null;
  }
}

async function deleteAccount(accountId: string): Promise<void> {
  await Prisma.accounts.delete({
    where: {
      id: accountId,
    },
  });
}

export const useGetAccount = routeLoader$<Account>(async (req) => {
  const a = await getAccount(req.params.accountId);

  if (!a) {
    throw req.redirect(307, "/accounts");
  }

  return a;
});

export const useDeleteAccountAction = routeAction$(async (_, req) => {
  const auth = await withPermission(req.sharedMap, req.fail, Permissions.ACCOUNTS_DELETE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  await deleteAccount(req.params.accountId);

  throw req.redirect(307, "/accounts");
});

export default component$(() => {
  const budget = useGetAccount();
  const deleteAccountAction = useDeleteAccountAction();
  const isLoading = useMinLoading($(() => deleteAccountAction.isRunning));

  return (
    <>
      <MainContent>
        <Form action={deleteAccountAction}>
          <Header>
            <HeaderTitle>
              <nav class="breadcrumb" aria-label="breadcrumbs">
                <ul>
                  <li><Link href="/accounts">{_`Haushaltskonten`}</Link></li>
                  <li class="is-active"><Link href="#" aria-current="page">{_`Haushaltskonto ${budget.value.code} | ${budget.value.name} entfernen`}</Link></li>
                </ul>
              </nav>
            </HeaderTitle>
            <HeaderButtons>
            </HeaderButtons>
          </Header>

          <div>
            <p class="has-text-centered is-size-5">{_`Möchtest du das Haushaltskonto ${budget.value.code} | ${budget.value.name} wirklich entfernen?`}</p>
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

export const head: DocumentHead = {
  title: _`VSFV | Konto entfernen`,
  meta: [],
};
