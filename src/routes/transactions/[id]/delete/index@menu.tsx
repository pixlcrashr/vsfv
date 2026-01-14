import { $, component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatCurrency, formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { useMinLoading } from "~/lib/delay";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.TRANSACTIONS_DELETE);

interface TransactionDetails {
  id: string;
  documentDate: Date;
  bookedAt: Date;
  amount: string;
  description: string;
  canDelete: boolean;
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
      canDelete
    };
  } catch {
    return null;
  }
}

async function deleteTransaction(transactionId: string): Promise<boolean> {
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

  if (!transaction) return false;

  const documentYear = transaction.document_date.getFullYear();
  const importSource = transaction.transaction_accounts_transactions_credit_transaction_account_idTotransaction_accounts.import_sources;
  const importSourcePeriod = importSource?.importSourcePeriods.find(p => p.year === documentYear);

  if (importSourcePeriod?.is_closed) {
    return false;
  }

  await Prisma.transaction_account_assignments.deleteMany({
    where: { transaction_id: transactionId }
  });

  await Prisma.transactions.delete({
    where: { id: transactionId }
  });

  return true;
}

export const useGetTransaction = routeLoader$<TransactionDetails>(async (req) => {
  const t = await getTransaction(req.params.id);
  if (!t) {
    throw req.redirect(307, "/journal");
  }
  if (!t.canDelete) {
    throw req.redirect(307, `/transactions/${req.params.id}`);
  }
  return t;
});

export const useDeleteTransactionAction = routeAction$(async (_, req) => {
  const auth = await withPermission(req.sharedMap, req.fail, Permissions.TRANSACTIONS_DELETE);
  if (!auth.authorized) {
    return auth.result;
  }

  const success = await deleteTransaction(req.params.id);
  if (!success) {
    return req.fail(400, { message: 'Die Transaktion kann nicht gelöscht werden, da die Importperiode geschlossen ist.' });
  }

  throw req.redirect(307, "/journal");
});

export default component$(() => {
  const transaction = useGetTransaction();
  const deleteAction = useDeleteTransactionAction();
  const isLoading = useMinLoading($(() => deleteAction.isRunning));

  return (
    <>
      <MainContent>
        <Form action={deleteAction}>
          <Header>
            <HeaderTitle>
              <nav class="breadcrumb" aria-label="breadcrumbs">
                <ul>
                  <li><Link href="/journal">{_`Journal`}</Link></li>
                  <li class="is-active"><Link href="#" aria-current="page">{_`Transaktion entfernen`}</Link></li>
                </ul>
              </nav>
            </HeaderTitle>
            <HeaderButtons>
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

            <div class="field">
              <label class="label">{_`Betrag`}</label>
              <div class="control">
                <input class="input" type="text" value={formatCurrency(transaction.value.amount)} disabled />
              </div>
            </div>

            <div class="field">
              <label class="label">{_`Buchungstext`}</label>
              <div class="control">
                <input class="input" type="text" value={transaction.value.description} disabled />
              </div>
            </div>
          </div>

          {!transaction.value.canDelete && (
            <div class="notification is-warning">
              {_`Diese Transaktion kann nicht gelöscht werden, da die Importperiode geschlossen ist.`}
            </div>
          )}

          {deleteAction.value?.failed && (
            <div class="notification is-danger">
              {(deleteAction.value as any).message || _`Ein Fehler ist aufgetreten.`}
            </div>
          )}

          <div>
            <p class="has-text-centered is-size-5">{_`Möchtest du diese Transaktion wirklich entfernen?`}</p>
          </div>

          <div class="buttons mt-6 is-centered">
            <Link href="/journal" class="button">{_`Abbrechen`}</Link>
            <button
              type="submit"
              disabled={!transaction.value.canDelete}
              class={['button', 'is-danger', { 'is-loading': isLoading.value }]}
            >
              {_`Entfernen`}
            </button>
          </div>
        </Form>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Transaktion entfernen`,
  meta: [],
};
