import { component$, useSignal, useComputed$, useStylesScoped$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeLoader$, server$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, Permissions } from "~/lib/auth";
import VirtualizedAccountSelect from "~/components/journal/VirtualizedAccountSelect";
import styles from "~/components/journal/VirtualizedAccountSelect.scss?inline";



export const onRequest: RequestHandler = requirePermission(Permissions.ACCOUNTS_READ);

interface Account {
  id: string;
  name: string;
  code: string;
}

interface Transaction {
  id: string;
  documentDate: Date;
  bookedAt: Date;
  amount: string;
  description: string;
  debitAccountCode: string;
  creditAccountCode: string;
}

async function getAllAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany();

  const getCodePrefix = (parentAccountId: string | null): string => {
    if (parentAccountId === null) return '';
    const a = as.find(x => x.id === parentAccountId);
    return getCodePrefix(a?.parent_account_id ?? null) + a?.display_code + '-';
  };

  const getNamePrefix = (parentAccountId: string | null): string => {
    if (parentAccountId === null) return '';
    const a = as.find(x => x.id === parentAccountId);
    return getNamePrefix(a?.parent_account_id ?? null) + a?.display_name + ' / ';
  };

  return as
    .filter(x => as.every(y => y.parent_account_id !== x.id))
    .map(x => ({
      id: x.id,
      code: `${getCodePrefix(x.parent_account_id)}${x.display_code}`,
      name: `${getCodePrefix(x.parent_account_id)}${x.display_code} | ${getNamePrefix(x.parent_account_id)}${x.display_name}`
    }));
}

async function getAccountTransactions(accountId: string): Promise<Transaction[]> {
  if (!accountId) return [];

  const assignments = await Prisma.transaction_account_assignments.findMany({
    where: { account_id: accountId },
    include: {
      transactions: {
        include: {
          transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts: true,
          transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts: true
        }
      }
    },
    orderBy: {
      transactions: {
        document_date: 'desc'
      }
    }
  });

  return assignments.map(a => ({
    id: a.transactions.id,
    documentDate: a.transactions.document_date,
    bookedAt: a.transactions.booked_at,
    amount: a.value.toString(),
    description: a.transactions.description,
    debitAccountCode: a.transactions.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.code,
    creditAccountCode: a.transactions.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.code
  }));
}

export const useGetAllAccounts = routeLoader$<Account[]>(async () => {
  return await getAllAccounts();
});

export const getAccountTransactionsServer = server$(async (accountId: string) => {
  return await getAccountTransactions(accountId);
});

export default component$(() => {
  useStylesScoped$(styles);
  const accounts = useGetAllAccounts();

  const leftAccountId = useSignal<string>('');
  const rightAccountId = useSignal<string>('');

  const leftTransactions = useSignal<Transaction[]>([]);
  const rightTransactions = useSignal<Transaction[]>([]);

  const leftLoading = useSignal<boolean>(false);
  const rightLoading = useSignal<boolean>(false);

  const leftTotal = useComputed$(() => {
    return leftTransactions.value.reduce((sum, t) => sum + parseFloat(t.amount), 0).toFixed(2);
  });

  const rightTotal = useComputed$(() => {
    return rightTransactions.value.reduce((sum, t) => sum + parseFloat(t.amount), 0).toFixed(2);
  });

  return (
    <>
      <MainContentLarge>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/accounts">{_`Haushaltskonten`}</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">{_`Kontenvergleich`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
          </HeaderButtons>
        </Header>

        <div class="columns">
          <div class="column">
            <div class="box">
              <div class="field">
                <label class="label">{_`Linkes Konto`}</label>
                <div class="control">
                  <VirtualizedAccountSelect
                    name="leftAccount"
                    value={leftAccountId.value}
                    accounts={accounts.value}
                    onValueChange$={async (value) => {
                      leftAccountId.value = value;
                      if (value && value !== 'ignore') {
                        leftLoading.value = true;
                        leftTransactions.value = await getAccountTransactionsServer(value);
                        leftLoading.value = false;
                      } else {
                        leftTransactions.value = [];
                      }
                    }}
                  />
                </div>
              </div>

              {leftLoading.value ? (
                <div class="has-text-centered py-4">
                  <span class="icon is-large">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                  </span>
                </div>
              ) : (
                <>
                  {leftAccountId.value && (
                    <div class="mt-4">
                      <p class="is-size-6 has-text-weight-bold mb-2">
                        {_`Summe`}: {formatCurrency(leftTotal.value)} ({leftTransactions.value.length} {_`Buchungen`})
                      </p>
                      <table class="table is-narrow is-hoverable is-striped is-fullwidth">
                        <thead>
                          <tr>
                            <th>{_`Belegdatum`}</th>
                            <th>{_`Betrag`}</th>
                            <th>{_`Soll`}</th>
                            <th>{_`Haben`}</th>
                            <th>{_`Buchungstext`}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leftTransactions.value.length === 0 && (
                            <tr>
                              <td colSpan={5} class="has-text-centered">
                                <p class="is-size-6">{_`Keine Buchungen`}</p>
                              </td>
                            </tr>
                          )}
                          {leftTransactions.value.map(t => (
                            <tr key={t.id}>
                              <td class="is-vcentered">{formatDateShort(t.documentDate)}</td>
                              <td class="is-vcentered">{formatCurrency(t.amount)}</td>
                              <td class="is-vcentered has-text-right">{t.debitAccountCode}</td>
                              <td class="is-vcentered has-text-right">{t.creditAccountCode}</td>
                              <td class="is-vcentered">{t.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div class="column">
            <div class="box">
              <div class="field">
                <label class="label">{_`Rechtes Konto`}</label>
                <div class="control">
                  <VirtualizedAccountSelect
                    name="rightAccount"
                    value={rightAccountId.value}
                    accounts={accounts.value}
                    onValueChange$={async (value) => {
                      rightAccountId.value = value;
                      if (value && value !== 'ignore') {
                        rightLoading.value = true;
                        rightTransactions.value = await getAccountTransactionsServer(value);
                        rightLoading.value = false;
                      } else {
                        rightTransactions.value = [];
                      }
                    }}
                  />
                </div>
              </div>

              {rightLoading.value ? (
                <div class="has-text-centered py-4">
                  <span class="icon is-large">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                  </span>
                </div>
              ) : (
                <>
                  {rightAccountId.value && (
                    <div class="mt-4">
                      <p class="is-size-6 has-text-weight-bold mb-2">
                        {_`Summe`}: {formatCurrency(rightTotal.value)} ({rightTransactions.value.length} {_`Buchungen`})
                      </p>
                      <table class="table is-narrow is-hoverable is-striped is-fullwidth">
                        <thead>
                          <tr>
                            <th>{_`Belegdatum`}</th>
                            <th>{_`Betrag`}</th>
                            <th>{_`Soll`}</th>
                            <th>{_`Haben`}</th>
                            <th>{_`Buchungstext`}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rightTransactions.value.length === 0 && (
                            <tr>
                              <td colSpan={5} class="has-text-centered">
                                <p class="is-size-6">{_`Keine Buchungen`}</p>
                              </td>
                            </tr>
                          )}
                          {rightTransactions.value.map(t => (
                            <tr key={t.id}>
                              <td class="is-vcentered">{formatDateShort(t.documentDate)}</td>
                              <td class="is-vcentered">{formatCurrency(t.amount)}</td>
                              <td class="is-vcentered has-text-right">{t.debitAccountCode}</td>
                              <td class="is-vcentered has-text-right">{t.creditAccountCode}</td>
                              <td class="is-vcentered">{t.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </MainContentLarge>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Kontenvergleich`,
  meta: [],
};
