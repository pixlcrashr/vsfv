import { $, component$, useComputed$, useStore } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import { Decimal } from "decimal.js";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { Prisma as P } from "~/lib/prisma/generated/client";
import { useMinLoading } from "~/lib/delay";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";
import VirtualizedAccountSelect from "~/components/journal/VirtualizedAccountSelect";

export const onRequest: RequestHandler = requirePermission(Permissions.TRANSACTIONS_UPDATE);

interface TransactionDetails {
  id: string;
  documentDate: Date;
  bookedAt: Date;
  amount: string;
  description: string;
  reference: string;
  debitAccountCode: string;
  creditAccountCode: string;
  canDelete: boolean;
  accountAssignments: Array<{
    id: string;
    accountId: string;
    accountName: string;
    value: string;
  }>;
}

interface Account {
  id: string;
  name: string;
  isArchived?: boolean;
}

async function getTransaction(id: string): Promise<TransactionDetails | null> {
  try {
    const t = await Prisma.transactions.findUnique({
      where: { id },
      include: {
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
      }
    });

    if (!t) return null;

    const documentYear = t.document_date.getFullYear();
    const importSource = t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.import_sources;
    const importSourcePeriod = importSource?.importSourcePeriods.find(p => p.year === documentYear);
    const canDelete = !importSourcePeriod?.is_closed;

    return {
      id: t.id,
      documentDate: t.document_date,
      bookedAt: t.booked_at,
      amount: t.amount.toString(),
      description: t.description,
      reference: t.reference,
      debitAccountCode: t.transaction_accounts_transactions_debit_transaction_account_idTotransaction_accounts.code,
      creditAccountCode: t.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.code,
      canDelete,
      accountAssignments: t.transaction_account_assignments.map(a => ({
        id: a.id,
        accountId: a.account_id,
        accountName: a.accounts.display_name,
        value: a.value.toString()
      }))
    };
  } catch {
    return null;
  }
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

  // Check if account or any parent is archived
  const isEffectivelyArchived = (accountId: string): boolean => {
    const account = as.find(x => x.id === accountId);
    if (!account) return false;
    if (account.is_archived) return true;
    if (account.parent_account_id) {
      return isEffectivelyArchived(account.parent_account_id);
    }
    return false;
  };

  // Return all leaf accounts with archived status
  return as
    .filter(x => as.every(y => y.parent_account_id !== x.id))
    .map(x => ({
      id: x.id,
      name: `${getCodePrefix(x.parent_account_id)}${x.display_code} | ${getNamePrefix(x.parent_account_id)}${x.display_name}`,
      isArchived: isEffectivelyArchived(x.id)
    }));
}

export const useGetTransaction = routeLoader$<TransactionDetails>(async (req) => {
  const t = await getTransaction(req.params.id);
  if (!t) {
    throw req.redirect(307, "/journal");
  }
  return t;
});

export const useGetAllAccounts = routeLoader$<Account[]>(() => getAllAccounts());

export const useTransactionPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canDelete: Permissions.TRANSACTIONS_DELETE
  });
});

export const UpdateTransactionSchema = {
  accountAssignments: z.array(z.object({
    accountId: z.string(),
    value: z.string()
  })).optional().default([])
};

export const useUpdateTransactionAction = routeAction$(async (args, req) => {
  const auth = await withPermission(req.sharedMap, req.fail, Permissions.TRANSACTIONS_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const transactionId = req.params.id;
  const transaction = await Prisma.transactions.findUnique({
    where: { id: transactionId },
    include: {
      transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts: {
        include: {
          import_sources: {
            include: {
              importSourcePeriods: true
            }
          }
        }
      }
    }
  });

  if (!transaction) {
    return req.fail(404, { message: 'Transaction not found' });
  }

  const documentYear = transaction.document_date.getFullYear();
  const importSource = transaction.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.import_sources;
  const importSourcePeriod = importSource?.importSourcePeriods.find(p => p.year === documentYear);
  if (importSourcePeriod?.is_closed) {
    return req.fail(400, { message: 'Die Importperiode ist geschlossen. Bearbeitung nicht möglich.' });
  }

  const transactionAmount = new Decimal(transaction.amount.toString());
  const assignments = args.accountAssignments.filter(a => a.accountId !== '');

  if (assignments.length > 0) {
    const totalAssigned = assignments.reduce((sum, a) => sum.plus(new Decimal(a.value)), new Decimal(0));
    if (!totalAssigned.equals(transactionAmount)) {
      return req.fail(400, {
        message: `Die Zuweisungen müssen ${transactionAmount.toString()} ergeben, aber es wurden ${totalAssigned.toString()} zugewiesen.`
      });
    }
  }

  await Prisma.transaction_account_assignments.deleteMany({
    where: { transaction_id: transactionId }
  });

  for (const assignment of assignments) {
    if (assignment.accountId === 'ignore') {
      continue;
    }

    await Prisma.transaction_account_assignments.create({
      data: {
        transaction_id: transactionId,
        account_id: assignment.accountId,
        value: P.Decimal(assignment.value)
      }
    });
  }

  // Redirect to returnUrl if provided, otherwise to /journal
  const returnUrl = req.url.searchParams.get('returnUrl') || '/journal';
  throw req.redirect(307, returnUrl);
}, zod$(UpdateTransactionSchema));

function parseDecimalValue(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export default component$(() => {
  const transaction = useGetTransaction();
  const accounts = useGetAllAccounts();
  const permissions = useTransactionPermissions();
  const updateAction = useUpdateTransactionAction();
  const isLoading = useMinLoading($(() => updateAction.isRunning));

  const assignments = useStore<{ value: Array<{ accountId: string; value: string }> }>({
    value: (() => {
      if (transaction.value.accountAssignments.length === 0) {
        return [{ accountId: '', value: transaction.value.amount }];
      }

      const existingAssignments = transaction.value.accountAssignments.map(a => ({
        accountId: a.accountId,
        value: a.value
      }));

      // Calculate if there's an unassigned amount
      const transactionAmount = parseDecimalValue(transaction.value.amount);
      const totalAssigned = existingAssignments.reduce((sum, a) => sum + parseDecimalValue(a.value), 0);
      const unassignedAmount = transactionAmount - totalAssigned;

      // If there's an unassigned amount, add an ignored row
      if (unassignedAmount > 0.01) {
        existingAssignments.push({ accountId: 'ignore', value: unassignedAmount.toFixed(2) });
      }

      return existingAssignments;
    })()
  });

  const transactionAmount = parseFloat(transaction.value.amount);
  const totalAssigned = useComputed$(() => {
    return assignments.value
      .filter(a => a.accountId !== '' && a.accountId !== 'ignore')
      .reduce((sum, a) => sum + parseDecimalValue(a.value), 0);
  });
  const ignoredValue = useComputed$(() => {
    return assignments.value
      .filter(a => a.accountId === 'ignore')
      .reduce((sum, a) => sum + parseDecimalValue(a.value), 0);
  });
  const totalWithIgnored = useComputed$(() => totalAssigned.value + ignoredValue.value);
  const diff = useComputed$(() => totalWithIgnored.value - transactionAmount);
  const diffIsZero = useComputed$(() => Math.abs(diff.value) < 0.01);
  const remainingAmount = useComputed$(() => transactionAmount - totalWithIgnored.value);
  const hasIgnoredValue = useComputed$(() => ignoredValue.value > 0.01);
  const hasUnselectedAssignment = useComputed$(() => assignments.value.some(a => a.accountId === ''));

  return (
    <>
      <MainContent>
        <Form action={updateAction}>
          <Header>
            <HeaderTitle>
              <nav class="breadcrumb" aria-label="breadcrumbs">
                <ul>
                  <li><Link href="/journal">{_`Journal`}</Link></li>
                  <li class="is-active"><Link href="#" aria-current="page">{_`Transaktion bearbeiten`}</Link></li>
                </ul>
              </nav>
            </HeaderTitle>
            <HeaderButtons>
              {permissions.value.canDelete && transaction.value.canDelete && (
                <Link href={`/transactions/${transaction.value.id}/delete`} class="button is-danger is-outlined">{_`Entfernen`}</Link>
              )}
            </HeaderButtons>
          </Header>

          <div class="box">
            <div class="columns">
              <div class="column">
                <div class="field">
                  <label class="label">{_`Belegdatum`}</label>
                  <div class="control">
                    <input class="input" type="text" value={formatDateShort(transaction.value.documentDate)} disabled />
                  </div>
                </div>
              </div>
              <div class="column">
                <div class="field">
                  <label class="label">{_`Buchungsdatum`}</label>
                  <div class="control">
                    <input class="input" type="text" value={formatDateShort(transaction.value.bookedAt)} disabled />
                  </div>
                </div>
              </div>
            </div>

            <div class="columns">
              <div class="column">
                <div class="field">
                  <label class="label">{_`Betrag`}</label>
                  <div class="control">
                    <input class="input" type="text" value={formatCurrency(transaction.value.amount)} disabled />
                  </div>
                </div>
              </div>
              <div class="column">
                <div class="field">
                  <label class="label">{_`Referenz`}</label>
                  <div class="control">
                    <input class="input" type="text" value={transaction.value.reference} disabled />
                  </div>
                </div>
              </div>
            </div>

            <div class="columns">
              <div class="column">
                <div class="field">
                  <label class="label">{_`Sollkonto`}</label>
                  <div class="control">
                    <input class="input" type="text" value={transaction.value.debitAccountCode} disabled />
                  </div>
                </div>
              </div>
              <div class="column">
                <div class="field">
                  <label class="label">{_`Habenkonto`}</label>
                  <div class="control">
                    <input class="input" type="text" value={transaction.value.creditAccountCode} disabled />
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <label class="label">{_`Buchungstext`}</label>
              <div class="control">
                <input class="input" type="text" value={transaction.value.description} disabled />
              </div>
            </div>
          </div>

          <div class="box">
            <h2 class="subtitle">{_`Haushaltskonto-Zuweisungen`}</h2>

            <div>
              {assignments.value.map((assignment, j) => (
                <div key={j} class="field has-addons mb-2">
                  <div class="control is-expanded">
                    <VirtualizedAccountSelect
                      name={`accountAssignments.${j}.accountId`}
                      value={assignment.accountId}
                      accounts={accounts.value}
                      isInvalid={assignment.accountId === '' || assignment.accountId === undefined}
                      onValueChange$={(newValue) => assignments.value[j].accountId = newValue}
                    />
                  </div>
                  <div class="control">
                    <input
                      class="input is-small has-text-right"
                      type="text"
                      autocomplete="off"
                      pattern="[0-9]+([.,][0-9]{1,2})?"
                      name={`accountAssignments.${j}.value`}
                      value={assignment.value}
                      style="width: 100px;"
                      placeholder="0,00"
                      onChange$={(_, elem) => assignments.value[j].value = elem.value}
                    />
                  </div>
                  <div class="control">
                    <button
                      type="button"
                      class="button is-small is-danger"
                      disabled={assignments.value.length === 1}
                      onClick$={() => assignments.value = assignments.value.filter((_, idx) => idx !== j)}
                    >
                      <span class="icon is-small">
                        <i class="fas fa-minus"></i>
                      </span>
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                class="button is-small is-outlined is-success is-fullwidth"
                onClick$={() => assignments.value = [...assignments.value, { accountId: '', value: remainingAmount.value.toFixed(2) }]}
              >
                <span class="icon is-small">
                  <i class="fas fa-plus"></i>
                </span>
                <span>{_`Zuweisung hinzufügen`}</span>
              </button>

              {hasIgnoredValue.value && (
                <div class="notification is-light is-warning mt-3 py-2 px-3">
                  <span class="icon-text">
                    <span class="icon"><i class="fas fa-info-circle"></i></span>
                    <span><em>{_`Ignoriert`}:</em> {formatCurrency(ignoredValue.value.toFixed(2))}</span>
                  </span>
                </div>
              )}

              <div class="has-text-right pb-2" style="padding-right: 2rem;">
                <div class="is-size-7">
                  <div>{formatCurrency(totalAssigned.value.toFixed(2))}</div>
                  {hasIgnoredValue.value && <div>+ {formatCurrency(ignoredValue.value.toFixed(2))} ({_`Ignoriert`})</div>}
                  <hr class="my-1" />
                  <div>- {formatCurrency(transaction.value.amount)}</div>
                  <div class={{ "has-text-success": diffIsZero.value, "has-text-danger": !diffIsZero.value }}>= {formatCurrency(diff.value.toFixed(2))}</div>
                </div>
              </div>
            </div>
          </div>

          {updateAction.value?.failed && (
            <div class="notification is-danger">
              {(updateAction.value as any).message || _`Ein Fehler ist aufgetreten.`}
            </div>
          )}

          <div class="buttons is-right">
            <button
              type="submit"
              class={['button', 'is-primary', { 'is-loading': isLoading.value }]}
              disabled={!diffIsZero.value || !transaction.value.canDelete || hasUnselectedAssignment.value}
            >
              {_`Speichern`}
            </button>
          </div>
        </Form>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Transaktion bearbeiten`,
  meta: [],
};
