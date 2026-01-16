import { component$, useComputed$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import { Prisma } from "~/lib/prisma";
import { Prisma as P } from "~/lib/prisma/generated/client";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.ACCOUNTS_READ);

interface AccountDetails {
  id: string;
  name: string;
  description: string;
  code: string;
  parentAccountId: string | null;
}

async function getAccountDetails(id: string): Promise<AccountDetails | null> {
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
      name: m.display_name,
      description: m.display_description,
      code: m.display_code,
      parentAccountId: m.parent_account_id
    };
  } catch {
    return null;
  }
}

interface Account {
  id: string;
  name: string;
  code: string;
  depth: number;
  parentAccountId: string | null;
}

async function getAllAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany({
    orderBy: {
      display_code: 'asc',
    }
  });

  as.sort((a, b) => a.display_code.localeCompare(b.display_code, undefined, { numeric: true }));

  const flatAccounts: Account[] = [];

  const dfs = (account: typeof as[0], depth: number) => {
    flatAccounts.push({
      id: account.id,
      code: account.display_code,
      name: account.display_name,
      depth: depth,
      parentAccountId: account.parent_account_id
    });

    as.filter(x => x.parent_account_id === account.id).forEach(x => dfs(x, depth + 1));
  };

  as.filter(x => x.parent_account_id === null).forEach(a => dfs(a, 0));

  return flatAccounts;
}

export const useGetAccount = routeLoader$<AccountDetails | null>(async ({ params }) => {
  return await getAccountDetails(params.accountId);
});

export const useGetAllAccounts = routeLoader$<Account[]>(async () => {
  return await getAllAccounts();
});

export const useAccountPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canUpdate: Permissions.ACCOUNTS_UPDATE
  });
});

export const SaveAccountSchema = {
  id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  parentAccountId: z.string().uuid().optional().or(z.literal('')),
  description: z.string()
};

async function saveAccount(id: string, name: string, code: string, parentAccountId: string | null, description: string): Promise<void> {
  if (parentAccountId !== null) {
    const q = P.sql`WITH RECURSIVE ancestors(id, parent_id) AS (
  SELECT id, parent_account_id FROM accounts WHERE id = $1::uuid
  UNION
  SELECT a.id, a.parent_account_id
  FROM accounts a
  JOIN ancestors an ON a.id = an.parent_id
)
SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = $2::uuid) AS has_cycle`;
    q.values.push(parentAccountId, id);

    const hasCycle = await Prisma.$queryRaw<{ has_cycle: boolean; }[]>(q);

    if (hasCycle[0].has_cycle) {
      throw new Error(_`Konto kann nicht als obergeordnetes Konto verwendet werden, da es einen Zyklus erzeugt.`);
    }
  }

  await Prisma.accounts.update({
    where: {
      id: id
    },
    data: {
      parent_account_id: parentAccountId,
      display_name: name,
      display_code: code,
      display_description: description
    }
  });
}

export const useSaveAccountAction = routeAction$(async (values, { sharedMap, fail, redirect }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.ACCOUNTS_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  try {
    await saveAccount(
      values.id,
      values.name,
      values.code,
      values.parentAccountId && values.parentAccountId !== '' ? values.parentAccountId : null,
      values.description
    );
  } catch (e) {
    return fail(400, {
      message: e instanceof Error ? e.message : 'Unknown error'
    });
  }

  throw redirect(302, '/accounts');
}, zod$(SaveAccountSchema));

export default component$(() => {
  const account = useGetAccount();
  const allAccounts = useGetAllAccounts();
  const permissions = useAccountPermissions();
  const saveAction = useSaveAccountAction();

  const selectableAccounts = useComputed$(() => {
    if (!account.value) return [];
    return allAccounts.value.filter(a => a.id !== account.value!.id);
  });

  if (!account.value) {
    return (
      <MainContentLarge>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/accounts">{_`Haushaltskonten`}</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">{_`Bearbeiten`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>
        <div class="notification is-warning">{_`Haushaltskonto nicht gefunden`}</div>
      </MainContentLarge>
    );
  }

  return (
    <MainContentLarge>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/accounts">{_`Haushaltskonten`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Bearbeiten`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <Form action={saveAction}>
        <input hidden name="id" type="hidden" value={account.value.id} />

        <div class="field">
          <label class="label">{_`Gruppe`}</label>
          <div class="control">
            <div class="select is-fullwidth">
              <select value={account.value.parentAccountId ?? ''} name="parentAccountId" disabled={!permissions.value.canUpdate}>
                <option value="">{_`- keine -`}</option>
                {selectableAccounts.value.map((a) => (
                  <option key={a.id} value={a.id}>
                    {`${"\u00A0".repeat(a.depth * 6)}└─ ${a.code} | ${a.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {saveAction.value?.fieldErrors?.parentAccountId && (
            <p class="help is-danger">{saveAction.value?.fieldErrors?.parentAccountId}</p>
          )}
        </div>

        <div class="columns">
          <div class="column is-3">
            <div class="field">
              <label class="label">{_`Code`}</label>
              <p class="control">
                <input 
                  name="code" 
                  class="input" 
                  value={account.value.code} 
                  disabled={saveAction.isRunning || !permissions.value.canUpdate} 
                  type="text" 
                  placeholder={_`Code`} 
                />
              </p>
            </div>
          </div>
          <div class="column">
            <div class="field">
              <label class="label">{_`Name`}</label>
              <p class="control">
                <input 
                  name="name" 
                  class="input" 
                  value={account.value.name} 
                  disabled={saveAction.isRunning || !permissions.value.canUpdate} 
                  type="text" 
                  placeholder={_`Name`} 
                />
              </p>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Beschreibung`}</label>
          <div class="control">
            <textarea 
              name="description" 
              class="textarea" 
              value={account.value.description}
              disabled={saveAction.isRunning || !permissions.value.canUpdate}
              rows={5}
            ></textarea>
          </div>
        </div>

        {saveAction.value?.message && (
          <div class="notification is-danger">{saveAction.value.message}</div>
        )}

        <div class="buttons mt-5 is-right">
          <Link href="/accounts" class="button">{_`Abbrechen`}</Link>
          {permissions.value.canUpdate && (
            <button type="submit" class={["button", "is-warning", {
              'is-loading': saveAction.isRunning
            }]}>{_`Speichern`}</button>
          )}
        </div>
      </Form>
    </MainContentLarge>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Haushaltskonto bearbeiten`,
  meta: [],
};
