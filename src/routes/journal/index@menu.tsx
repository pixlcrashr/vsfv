import { component$, Resource, useResource$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeLoader$, server$, useLocation, useNavigate, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import { Decimal } from "decimal.js";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, Permissions, checkPermissions } from "~/lib/auth";
import MainContentLarge from "~/components/layout/MainContentLarge";
import styles from './index@menu.scss?inline';



export const onRequest: RequestHandler = requirePermission(Permissions.JOURNAL_READ);

export interface Transaction {
  id: string;
  documentDate: Date;
  updatedAt: Date;
  amount: string;
  debitAccountCode: string;
  debitAccountName: string;
  debitAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  creditAccountId: string;
  description: string;
  assignedAccountId: string | null;
  assignedAccountName: string | null;
  isPeriodClosed: boolean;
  accountAssignments: Array<{
    id: string;
    accountId: string;
    accountName: string;
    value: string;
  }>;
}

async function getTotalTransactions(): Promise<number> {
  return await Prisma.transactions.count();
}

async function getTransactions(page: number, size: number): Promise<Transaction[]> {
  const allAccounts = await Prisma.accounts.findMany();
  
  const getFullAccountName = (accountId: string): string => {
    const account = allAccounts.find(a => a.id === accountId);
    if (!account) return '';
    
    const getNamePath = (acc: typeof account): string => {
      if (!acc.parent_account_id) {
        return acc.display_name;
      }
      const parent = allAccounts.find(a => a.id === acc.parent_account_id);
      if (!parent) return acc.display_name;
      return `${getNamePath(parent)} / ${acc.display_name}`;
    };
    
    return getNamePath(account);
  };

  const ts = await Prisma.transactions.findMany({
    include: {
      accounts: true,
      transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts: {
        include: {
          import_sources: {
            include: {
              importSourcePeriods: true
            }
          }
        }
      },
      transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts: true,
      transaction_account_assignments: {
        include: {
          accounts: true
        }
      }
    },
    orderBy: {
      document_date: 'desc'
    },
    skip: (page - 1) * size,
    take: size
  });

  return ts.map(t => {
    const documentYear = t.document_date.getFullYear();
    const importSource = t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.import_sources;
    const importSourcePeriod = importSource?.importSourcePeriods.find(p => p.year === documentYear);
    const isPeriodClosed = !!importSourcePeriod?.is_closed;

    return {
      id: t.id,
      documentDate: t.document_date,
      updatedAt: t.updated_at,
      amount: t.amount.toString(),
      debitAccountCode: t.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.code,
      debitAccountName: t.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.display_name || '',
      debitAccountId: t.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.id,
      creditAccountCode: t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.code,
      creditAccountName: t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.display_name || '',
      creditAccountId: t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.id,
      description: t.description,
      assignedAccountId: t.assigned_account_id,
      assignedAccountName: t.accounts ? getFullAccountName(t.accounts.id) : null,
      isPeriodClosed,
      accountAssignments: t.transaction_account_assignments.map(a => ({
        id: a.id,
        accountId: a.account_id,
        accountName: getFullAccountName(a.account_id),
        value: a.value.toString()
      }))
    };
  });
}

export const getTransactionsServer = server$(async ({ page, size }: { page: number, size: number }) => {
  return {
    totalPages: Math.ceil(await getTotalTransactions() / size),
    transactions: await getTransactions(page, size)
  };
});

export const useJournalPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canImport: Permissions.JOURNAL_IMPORT,
    canEditTransactions: Permissions.TRANSACTIONS_UPDATE,
    canDeleteTransactions: Permissions.TRANSACTIONS_DELETE
  });
});

export default component$(() => {
  useStylesScoped$(styles);

  const permissions = useJournalPermissions();
  const location = useLocation();
  const navigate = useNavigate();
  
  const initialPage = parseInt(location.url.searchParams.get('page') || '1', 10);
  const page = useSignal<{
    page: number;
    size: number;
  }>({
    page: isNaN(initialPage) || initialPage < 1 ? 1 : initialPage,
    size: 100
  });

  useTask$(({ track }) => {
    const currentPage = track(() => page.value.page);
    const url = new URL(location.url);
    
    if (currentPage === 1) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', currentPage.toString());
    }
    
    if (url.toString() !== location.url.toString()) {
      navigate(url.pathname + url.search, { replaceState: true });
    }
  });

  const transactionsResource = useResource$(async ({ track }) => {
    track(() => page.value);

    return await getTransactionsServer({
      page: page.value.page,
      size: page.value.size
    });
  });

  return (<>
    <MainContentLarge>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li class="is-active"><Link href="#" aria-current="page">{_`Journal`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          {permissions.value.canImport && (
            <Link href="/journal/import" class="button is-primary is-rounded">{_`Importieren...`}</Link>
          )}
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
                <th>{_`Belegdatum`}</th>
                <th>{_`Zuletzt bearbeitet`}</th>
                <th>{_`Sollkonto`}</th>
                <th>{_`Habenkonto`}</th>
                <th>{_`Buchungstext`}</th>
                <th>{_`Betrag`}</th>
                <th>{_`Haushaltskonten`}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {res.transactions.length === 0 && (
                <tr>
                  <td colSpan={8} class="has-text-centered">
                    <p class="is-size-6">{_`Keine Buchungen vorhanden`}</p>
                  </td>
                </tr>
              )}
              {res.transactions.map(x => <tr key={x.id}>
                <td class="is-vcentered">{formatDateShort(x.documentDate)}</td>
                <td class="is-vcentered">{formatDateShort(x.updatedAt)}</td>
                <td class="is-vcentered has-text-right">{x.debitAccountCode}{x.debitAccountName && ` (${x.debitAccountName})`}</td>
                <td class="is-vcentered has-text-right">{x.creditAccountCode}{x.creditAccountName && ` (${x.creditAccountName})`}</td>
                <td class="is-vcentered">{x.description}</td>
                <td class="is-vcentered has-text-right">{formatCurrency(x.amount)}</td>
                <td class="is-vcentered">
                  {x.accountAssignments.length === 0 ? (
                    x.assignedAccountId === null ? '-' : (
                      <div class="budget-account-item">
                        {(x.assignedAccountName?.split(' / ').slice(0, -1).length ?? 0) > 0 && (
                          <span class="budget-account-prefix">{x.assignedAccountName?.split(' / ').slice(0, -1).join(' / ')}</span>
                        )}
                        <Link class="budget-account-name" href={`/accounts/${x.assignedAccountId}`}>{x.assignedAccountName?.split(' / ').pop()}</Link>
                      </div>
                    )
                  ) : (() => {
                    const totalAssigned = x.accountAssignments.reduce(
                      (sum, a) => sum.plus(new Decimal(a.value)), 
                      new Decimal(0)
                    );
                    const transactionAmount = new Decimal(x.amount);
                    const ignoredValue = transactionAmount.minus(totalAssigned);
                    const hasIgnoredValue = ignoredValue.greaterThan(0);
                    
                    return (
                      <div class="budget-item-container">
                        {x.accountAssignments.map((assignment) => (
                          <div key={assignment.id} class="mb-1 budget-account-item">
                            {assignment.accountName.split(' / ').slice(0, -1).length > 0 && (
                              <span class="budget-account-prefix">{assignment.accountName.split(' / ').slice(0, -1).join(' / ')}</span>
                            )}
                            <span class="budget-account-name">
                              <Link href={`/accounts/${assignment.accountId}`}>{assignment.accountName.split(' / ').pop()}</Link>
                              <span class="has-text-grey"> ({formatCurrency(assignment.value)})</span>
                            </span>
                          </div>
                        ))}
                        {hasIgnoredValue && (
                          <div class="mb-1 budget-account-item">
                            <span class="budget-account-name has-text-grey-light">
                              <em>{_`Ignoriert`}</em>
                              <span> ({formatCurrency(ignoredValue.toString())})</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td class="is-vcentered">
                  <div class="buttons are-small is-right">
                    {permissions.value.canEditTransactions && !x.isPeriodClosed && (
                      <Link href={`/transactions/${x.id}?returnUrl=${encodeURIComponent(location.url.pathname + location.url.search)}`} class="button is-info is-outlined">{_`Bearbeiten`}</Link>
                    )}
                    {permissions.value.canDeleteTransactions && !x.isPeriodClosed && (
                      <Link href={`/transactions/${x.id}/delete`} class="button is-danger is-outlined">{_`Entfernen`}</Link>
                    )}
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>

          {res.totalPages > 1 && <nav class="pagination is-small is-centered" role="navigation" aria-label="pagination">
            {page.value.page > 1 && <button class="pagination-previous" onClick$={() => {
                page.value = {
                  page: page.value.page - 1,
                  size: page.value.size
                };
              }}>{_`Vorherige`}</button>}
            {page.value.page < res.totalPages && <button class="pagination-next" onClick$={() => {
                page.value = {
                  page: page.value.page + 1,
                  size: page.value.size
                };
              }}>{_`Nächste`}</button>}
            <ul class="pagination-list">
              {pages.map((x, i) => <li key={i}><button class={["pagination-link", {
                'is-current': x === page.value.page
              }]} aria-label={`Goto page ${x}`} onClick$={() => {
                if (x === page.value.page) {
                  return;
                }

                page.value = {
                  page: x,
                  size: page.value.size
                };
              }}>{x}</button></li>)}
            </ul>
          </nav>}
        </>;
      }} />
    </MainContentLarge>
  </>);
});

export const head: DocumentHead = {
  title: _`VSFV | Journal`,
  meta: [],
};
