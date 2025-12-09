import { component$, Resource, useResource$, useSignal } from "@builder.io/qwik";
import { Link, routeLoader$, server$ } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";


export interface Transaction {
  id: string;
  date: Date;
  amount: string;
  debitAccountCode: string;
  debitAccountId: string;
  creditAccountCode: string;
  creditAccountId: string;
  description: string;
  assignedAccountId: string | null;
  assignedAccountName: string | null;
}

async function getTotalTransactions(): Promise<number> {
  return await Prisma.transactions.count();
}

async function getTransactions(page: number, size: number): Promise<Transaction[]> {
  const ts = await Prisma.transactions.findMany({
    include: {
      accounts: true,
      transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts: true,
      transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts: true
    },
    orderBy: {
      created_at: 'desc'
    },
    skip: (page - 1) * size,
    take: size
  });

  return ts.map(t => {
    return {
      id: t.id,
      date: t.booked_at,
      amount: t.amount.toString(),
      debitAccountCode: t.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.code,
      debitAccountId: t.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.id,
      creditAccountCode: t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.code,
      creditAccountId: t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.id,
      description: t.description,
      assignedAccountId: t.assigned_account_id,
      assignedAccountName: t.accounts?.display_name ?? null
    };
  });
}

export const getTransactionsServer = server$(async ({ page, size }: { page: number, size: number }) => {
  return {
    totalPages: Math.ceil(await getTotalTransactions() / size),
    transactions: await getTransactions(page, size)
  };
});

export default component$(() => {
  const page = useSignal<{
    page: number;
    size: number;
  }>({
    page: 1,
    size: 100
  });

  const transactionsResource = useResource$(async ({ track }) => {
    track(() => page.value);

    return await getTransactionsServer({
      page: page.value.page,
      size: page.value.size
    });
  });

  return (<>
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li class="is-active"><Link href="#" aria-current="page">Journal</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          <Link href="/journal/import" class="button is-primary is-rounded">Importieren...</Link>
        </HeaderButtons>
      </Header>
      <Resource value={transactionsResource} onResolved={(res) => {
        const pages = [];

        if (page.value.page - 2 > 0) {
          pages.push(page.value.page - 2);
        }

        if (page.value.page - 1 > 0) {
          pages.push(page.value.page - 1);
        }

        pages.push(page.value.page);

        if (page.value.page + 1 <= res.totalPages) {
          pages.push(page.value.page + 1);
        }

        if (page.value.page + 2 <= res.totalPages) {
          pages.push(page.value.page + 2);
        }

        return <>
          <table class="table is-narrow is-hoverable is-striped is-fullwidth">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Betrag</th>
                <th>Sollkonto</th>
                <th>Habenkonto</th>
                <th>Buchungstext</th>
                <th>Haushaltskonto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {res.transactions.map(x => <tr>
                <td class="is-vcentered">{formatDateShort(x.date)}</td>
                <td class="is-vcentered">{formatCurrency(x.amount)}</td>
                <td class="is-vcentered"><Link href={`/transactionAccounts/${x.debitAccountId}`}>{x.debitAccountCode}</Link></td>
                <td class="is-vcentered"><Link href={`/transactionAccounts/${x.creditAccountId}`}>{x.creditAccountCode}</Link></td>
                <td class="is-vcentered">{x.description}</td>
                <td class="is-vcentered">
                  {x.assignedAccountId === null ? '-' : <Link href={`/accounts/${x.assignedAccountId}`}>{x.assignedAccountName}</Link>}
                </td>
                <td class="is-vcentered">
                  <div class="buttons are-small is-right">
                    <button class="button is-danger is-outlined">Stornieren</button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>

          <nav class="pagination is-small is-centered" role="navigation" aria-label="pagination">
            {page.value.page > 1 && <button class="pagination-previous" onClick$={() => {
                page.value = {
                  page: page.value.page - 1,
                  size: page.value.size
                };
              }}>Vorherige</button>}
            {page.value.page < res.totalPages && <button class="pagination-next" onClick$={() => {
                page.value = {
                  page: page.value.page + 1,
                  size: page.value.size
                };
              }}>Nächste</button>}
            <ul class="pagination-list">
              {pages.map(x => <li><a class={["pagination-link", {
                'is-current': x === page.value.page
              }]} aria-label={`Goto page ${x}`} onClick$={() => {
                if (x === page.value.page) {
                  return;
                }

                page.value = {
                  page: x,
                  size: page.value.size
                };
              }}>{x}</a></li>)}
            </ul>
          </nav>
        </>;
      }} />
    </MainContent>
  </>);
})
