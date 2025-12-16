import { component$, useSignal } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, useNavigate, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Decimal from "decimal.js";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import { formatCurrency, formatDateInputField, formatDateShort } from "~/lib/format";
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

function parseDecimalValue(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
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

    const res = ts.filter((t: any) => matchingTransactions.every((x: any) => x.custom_id !== transactionToCustomId(
        t.bookedAt,
        t.receiptFrom,
        t.creditAccount,
        t.debitAccount,
        t.amount,
        `${t.receiptNumberGroup ?? ''}${t.receiptNumber ?? ''}`,
        t.description
      ))).map((t: any) => ({
      receiptFrom: t.receiptFrom,
      bookedAt: t.bookedAt,
      reference: `${t.receiptNumberGroup ?? ''}${t.receiptNumber ?? ''}`,
      description: t.description,
      amount: t.amount.toString(),
      debitAccount: t.debitAccount,
      creditAccount: t.creditAccount,
    }));
    res.sort((a: any, b: any) => a.receiptFrom.getTime() - b.receiptFrom.getTime());

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
    accountAssignments: z.array(z.object({
      accountId: z.string(),
      value: z.string()
    })).optional()
  }))
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
  
  const accountAssignments = useSignal<Map<number, Array<{accountId: string, value: string}>>>(new Map());

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
            <select name="type" onChange$={(event, elem) => importType.value = elem.value}>
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
            <select name="sourceId" onChange$={(event, elem) => {
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
          <input class="file-input" type="file" onChange$={(event, elem) => {
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

      {transactions.value !== null && transactions.value.length > 0 && <Form action={importTransactionsAction} onSubmitCompleted$={async () => {
        await nav('/journal');
      }}>
        <input hidden name="sourceId" value={selectedSourceId.value} />
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
            {transactions.value.map((x, i) => {
              const assignments = accountAssignments.value.get(i) ?? [{accountId: '', value: x.amount.toString()}];
              const totalAssigned = assignments.reduce((sum, a) => {
                return sum + parseDecimalValue(a.value);
              }, 0);
              const transactionAmount = parseFloat(x.amount.toString());
              const isValid = Math.abs(totalAssigned - transactionAmount) < 0.01;
              
              return <tr key={i}>
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
                  <div>
                    {assignments.map((assignment, j) => (
                      <div key={j} class="field has-addons mb-2">
                        <div class="control is-expanded">
                          <div class="select is-small is-fullwidth">
                            <select 
                              name={`transactions.${i}.accountAssignments.${j}.accountId`}
                              value={assignment.accountId}
                              onChange$={(e, elem) => {
                                const newAssignments = [...assignments];
                                newAssignments[j] = {...newAssignments[j], accountId: elem.value};
                                const newMap = new Map(accountAssignments.value);
                                newMap.set(i, newAssignments);
                                accountAssignments.value = newMap;
                              }}
                            >
                              <option value="" selected disabled>{_`- bitte auswählen -`}</option>
                              <option value="ignore">{_`Ignorieren`}</option>
                              <option disabled>---</option>
                              {accounts.value.map(acc => <option value={acc.id} key={acc.id}>{acc.name}</option>)}
                            </select>
                          </div>
                        </div>
                        <div class="control">
                          <input 
                            class="input is-small" 
                            type="text" 
                            pattern="[0-9]+([.,][0-9]{1,2})?"
                            name={`transactions.${i}.accountAssignments.${j}.value`}
                            value={assignment.value}
                            style="width: 100px;"
                            placeholder="0,00"
                            onChange$={(e, elem) => {
                              const newAssignments = [...assignments];
                              newAssignments[j] = {...newAssignments[j], value: elem.value};
                              const newMap = new Map(accountAssignments.value);
                              newMap.set(i, newAssignments);
                              accountAssignments.value = newMap;
                            }}
                          />
                        </div>
                        <div class="control">
                          <button 
                            type="button"
                            class="button is-small is-danger"
                            disabled={assignments.length === 1}
                            onClick$={() => {
                              const newAssignments = assignments.filter((_, idx) => idx !== j);
                              const newMap = new Map(accountAssignments.value);
                              newMap.set(i, newAssignments);
                              accountAssignments.value = newMap;
                            }}
                          >
                            <span class="icon is-small">
                              <i class="fas fa-minus"></i>
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                    <div class="field">
                      <button 
                        type="button"
                        class="button is-small is-success"
                        onClick$={() => {
                          const remaining = transactionAmount - totalAssigned;
                          const newAssignments = [...assignments, {accountId: '', value: remaining.toFixed(2)}];
                          const newMap = new Map(accountAssignments.value);
                          newMap.set(i, newAssignments);
                          accountAssignments.value = newMap;
                        }}
                      >
                        <span class="icon is-small">
                          <i class="fas fa-plus"></i>
                        </span>
                        <span>{_`Zuweisung hinzufügen`}</span>
                      </button>
                    </div>
                    <div class="field">
                      <p class={["help", {"is-danger": !isValid, "is-success": isValid}]}>
                        {_`Summe`}: {formatCurrency(totalAssigned.toFixed(2))} / {formatCurrency(x.amount.toString())}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
        <div class="buttons is-right is-fullwidth">
          <button type="submit" disabled={transactions.value.length === 0 || importTransactionsAction.isRunning || transactions.value.some((x, i) => {
            const assignments = accountAssignments.value.get(i) ?? [{accountId: '', value: x.amount.toString()}];
            const hasUnassigned = assignments.some(a => a.accountId === '' || a.accountId === undefined);
            const totalAssigned = assignments.reduce((sum, a) => {
              return sum + parseDecimalValue(a.value);
            }, 0);
            const transactionAmount = parseFloat(x.amount.toString());
            const isValid = Math.abs(totalAssigned - transactionAmount) < 0.01;
            return hasUnassigned || !isValid;
          })} class="button is-primary">{_`Importieren`}</button>
        </div>
      </Form>}
    </MainContentLarge >
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Journal Importieren`,
  meta: [],
};
