import { component$, useSignal } from "@builder.io/qwik";
import { Link, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import Decimal from "decimal.js";
import { createHash } from 'node:crypto';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import { formatCurrency, formatDateInputField, formatDateShort } from "~/lib/format";
import { parseTransactions, Transaction } from "~/lib/lexware/parser";
import { Prisma } from "~/lib/prisma";



export const UploadTransactionsSchema = {
  type: z.string().regex(/lexware/),
  file: z.any()
};

function escapeCustomIdDelimiter(s: string): string {
  return s.replace(/:/g, '\\:');
}

function transactionToCustomId(t: Transaction): string {
  return `v1:${t.bookedAt.toISOString().slice(0, 10)}:${t.receiptFrom.toISOString().slice(0, 10)}:${escapeCustomIdDelimiter(t.creditAccount)}:${escapeCustomIdDelimiter(t.debitAccount)}:${t.amount.toString()}:${escapeCustomIdDelimiter(`${t.receiptNumberGroup}:${t.receiptNumber}`)}:${escapeCustomIdDelimiter(t.description)}`;
}

export const useUploadTransactionsRouteAction = routeAction$(async (args) => {
  if (args.file) {
    const f = args.file as File;

    const ts = await parseTransactions(f);

    const matchingTransactions = await Prisma.transactions.findMany({
      where: {
        custom_id: {
          in: ts.map(x => transactionToCustomId(x))
        }
      }
    });

    console.log(matchingTransactions);

    const res = ts.filter(t => matchingTransactions.every(x => x.custom_id !== transactionToCustomId(t))).map(t => ({
      receiptFrom: t.receiptFrom,
      bookedAt: t.bookedAt,
      reference: `${t.receiptNumberGroup}:${t.receiptNumber}`,
      description: t.description,
      amount: t.amount.toString(),
      debitAccount: t.debitAccount,
      creditAccount: t.creditAccount,
    }));
    res.sort((a, b) => a.receiptFrom.getTime() - b.receiptFrom.getTime());

    return {
      success: true,
      result: res
    };
  }

  return {
    success: false,
    result: []
  };
}, zod$(UploadTransactionsSchema));

export const ImportTransactionsSchema = {
  type: z.string(),
  transactions: z.array(z.object({
    date: z.string().date(),
    amount: z.string(),
    description: z.string(),
    debitAccount: z.string().min(1),
    creditAccount: z.string().min(1),
    accountId: z.string().optional()
  }))
};

function escapeHashDelimiter(s: string): string {
  return s.replace(/:/g, '\\:');
}

export const useImportTransactionsRouteAction = routeAction$(async (args) => {
  const transactionAccountCodes = new Set<string>();

  const hashes: string[] = [];

  args.transactions.forEach(t => {
    transactionAccountCodes.add(t.debitAccount);
    transactionAccountCodes.add(t.creditAccount);

    // hashing is done for the following string:
    // date:amount:description:creditAccount:debitAccount
    // this represents a unique transaction
    hashes.push(createHash('sha256').update(`${escapeHashDelimiter(t.date)}:${escapeHashDelimiter(new Decimal(t.amount).toString())}:${escapeHashDelimiter(t.description)}:${escapeHashDelimiter(t.creditAccount)}:${escapeHashDelimiter(t.debitAccount)}`).digest('hex'));
  });

  const tas = await Prisma.transaction_accounts.findMany({
    where: {
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
          code: c,
          display_name: '',
          display_description: '',
        }
      });
      tas.push(ta);
    }
  }
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

export default component$(() => {
  const filename = useSignal<string>('');
  const fileRef = useSignal<HTMLInputElement | undefined>(undefined);

  const importType = useSignal<string>('');

  const accounts = useGetAllAccountsLoader();
  const uploadTransactionsAction = useUploadTransactionsRouteAction();
  // const importTransactionsAction = useImportTransactionsRouteAction();

  const transactions = useSignal<{
    receiptFrom: Date;
    bookedAt: Date;
    reference: string;
    description: string;
    amount: string;
    debitAccount: string;
    creditAccount: string;
  }[]>([]);

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
        <button type="submit" disabled={filename.value === ''} class="button is-primary" onClick$={async () => {
          const file = fileRef.value?.files?.[0];

          if (file) {
            const formData = new FormData();

            formData.append('type', importType.value);
            formData.append('file', file);

            const { value } = await uploadTransactionsAction.submit(formData);
            transactions.value = value.result ?? [];
          }
        }}>Hochladen</button>
      </div>

      {transactions.value.length > 0 && <>
        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Betrag</th>
              <th>Sollkonto</th>
              <th>Habenkonto</th>
              <th>Buchungstext</th>
              <th>Haushaltskonto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.value.map((x, i) => <tr key={i}>
              <td class="is-vcentered"><input hidden name={`transactions.${i}.date`} type="date" value={formatDateInputField(x.bookedAt)} />{formatDateShort(x.bookedAt)}</td>
              <td class="is-vcentered has-text-right"><input hidden name={`transactions.${i}.amount`} value={x.amount.toString()} />{formatCurrency(x.amount.toString())}</td>
              <td class="is-vcentered has-text-right"><input hidden name={`transactions.${i}.debitAccount`} value={x.debitAccount} />{x.debitAccount}</td>
              <td class="is-vcentered has-text-right"><input hidden name={`transactions.${i}.creditAccount`} value={x.creditAccount} />{x.creditAccount}</td>
              <td class="is-vcentered"><input hidden name={`transactions.${i}.description`} value={x.description} />{x.description}</td>
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
            {transactions.value.length === 0 && (
              <tr>
                <td colSpan={6} class="has-text-centered">
                  <p class="is-size-6">Dokument hochladen</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div class="buttons is-right is-fullwidth">
          <button type="submit" disabled={transactions.value.length === 0} class="button is-primary">Importieren</button>
        </div>
      </>}
    </MainContentLarge >
  );
});
