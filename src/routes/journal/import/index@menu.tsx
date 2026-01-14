import { component$, useSignal } from "@builder.io/qwik";
import { DocumentHead, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import { Decimal } from "decimal.js";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import ImportTransactionRow from "~/components/journal/ImportTransactionRow";
import { parseLexwareTransactions } from "~/lib/lexware/parser";
import { parseDatevTransactions } from "~/lib/datev/parser";
import { Prisma } from "~/lib/prisma";
import { Prisma as P } from "~/lib/prisma/generated/client";
import { Transaction } from "~/lib/transaction";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.JOURNAL_IMPORT);

export const UploadTransactionsSchema = {
  sourceId: z.string().uuid(),
  type: z.string().regex(/^(lexware|datev)$/),
  file: z.any()
};

function escapeCustomIdDelimiter(s?: string): string {
  return s?.replace(/:/g, '\\:') ?? '';
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

export const useUploadTransactionsRouteAction = routeAction$(async (args, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.JOURNAL_IMPORT);
  if (!auth.authorized) {
    return auth.result;
  }
  
  if (args.file) {
    const source = await Prisma.import_sources.findFirst({
      where: {
        id: args.sourceId
      },
      include: {
        importSourcePeriods: true
      }
    });
    if (source === null) {
      return {
        success: false,
      }
    }

    const f = args.file as File;

    let ts: Transaction[];
    if (args.type === 'lexware') {
      ts = await parseLexwareTransactions(f);
    } else if (args.type === 'datev') {
      ts = await parseDatevTransactions(f);
    } else {
      return { success: false };
    }

    const matchingTransactions = await Prisma.transactions.findMany({
      where: {
        custom_id: {
          in: ts.map(x => transactionToCustomId(
            x.bookedAt,
            x.receiptFrom,
            x.creditAccount,
            x.debitAccount,
            x.amount,
            `${x.receiptNumberGroup ?? ''}${x.receiptNumber ?? ''}`,
            x.description
          ))
        }
      }
    });

    const closedYears = new Set(
      source.importSourcePeriods.filter(p => p.is_closed).map(p => p.year)
    );

    const transactionAccounts = await Prisma.transaction_accounts.findMany({
      where: { import_source_id: args.sourceId }
    });
    const getAccountName = (code: string): string => {
      const ta = transactionAccounts.find(x => x.code === code);
      return ta?.display_name || '';
    };

    const res = ts.filter((t) => {
      const year = t.receiptFrom.getFullYear();
      if (closedYears.has(year)) {
        return false;
      }
      return matchingTransactions.every((x) => x.custom_id !== transactionToCustomId(
        t.bookedAt,
        t.receiptFrom,
        t.creditAccount,
        t.debitAccount,
        t.amount,
        `${t.receiptNumberGroup ?? ''}${t.receiptNumber ?? ''}`,
        t.description
      ));
    }).map((t) => ({
      custom_id: transactionToCustomId(
        t.bookedAt,
        t.receiptFrom,
        t.creditAccount,
        t.debitAccount,
        t.amount,
        `${t.receiptNumberGroup ?? ''}${t.receiptNumber ?? ''}`,
        t.description
      ),
      receiptFrom: t.receiptFrom,
      bookedAt: t.bookedAt,
      reference: `${t.receiptNumberGroup ?? ''}${t.receiptNumber ?? ''}`,
      description: t.description,
      amount: t.amount.toString(),
      debitAccount: t.debitAccount,
      debitAccountName: getAccountName(t.debitAccount),
      creditAccount: t.creditAccount,
      creditAccountName: getAccountName(t.creditAccount),
    }));
    res.sort((a: any, b: any) => a.receiptFrom.getTime() - b.receiptFrom.getTime());

    return {
      success: true,
      result: res,
      sourceId: source.id,
      closedYearsCount: closedYears.size > 0 ? ts.filter(t => closedYears.has(t.receiptFrom.getFullYear())).length : 0
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
    accountAssignments: z.array(z.object({
      accountId: z.string(),
      value: z.string()
    })).optional()
  }))
};

export const ImportSingleTransactionSchema = {
  sourceId: z.string().uuid(),
  receiptFrom: z.string().date(),
  bookedAt: z.string().date(),
  amount: z.string(),
  description: z.string(),
  reference: z.string(),
  debitAccount: z.string().min(1),
  creditAccount: z.string().min(1),
  accountAssignments: z.array(z.object({
    accountId: z.string(),
    value: z.string()
  })).optional()
};

export const useImportTransactionsRouteAction = routeAction$(async (args, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.JOURNAL_IMPORT);
  if (!auth.authorized) {
    return auth.result;
  }
  
  if (args.sourceId === '') {
    return {
      success: false
    };
  }

  const source = await Prisma.import_sources.findFirst({
    where: { id: args.sourceId },
    include: { importSourcePeriods: true }
  });

  if (!source) {
    return fail(400, { success: false, message: 'Import source not found' });
  }

  const yearsNeeded = new Set(args.transactions.map(t => new Date(t.receiptFrom).getFullYear()));

  for (const year of yearsNeeded) {
    const existingPeriod = source.importSourcePeriods.find(p => p.year === year);
    if (existingPeriod?.is_closed) {
      return fail(400, {
        success: false,
        message: `Die Importperiode für das Jahr ${year} ist geschlossen. Import nicht möglich.`
      });
    }
    if (!existingPeriod) {
      await Prisma.import_source_periods.create({
        data: {
          import_source_id: args.sourceId,
          year: year,
          is_closed: false
        }
      });
    }
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
    const assignments = t.accountAssignments ?? [];
    const transactionAmount = new Decimal(t.amount);
    
    if (assignments.length > 0) {
      const totalAssigned = assignments.reduce((sum, a) => sum.plus(new Decimal(a.value)), new Decimal(0));
      
      if (!totalAssigned.equals(transactionAmount)) {
        return fail(400, {
          success: false,
          message: `Transaction assignments must total to ${transactionAmount.toString()}, but got ${totalAssigned.toString()}`
        });
      }
    }

    const transaction = await Prisma.transactions.create({
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
        assigned_account_id: null
      }
    });

    for (const assignment of assignments) {
      if (assignment.accountId !== 'ignore' && assignment.accountId !== '') {
        await Prisma.transaction_account_assignments.create({
          data: {
            transaction_id: transaction.id,
            account_id: assignment.accountId,
            value: P.Decimal(assignment.value)
          }
        });
      }
    }
  }

  return {
    success: true
  };
}, zod$(ImportTransactionsSchema));

export const useImportSingleTransactionRouteAction = routeAction$(async (args, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.JOURNAL_IMPORT);
  if (!auth.authorized) {
    return auth.result;
  }
  
  if (args.sourceId === '') {
    return {
      success: false
    };
  }

  const source = await Prisma.import_sources.findFirst({
    where: { id: args.sourceId },
    include: { importSourcePeriods: true }
  });

  if (!source) {
    return fail(400, { success: false, message: 'Import source not found' });
  }

  const year = new Date(args.receiptFrom).getFullYear();
  const existingPeriod = source.importSourcePeriods.find(p => p.year === year);

  if (existingPeriod?.is_closed) {
    return fail(400, {
      success: false,
      message: `Die Importperiode für das Jahr ${year} ist geschlossen. Import nicht möglich.`
    });
  }

  if (!existingPeriod) {
    await Prisma.import_source_periods.create({
      data: {
        import_source_id: args.sourceId,
        year: year,
        is_closed: false
      }
    });
  }

  const transactionAccountCodes = new Set<string>();
  transactionAccountCodes.add(args.debitAccount);
  transactionAccountCodes.add(args.creditAccount);

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

  const assignments = args.accountAssignments ?? [];
  const transactionAmount = new Decimal(args.amount);
  
  if (assignments.length > 0) {
    const totalAssigned = assignments.reduce((sum, a) => sum.plus(new Decimal(a.value)), new Decimal(0));
    
    if (!totalAssigned.equals(transactionAmount)) {
      return fail(400, {
        success: false,
        message: `Transaction assignments must total to ${transactionAmount.toString()}, but got ${totalAssigned.toString()}`
      });
    }
  }

  const transaction = await Prisma.transactions.create({
    data: {
      amount: P.Decimal(args.amount),
      booked_at: new Date(args.bookedAt),
      document_date: new Date(args.receiptFrom),
      reference: args.reference,
      description: args.description,
      credit_transaction_account_id: m.get(args.creditAccount) ?? '',
      debit_transaction_account_id: m.get(args.debitAccount) ?? '',
      custom_id: transactionToCustomId(
        new Date(args.bookedAt),
        new Date(args.receiptFrom),
        args.creditAccount,
        args.debitAccount,
        new Decimal(args.amount),
        args.reference,
        args.description
      ),
      assigned_account_id: null
    }
  });

  for (const assignment of assignments) {
    if (assignment.accountId !== 'ignore' && assignment.accountId !== '') {
      await Prisma.transaction_account_assignments.create({
        data: {
          transaction_id: transaction.id,
          account_id: assignment.accountId,
          value: P.Decimal(assignment.value)
        }
      });
    }
  }

  return {
    success: true
  };
}, zod$(ImportSingleTransactionSchema));

export interface Account {
  id: string;
  name: string;
}

async function getAllAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany();

  const getCodePrefix = (parentAccountId: string | null): string => {
    if (parentAccountId === null) {
      return '';
    }

    const a = as.find(x => x.id === parentAccountId);

    return getCodePrefix(a?.parent_account_id ?? null) + a?.display_code + '-';
  };

  const getNamePrefix = (parentAccountId: string | null): string => {
    if (parentAccountId === null) {
      return '';
    }

    const a = as.find(x => x.id === parentAccountId);

    return getNamePrefix(a?.parent_account_id ?? null) + a?.display_name + ' / ';
  };

  return as.filter(x => as.every(y => y.parent_account_id !== x.id)).map(x => ({
    id: x.id,
    name: `${getCodePrefix(x.parent_account_id)}${x.display_code} | ${getNamePrefix(x.parent_account_id)}${x.display_name}`
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

  const importType = useSignal<string>('');
  const selectedSourceId = useSignal<string>('');

  const accounts = useGetAllAccountsLoader();
  const importSources = useGetAllImportSourcesLoader();
  const uploadTransactionsAction = useUploadTransactionsRouteAction();
  const importSingleTransactionAction = useImportSingleTransactionRouteAction();

  const uploadLoading = useSignal<boolean>(false);

  const transactions = useSignal<{
    custom_id: string;
    receiptFrom: Date;
    bookedAt: Date;
    reference: string;
    description: string;
    amount: string;
    debitAccount: string;
    debitAccountName: string;
    creditAccount: string;
    creditAccountName: string;
  }[] | null>(null);

  return (
    <MainContentLarge>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/journal" aria-current="page">{_`Journal`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Importieren...`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>

        </HeaderButtons>
      </Header>

      <div class="field">
        <label class="label">{_`Importtyp`}</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select name="type" autocomplete="off" onChange$={(event, elem) => importType.value = elem.value}>
              <option disabled selected>{_`- bitte auswählen -`}</option>
              <option value="lexware">{_`Lexware Buchhaltung`}</option>
              <option value="datev">{_`DATEV Buchungsstapel`}</option>
            </select>
          </div>
        </div>
        {importType.value === 'lexware' && <p class="help">{_`Das Lexware Journal muss als CSV und mit dem Trennzeichen ';' exportiert werden. Andernfalls kann das Journal nicht automatisch ausgelesen werden.`}</p>}
        {importType.value === 'datev' && <p class="help">{_`Der DATEV Buchungsstapel muss als CSV (Standardformat, Trennzeichen ';') exportiert werden. Nur Einzelbuchungen werden unterstützt.`}</p>}
      </div>
      <div class="field">
        <label class="label">{_`Importquelle`}</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select name="sourceId" autocomplete="off" onChange$={(event, elem) => {
              selectedSourceId.value = elem.value;
            }}>
              <option disabled selected>{_`- bitte auswählen -`}</option>
              {importSources.value.map(x => <option value={x.id} key={x.id}>{x.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div class="pt-5 file has-name is-fullwidth">
        <label class="file-label">
          <input class="file-input" autocomplete="off" type="file" onChange$={(event, elem) => {
            filename.value = elem.files?.[0].name ?? '';
          }} ref={fileRef} />
          <span class="file-cta">
            <span class="file-icon">
              <i class="fas fa-upload"></i>
            </span>
            <span class="file-label"> {_`Datei auswählen…`} </span>
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
        }}>{_`Hochladen`}</button>
      </div>

      {transactions.value !== null && transactions.value.length === 0 && <p class="has-text-centered is-size-5">{_`Es wurden keine Transaktionen gefunden.`}</p>}

      {transactions.value !== null && transactions.value.length > 0 && <>
        <table class="table is-narrow is-fullwidth">
          <thead>
            <tr>
              <th>{_`Datum`}</th>
              <th>{_`Betrag`}</th>
              <th>{_`Sollkonto`}</th>
              <th>{_`Habenkonto`}</th>
              <th>{_`Buchungstext`}</th>
              <th>{_`Referenz`}</th>
              <th>{_`Haushaltskonto-Zuweisungen`}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.value.map(x => (
              <ImportTransactionRow
                key={x.custom_id}
                transaction={x}
                sourceId={selectedSourceId.value}
                accounts={accounts.value}
                importAction={importSingleTransactionAction}
                onSuccess$={() => {
                  transactions.value = transactions.value?.filter(y => y.custom_id !== x.custom_id) ?? null;
                }}
              />
            ))}
          </tbody>
        </table>
      </>}
    </MainContentLarge >
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Journal Importieren`,
  meta: [],
};
