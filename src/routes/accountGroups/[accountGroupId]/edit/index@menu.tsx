import { component$, Resource, useResource$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { buildTreeFromDB, sortedFlatAccountIterator } from "~/lib/accounts/tree";
import { Prisma } from "~/lib/prisma";
import { checkPermission, requirePermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.ACCOUNT_GROUPS_UPDATE);

type AssignmentMode = 'ignore' | 'positive' | 'negative';

interface AccountWithMode {
  id: string;
  code: string;
  name: string;
  depth: number;
  mode: AssignmentMode;
}

interface AccountGroup {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AccountGroupData {
  accountGroup: AccountGroup;
  accountsWithMode: AccountWithMode[];
  maxDepth: number;
}

async function getAccountGroup(id: string): Promise<{ accountGroup: AccountGroup; assignmentMap: Map<string, boolean> } | null> {
  try {
    const m = await Prisma.account_groups.findUnique({
      include: {
        account_group_assignments: true
      },
      where: {
        id: id,
      },
    });
    if (!m) {
      return null;
    }

    const assignmentMap = new Map<string, boolean>();
    m.account_group_assignments.forEach(a => {
      assignmentMap.set(a.account_id, a.negate);
    });

    return {
      accountGroup: {
        id: m.id,
        name: m.display_name,
        description: m.display_description,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      },
      assignmentMap
    };
  } catch {
    return null;
  }
}

async function getAvailableAccounts(): Promise<{ accounts: AccountWithMode[]; maxDepth: number }> {
  const accounts = await Prisma.accounts.findMany({
    where: {
      is_archived: false
    }
  });

  const tree = buildTreeFromDB(accounts);
  const flatAccounts: AccountWithMode[] = [];

  for (const flatAccount of sortedFlatAccountIterator(tree)) {
    flatAccounts.push({
      id: flatAccount.id,
      code: flatAccount.code,
      name: flatAccount.name,
      depth: flatAccount.depth,
      mode: 'ignore'
    });
  }

  return { accounts: flatAccounts, maxDepth: tree.maxDepth() };
}

export const useGetAccountGroupData = routeLoader$<AccountGroupData | null>(async ({ params, redirect }) => {
  const result = await getAccountGroup(params.accountGroupId);
  const { accounts: accountsWithMode, maxDepth } = await getAvailableAccounts();

  if (!result) {
    throw redirect(307, '/accountGroups');
  }

  for (const account of accountsWithMode) {
    if (result.assignmentMap.has(account.id)) {
      account.mode = result.assignmentMap.get(account.id) ? 'negative' : 'positive';
    }
  }

  return { accountGroup: result.accountGroup, accountsWithMode, maxDepth };
});

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

export const useSaveAccountGroupAction = routeAction$(async (values, { sharedMap, fail, redirect }) => {
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

  throw redirect(302, '/accountGroups');
}, zod$(SaveAccountGroupSchema));

export default component$(() => {
  const data = useGetAccountGroupData();
  const saveAction = useSaveAccountGroupAction();

  if (!data.value) {
    return (
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/accountGroups">{_`Kontengruppen`}</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">{_`Bearbeiten`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>
        <div class="notification is-warning">{_`Kontengruppe nicht gefunden`}</div>
      </MainContent>
    );
  }

  const { accountGroup, accountsWithMode, maxDepth } = data.value;

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/accountGroups">{_`Kontengruppen`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Bearbeiten`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <Form action={saveAction}>
        <input hidden name="id" type="hidden" value={accountGroup.id} />

        <div class="field">
          <label class="label">{_`Name`}</label>
          <div class="control">
            <input name="name" class="input" disabled={saveAction.isRunning} type="text" value={accountGroup.name} />
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Beschreibung`}</label>
          <div class="control">
            <textarea name="description" class="textarea" disabled={saveAction.isRunning} rows={5} value={accountGroup.description} />
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Kontenzuweisungen`}</label>
          <p class="help mb-2">{_`Wählen Sie für jedes Konto: Positiv (+), Negativ (-) oder Ignorieren.`}</p>
          <table class="table is-striped is-narrow is-hoverable is-fullwidth">
            <thead>
              <tr>
                <th colSpan={maxDepth}>{_`Konto`}</th>
                <th>{_`Name`}</th>
                <th class="has-text-centered">P</th>
                <th class="has-text-centered">N</th>
                <th class="has-text-centered">I</th>
              </tr>
            </thead>
            <tbody>
              {accountsWithMode.map((account, index) => (
                <tr key={account.id}>
                  <input type="hidden" name={`assignments.${index}.accountId`} value={account.id} />
                  {Array.from({ length: maxDepth }).map((_, j) => (
                    <td class="is-vcentered" key={j}>
                      <span class="is-size-7">{j === account.depth ? account.code : ''}</span>
                    </td>
                  ))}
                  <td class="is-vcentered">
                    <span class="is-size-7">{account.name}</span>
                  </td>
                  <td class="is-vcentered has-text-centered">
                    <label class="radio">
                      <input
                        type="radio"
                        name={`assignments.${index}.mode`}
                        value="positive"
                        checked={account.mode === 'positive'}
                        onChange$={() => { account.mode = 'positive'; }}
                      />
                    </label>
                  </td>
                  <td class="is-vcentered has-text-centered">
                    <label class="radio">
                      <input
                        type="radio"
                        name={`assignments.${index}.mode`}
                        value="negative"
                        checked={account.mode === 'negative'}
                        onChange$={() => { account.mode = 'negative'; }}
                      />
                    </label>
                  </td>
                  <td class="is-vcentered has-text-centered">
                    <label class="radio">
                      <input
                        type="radio"
                        name={`assignments.${index}.mode`}
                        value="ignore"
                        checked={account.mode === 'ignore'}
                        onChange$={() => { account.mode = 'ignore'; }}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="buttons mt-5 is-right">
          <Link href="/accountGroups" class="button">{_`Abbrechen`}</Link>
          <button type="submit" class={["button", "is-warning", {
            'is-loading': saveAction.isRunning
          }]}>{_`Speichern`}</button>
        </div>
      </Form>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Kontengruppe bearbeiten`,
  meta: [],
};
