import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { DocumentHead, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import CreateImportSourceMenu from "~/components/importSources/CreateImportSourceMenu";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.IMPORT_SOURCES_READ);

export interface ImportSource {
  id: string;
  name: string;
  description: string;
  created_at: Date;
}

async function getImportSources(): Promise<ImportSource[]> {
  return (await Prisma.import_sources.findMany({
    orderBy: {
      display_name: 'asc'
    }
  })).map(x => ({
    id: x.id,
    name: x.display_name,
    description: x.display_description,
    created_at: x.created_at
  }));
}

export const useGetImportSourcesLoader = routeLoader$(async () => {
  return await getImportSources();
});

export const useImportSourcePermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canCreate: Permissions.IMPORT_SOURCES_CREATE,
    canUpdate: Permissions.IMPORT_SOURCES_UPDATE
  });
});

enum MenuStatus {
  None,
  Create
}

export const CreateImportSourceActionSchema = {
  name: z.string().min(1),
  description: z.string(),
  periodStart: z.coerce.date()
};

async function createImportSource(
  name: string,
  description: string,
  periodStart: Date
): Promise<void> {
  await Prisma.import_sources.create({
    data: {
      display_name: name,
      display_description: description,
      period_start: periodStart,
      importSourcePeriods: {
        create: {
          year: periodStart.getFullYear(),
          is_closed: false
        }
      }
    }
  });
}

export const useCreateImportSourceAction = routeAction$(async (args, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.IMPORT_SOURCES_CREATE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  await createImportSource(
    args.name,
    args.description,
    args.periodStart
  );

  return {
    success: true
  };
}, zod$(CreateImportSourceActionSchema));

export default component$(() => {
  const importSources = useGetImportSourcesLoader();
  const permissions = useImportSourcePermissions();
  
  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);

  return <>
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
                <li class="is-active"><Link href="#" aria-current="page">{_`Importquellen`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          {permissions.value.canCreate && (
            <button class="button is-primary is-rounded"
              onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>{_`Hinzufügen`}</button>
          )}
        </HeaderButtons>
      </Header>

      <table class="table is-hoverable is-fullwidth is-narrow">
        <thead>
          <tr>
            <th>{_`Name`}</th>
            <th>{_`Beschreibung`}</th>
            <th>{_`Erstellt am`}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {importSources.value.map((importSource) => <tr>
            <td>{importSource.name}</td>
            <td>{importSource.description}</td>
            <td>{formatDateShort(importSource.created_at)}</td>
            <td>
              <div class="buttons are-small is-right">
                {permissions.value.canUpdate && (
                  <Link class="button" href={`/admin/importSources/${importSource.id}/edit`}>{_`Bearbeiten`}</Link>
                )}
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </MainContent>
    
    <MainContentMenu isShown={createMenuShown}>
      <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
        {_`Importquelle hinzufügen`}
      </MainContentMenuHeader>

      <CreateImportSourceMenu />
    </MainContentMenu>
  </>;
});

export const head: DocumentHead = {
  title: _`VSFV | Importquellen`,
  meta: [],
};
