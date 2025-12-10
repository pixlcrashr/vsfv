import { component$, Signal, useComputed$, useSignal, useStylesScoped$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import CreateAccountMenu from "~/components/accounts/CreateAccountMenu";
import EditAccountMenu from "~/components/accounts/EditAccountMenu";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import { Prisma } from "~/lib/prisma";
import { accountsModel } from "~/lib/prisma/generated/models";
import { Prisma as P } from "../../lib/prisma/generated/client";
import styles from "./index.scss?inline";

export const CreateAccountActionSchema = {
  name: z.string().min(1),
  code: z.string().min(1),
  parentAccountId: z.string().optional()
};

async function createAccount(parentAccountId: string | null, name: string, code: string, description: string = ''): Promise<void> {
  await Prisma.accounts.create({
    data: {
      parent_account_id: parentAccountId,
      display_name: name,
      display_code: code,
      display_description: description
    }
  });
}

export const useCreateAccountAction = routeAction$(async (values) => {
  await createAccount(
    (values.parentAccountId === '' || !values.parentAccountId) ? null : values.parentAccountId,
    values.name,
    values.code
  );

  return {
    success: true
  };
}, zod$(CreateAccountActionSchema));

export const SaveAccountActionSchema = {
  id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  parentAccountId: z.string().uuid().optional(),
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
      throw new Error('Konto kann nicht als obergeordnetes Konto verwendet werden, da es einen Zyklus erzeugt.');
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

export const useSaveAccountAction = routeAction$(async (values) => {
  await saveAccount(
    values.id,
    values.name,
    values.code,
    values.parentAccountId ?? null,
    values.description
  );

  return {
    success: true
  };
}, zod$(SaveAccountActionSchema));

enum MenuStatus {
  None,
  Edit,
  Create
}

interface Account {
  id: string;
  name: string;
  code: string;
  description: string;
  depth: number;
  children: Account[];
}

async function getAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany({
    orderBy: {
      display_code: 'asc',
    }
  });

  const traverseChildren: (children: accountsModel[], depth: number) => Account[] = (children: accountsModel[], depth: number) => {
    return children.map(x => {
      const cs = traverseChildren(as.filter(y => y.parent_account_id === x.id), depth + 1);
      cs.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      return {
        id: x.id,
        name: x.display_name,
        code: x.display_code,
        description: x.display_description,
        depth: depth,
        children: cs
      };
    });
  };

  return traverseChildren(as.filter(x => x.parent_account_id === null), 0);
}

export const useGetAccounts = routeLoader$<Account[]>(async () => await getAccounts());

export interface AccountRowProps {
  account: Account;
  maxDepth: number;
  editMenuAccountId: Signal<string>;
  menuStatus: Signal<MenuStatus>;
}

export const AccountRow = component$<AccountRowProps>((props) => {
  return (
    <>
      <tr key={props.account.id}>
        {Array.from({ length: props.maxDepth + 1 }).map((_, index) => <td class="is-vcentered" key={index}>
          {index === props.account.depth ? props.account.code : ''}
        </td>)}
        <td class="is-vcentered">{props.account.name}</td>
        <td class="is-vcentered">
          <div class="buttons are-small is-flex-wrap-nowrap is-right">
            <button class="button" onClick$={() => {
              props.editMenuAccountId.value = props.account.id;
              props.menuStatus.value = MenuStatus.Edit;
            }}>Bearbeiten</button>
            <button class="button is-warning is-outlined">Archivieren</button>
            <Link class="button is-danger is-outlined" href={`/accounts/${props.account.id}/delete`}>Entfernen</Link>
          </div>
        </td>
      </tr>
      {props.account.children.map(x => <AccountRow editMenuAccountId={props.editMenuAccountId} menuStatus={props.menuStatus} maxDepth={props.maxDepth} account={x} />)}
    </>
  );
});

export default component$(() => {
  useStylesScoped$(styles);

  const accounts = useGetAccounts();
  const maxDepth = useComputed$(() => {
    const traverseDepth = (accounts: Account[]): number => {
      return accounts.reduce((max, account) => Math.max(max, account.depth, traverseDepth(account.children)), 0);
    };

    return traverseDepth(accounts.value);
  });

  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const editMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Edit);
  const editMenuAccountId = useSignal<string>('');
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);

  const flatAccounts = useComputed$(() => {
    const res: Account[] = [];

    const traverse = (accounts: Account[]): void => {
      accounts.forEach(x => {
        res.push(x);
        traverse(x.children);
      });
    };

    traverse(accounts.value);

    return res;
  });

  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active"><Link href="#" aria-current="page">Haushaltskonten</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            <button class="button is-primary is-rounded"
              onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>Hinzufügen</button>
          </HeaderButtons>
        </Header>
        <table class="table is-hoverable is-striped is-fullwidth is-narrow">
          <thead>
            <tr>
              <th colSpan={maxDepth.value + 1}>Code</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.value.map((account) => <AccountRow editMenuAccountId={editMenuAccountId} menuStatus={menuStatus} maxDepth={maxDepth.value} account={account} />)}
          </tbody>
        </table>
      </MainContent>
      <MainContentMenu isShown={editMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          Haushaltskonto bearbeiten
        </MainContentMenuHeader>

        <EditAccountMenu accounts={accounts} accountId={editMenuAccountId}></EditAccountMenu>
      </MainContentMenu>
      <MainContentMenu isShown={createMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          Haushaltskonto hinzufügen
        </MainContentMenuHeader>

        <CreateAccountMenu accounts={flatAccounts.value} />
      </MainContentMenu>
    </>
  );
});

export const head: DocumentHead = {
  title: "VSFV | Haushaltskonten",
  meta: [],
};
