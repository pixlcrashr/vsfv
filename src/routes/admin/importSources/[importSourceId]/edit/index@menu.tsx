import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";
import { _ } from "compiled-i18n";



export const onRequest: RequestHandler = requirePermission(Permissions.IMPORT_SOURCES_UPDATE);

export interface TransactionAccount {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface Period {
  id: string;
  year: number;
  isClosed: boolean;
}

export interface ImportSource {
  id: string;
  name: string;
  description: string;
  periodStart: Date;
  updatedAt: Date;
  createdAt: Date;
  transactionAccounts: TransactionAccount[];
  periods: Period[];
}

async function getImportSource(id: string): Promise<ImportSource | null> {
  const importSource = await Prisma.import_sources.findUnique({
    where: {
      id: id
    },
    include: {
      importSourcePeriods: true,
      transactionAccounts: true
    }
  });
  if (importSource === null) {
    return null;
  }

  return {
    id: importSource.id,
    name: importSource.display_name,
    description: importSource.display_description,
    updatedAt: importSource.updated_at,
    createdAt: importSource.created_at,
    periodStart: importSource.period_start,
    periods: importSource.importSourcePeriods.map(x => ({
      id: x.id,
      year: x.year,
      isClosed: x.is_closed
    })),
    transactionAccounts: importSource.transactionAccounts.map(x => ({
      id: x.id,
      code: x.code,
      name: x.display_name,
      description: x.display_description
    }))
  };
}

export const useGetImportSourceLoader = routeLoader$(async (req) => {
  const id = req.params.importSourceId;

  const importSource = await getImportSource(id);
  if (importSource === null) {
    throw req.redirect(307, "/admin/importSources");
  }

  return importSource;
});

export const SaveImportSourceSchema = {
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  periods: z.array(z.object({
    id: z.string().uuid(),
    isClosed: z.coerce.boolean()
  })),
  transactionAccounts: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string()
  })).optional()
};

async function saveImportSource(id: string, name: string, description: string): Promise<void> {
  await Prisma.import_sources.update({
    where: {
      id: id
    },
    data: {
      display_name: name,
      display_description: description
    }
  });
}

async function saveImportSourcePeriods(
  id: string,
  periods: {
    id: string,
    isClosed: boolean
  }[]
): Promise<void> {
  await Prisma.$transaction(
    periods.map(x => Prisma.import_sources.update({
      where: {
        id: id,
      },
      data: {
        importSourcePeriods: {
          update: {
            where: {
              id: x.id
            },
            data: {
              is_closed: x.isClosed
            }
          }
        }
      }
    }))
  );
}

async function saveImportSourceTransactionAccounts(
  transactionAccounts: {
    id: string,
    name: string,
    description: string
  }[]
): Promise<void> {
  await Prisma.$transaction(
    transactionAccounts.map(x => Prisma.transaction_accounts.update({
      where: {
        id: x.id
      },
      data: {
        display_name: x.name,
        display_description: x.description
      }
    }))
  );
}

export const useSaveImportSourceAction = routeAction$(async (args, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.IMPORT_SOURCES_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  await saveImportSource(
    args.id,
    args.name,
    args.description
  );

  await saveImportSourcePeriods(
    args.id,
    args.periods
  );

  if (args.transactionAccounts) {
    await saveImportSourceTransactionAccounts(args.transactionAccounts);
  }
}, zod$(SaveImportSourceSchema));

export default component$(() => {
  const getImportLoader = useGetImportSourceLoader();
  const saveAction = useSaveImportSourceAction();

  const periodStart = getImportLoader.value.periodStart;
  const periodEnd = new Date(
    periodStart.getFullYear() + 1,
    periodStart.getMonth(),
    periodStart.getDate() - 1
  );

  return <>
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/admin/importSources">{_`Importquellen`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{getImportLoader.value.name} {_`bearbeiten`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <Form action={saveAction}>
        <input type="hidden" name="id" value={getImportLoader.value.id} />
        <div class="field">
          <label class="label">{_`Name`}</label>
          <div class="control">
            <input class="input" type="text" name="name" value={getImportLoader.value.name} />
          </div>
        </div>

        <p>{_`Periodenstart`}: {formatDateShort(periodStart)}, {_`Periodenende`}: {formatDateShort(periodEnd)}</p>

        <div class="field">
          <label class="label">{_`Beschreibung`}</label>
          <div class="control">
            <textarea rows={4} class="textarea" name="description" value={getImportLoader.value.description}></textarea>
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Rechnungsjahre`}</label>
          <table class="table is-hoverable is-striped is-fullwidth is-narrow">
            <thead>
              <tr>
                <th>{_`Jahr`}</th>
                <th>{_`Ist Abgeschlossen?`}</th>
              </tr>
            </thead>
            <tbody>
              {getImportLoader.value.periods.map((period, i) => <tr key={period.year}>
                <td class="is-vcentered">
                  <input hidden type="text" name={`periods.${i}.id`} value={period.id} />
                  <input hidden type="text" name={`periods.${i}.isClosed`} value={period.isClosed ? 'true' : 'false'} />
                  {period.year}
                </td>
                <td class="is-vcentered">{period.isClosed ? _`Ja` : _`Nein`}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        
        <div class="field">
          <label class="label">{_`Konten`}</label>
          <table class="table is-hoverable is-striped is-fullwidth is-narrow">
              <thead>
                <tr>
                  <th>{_`Nr.`}</th>
                  <th>{_`Name`}</th>
                  <th>{_`Beschreibung`}</th>
                </tr>
              </thead>
              <tbody>
                {getImportLoader.value.transactionAccounts.map((transactionAccount, i) => <tr>
                  <td class="is-vcentered has-text-right">
                    <input hidden type="text" name={`transactionAccounts.${i}.id`} value={transactionAccount.id} />
                    {transactionAccount.code}
                  </td>
                  <td>
                    <input
                      class="input is-small"
                      type="text"
                      name={`transactionAccounts.${i}.name`}
                      value={transactionAccount.name}
                      min={1} />
                  </td>
                  <td>
                    <input
                      class="input is-small"
                      type="text"
                      name={`transactionAccounts.${i}.description`}
                      value={transactionAccount.description}
                      min={1} />
                  </td>
                </tr>)}
              </tbody>
          </table>
        </div>
        <div class="buttons is-right">
          <button class="button is-warning" type="submit">{_`Speichern`}</button>
        </div>
      </Form>
    </MainContent>
  </>
});

export const head: DocumentHead = {
  title: _`VSFV | Importquelle bearbeiten`,
  meta: [],
};
