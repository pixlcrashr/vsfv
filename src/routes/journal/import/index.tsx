import { component$, useSignal } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$, useNavigate, z, zod$ } from "@builder.io/qwik-city";
import Decimal from "decimal.js";
import { createHash } from 'node:crypto';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import { formatCurrency, formatDateInputField, formatDateShort } from "~/lib/format";
import { parseTransactions, Transaction } from "~/lib/lexware/parser";
import { Prisma } from "~/lib/prisma";
import { Prisma as P } from "~/lib/prisma/generated/client";



export const UploadTransactionsSchema = {
  sourceId: z.string().uuid(),
  type: z.string().regex(/lexware/),
  file: z.any()
};

function escapeCustomIdDelimiter(s: string): string {
  return s.replace(/:/g, '\\:');
}

function transactionToCustomId(
  bookedAt: Date,
  receiptFrom: Date,
  creditAccount: string,
  debitAccount: string,
  amount: Decimal,
  reference: string,
  description: string
): string {
  return `v1:${bookedAt.toISOString().slice(0, 10)}:${receiptFrom.toISOString().slice(0, 10)}:${escapeCustomIdDelimiter(creditAccount)}:${escapeCustomIdDelimiter(debitAccount)}:${amount.toString()}:${escapeCustomIdDelimiter(`${reference}`)}:${escapeCustomIdDelimiter(description)}`;
}

export const useUploadTransactionsRouteAction = routeAction$(async (args) => {
  if (args.file) {
    const source = await Prisma.import_sources.findFirst({
      where: {
        id: args.sourceId
      }
    });
    if (source === null) {
      return {
        success: false,
      }
    }

    const f = args.file as File;

    const ts = await parseTransactions(f);

    const matchingTransactions = await Prisma.transactions.findMany({
      where: {
        custom_id: {
          in: ts.map(x => transactionToCustomId(
            x.bookedAt,
            x.receiptFrom,
            x.creditAccount,
            x.debitAccount,
            x.amount,
            `${x.receiptNumberGroup}${x.receiptNumber}`,
            x.description
          ))
        }
      }
    });

    const res = ts.filter(t => matchingTransactions.every(x => x.custom_id !== transactionToCustomId(
        t.bookedAt,
        t.receiptFrom,
        t.creditAccount,
        t.debitAccount,
        t.amount,
        `${t.receiptNumberGroup}${t.receiptNumber}`,
        t.description
      ))).map(t => ({
      receiptFrom: t.receiptFrom,
      bookedAt: t.bookedAt,
      reference: `${t.receiptNumberGroup}${t.receiptNumber}`,
      description: t.description,
      amount: t.amount.toString(),
      debitAccount: t.debitAccount,
      creditAccount: t.creditAccount,
    }));
    res.sort((a, b) => a.receiptFrom.getTime() - b.receiptFrom.getTime());

    return {
      success: true,
      result: res,
      sourceId: source.id
    };
  }

  return {
    success: false,
    result: []
  };
}, zod$(UploadTransactionsSchema));

export const ImportTransactionsSchema = {
  sourceId: z.string().uuid(),
  transactions: z.array(z.object({
    receiptFrom: z.string().date(),
    bookedAt: z.string().date(),
    amount: z.string(),
    description: z.string(),
    reference: z.string(),
    debitAccount: z.string().min(1),
    creditAccount: z.string().min(1),
    accountId: z.string().optional()
  }))
};

export const useImportTransactionsRouteAction = routeAction$(async (args) => {
  if (args.sourceId === '') {
    return {
      success: false
    };
  }

  const transactionAccountCodes = new Set<string>();

  args.transactions.forEach(t => {
    transactionAccountCodes.add(t.debitAccount);
    transactionAccountCodes.add(t.creditAccount);
  });

  const tas = await Prisma.transaction_accounts.findMany({
    where: {
      import_source_id: args.sourceId,
      code: {
        in: Array.from(transactionAccountCodes)
      }
    }
  });

  const m = new Map<string, string>();

  for (const c of transactionAccountCodes) {
    const ta = tas.find(x => x.code === c);

    if (ta) {
      m.set(c, ta.id);
    } else {
      const ta = await Prisma.transaction_accounts.create({
        data: {
          import_source_id: args.sourceId,
          code: c,
          display_name: '',
          display_description: '',
        }
      });
      tas.push(ta);
      m.set(c, ta.id);
    }
  }

  for (const t of args.transactions) {
    const accountId = t.accountId === undefined || t.accountId === 'ignore' ? null : t.accountId;

    await Prisma.transactions.create({
      data: {
        amount: P.Decimal(t.amount),
        booked_at: new Date(t.bookedAt),
        document_date: new Date(t.receiptFrom),
        reference: t.reference,
        description: t.description,
        credit_transaction_account_id: m.get(t.creditAccount) ?? '',
        debit_transaction_account_id: m.get(t.debitAccount) ?? '',
        custom_id: transactionToCustomId(
          new Date(t.bookedAt),
          new Date(t.receiptFrom),
          t.creditAccount,
          t.debitAccount,
          new Decimal(t.amount),
          t.reference,
          t.description
        ),
        assigned_account_id: accountId
      }
    });
  }

  return {
    success: true
  };
}, zod$(ImportTransactionsSchema));

export interface Account {
  id: string;
  name: string;
}

async function getAllAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany();

  const getPrefix = (parentAccountId: string | null): string => {
    if (parentAccountId === null) {
      return '';
    }

    const a = as.find(x => x.id === parentAccountId);

    return getPrefix(a?.parent_account_id ?? null) + a?.display_code + '-';
  };

  return as.filter(x => as.every(y => y.parent_account_id !== x.id)).map(x => ({
    id: x.id,
    name: `${getPrefix(x.parent_account_id)}${x.display_code} | ${x.display_name}`
  }));
}

export const useGetAllAccountsLoader = routeLoader$<Account[]>(() => {
  return getAllAccounts();
});

export interface ImportSource {
  id: string;
  name: string;
}

async function getAllImportSources(): Promise<ImportSource[]> {
  return (await Prisma.import_sources.findMany()).map(x => ({
    id: x.id,
    name: x.display_name
  }));
}

export const useGetAllImportSourcesLoader = routeLoader$<ImportSource[]>(() => {
  return getAllImportSources();
})

export default component$(() => {
  const filename = useSignal<string>('');
  const fileRef = useSignal<HTMLInputElement | undefined>(undefined);
  const nav = useNavigate();

  const importType = useSignal<string>('');
  const selectedSourceId = useSignal<string>('');

  const accounts = useGetAllAccountsLoader();
  const importSources = useGetAllImportSourcesLoader();
  const uploadTransactionsAction = useUploadTransactionsRouteAction();
  const importTransactionsAction = useImportTransactionsRouteAction();

  const uploadLoading = useSignal<boolean>(false);

  const transactions = useSignal<{
    receiptFrom: Date;
    bookedAt: Date;
    reference: string;
    description: string;
    amount: string;
    debitAccount: string;
    creditAccount: string;
  }[] | null>(null);

  return (
    <MainContentLarge>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/journal" aria-current="page">Journal</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">Importieren...</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>

        </HeaderButtons>
      </Header>

      <div class="field">
        <label class="label">Importtyp</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select name="type" onChange$={(event, elem) => importType.value = elem.value}>
              <option disabled selected>- bitte auswählen -</option>
              <option value="lexware">Lexware Buchhaltung</option>
            </select>
          </div>
        </div>
        {importType.value === 'lexware' && <p class="help">Das Lexware Journal muss als CSV und mit dem Trennzeichen ";" exportiert werden. Andernfalls kann das Journal nicht automatisch ausgelesen werden.</p>}
      </div>
      <div class="field">
        <label class="label">Importquelle</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select name="sourceId" onChange$={(event, elem) => {
              selectedSourceId.value = elem.value;
            }}>
              <option disabled selected>- bitte auswahlen -</option>
              {importSources.value.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div class="pt-5 file has-name is-fullwidth">
        <label class="file-label">
          <input class="file-input" type="file" onChange$={(event, elem) => {
            filename.value = elem.files?.[0].name ?? '';
          }} ref={fileRef} />
          <span class="file-cta">
            <span class="file-icon">
              <i class="fas fa-upload"></i>
            </span>
            <span class="file-label"> Datei auswählen… </span>
          </span>
          <span class="file-name">{filename.value}</span>
        </label>
      </div>

      <div class="buttons is-right is-fullwidth">
        <button type="submit" disabled={filename.value === ''} class={["button", "is-primary", {
          'is-loading': uploadLoading.value
        }]} onClick$={async () => {
          const file = fileRef.value?.files?.[0];

          if (file) {
            const formData = new FormData();

            formData.append('type', importType.value);
            formData.append('file', file);
            formData.append('sourceId', selectedSourceId.value);

            uploadLoading.value = true;
            transactions.value = null;
            const { value } = await uploadTransactionsAction.submit(formData);
            transactions.value = value.result ?? [];
            selectedSourceId.value = value.sourceId ?? '';
            uploadLoading.value = false;
          }
        }}>Hochladen</button>
      </div>

      {transactions.value !== null && transactions.value.length === 0 && <p class="has-text-centered is-size-5">Es wurden keine Transaktionen gefunden.</p>}

      {transactions.value !== null && transactions.value.length > 0 && <Form action={importTransactionsAction} onSubmitCompleted$={async () => {
        await nav('/journal');
      }}>
        <input hidden name="sourceId" value={selectedSourceId.value} />
        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Betrag</th>
              <th>Sollkonto</th>
              <th>Habenkonto</th>
              <th>Buchungstext</th>
              <th>Referenz</th>
              <th>Haushaltskonto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.value.map((x, i) => <tr key={i}>
              <td class="is-vcentered">
                <input hidden name={`transactions.${i}.bookedAt`} type="date" value={formatDateInputField(x.bookedAt)} />
                <input hidden name={`transactions.${i}.receiptFrom`} type="data" value={formatDateInputField(x.receiptFrom)} />

                {formatDateShort(x.bookedAt)}
              </td>
              <td class="is-vcentered has-text-right">
                <input hidden name={`transactions.${i}.amount`} value={x.amount.toString()} />
                {formatCurrency(x.amount.toString())}
              </td>
              <td class="is-vcentered has-text-right">
                <input hidden name={`transactions.${i}.debitAccount`} value={x.debitAccount} />
                {x.debitAccount}
              </td>
              <td class="is-vcentered has-text-right">
                <input hidden name={`transactions.${i}.creditAccount`} value={x.creditAccount} />
                {x.creditAccount}
              </td>
              <td class="is-vcentered">
                <input hidden name={`transactions.${i}.description`} value={x.description} />
                {x.description}
              </td>
              <td class="is-vcentered">
                <input hidden name={`transactions.${i}.reference`} value={x.reference} />
                {x.reference}
              </td>
              <td class="is-vcentered">
                <div class="select is-small">
                  <select name={`transactions.${i}.accountId`}>
                    <option selected disabled>- bitte auswählen -</option>
                    <option value="ignore">Ignorieren</option>
                    <option disabled>---</option>
                    {accounts.value.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}
                  </select>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
        <div class="buttons is-right is-fullwidth">
          <button type="submit" disabled={transactions.value.length === 0 || importTransactionsAction.isRunning} class="button is-primary">Importieren</button>
        </div>
      </Form>}
    </MainContentLarge >
  );
});
