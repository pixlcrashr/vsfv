import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { Link, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import CreateImportSourceMenu from "~/components/importSources/CreateImportSourceMenu";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";

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

export const useCreateImportSourceAction = routeAction$(async (args) => {
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
  
  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);

  return <>
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li class="is-active"><Link href="#" aria-current="page">Importquellen</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          <button class="button is-primary is-rounded"
            onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>Hinzufügen</button>
        </HeaderButtons>
      </Header>

      <table class="table is-hoverable is-fullwidth is-narrow">
        <thead>
          <tr>
            <th>Name</th>
            <th>Beschreibung</th>
            <th>Erstellt am</th>
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
                <Link class="button" href={`/admin/importSources/${importSource.id}/edit`}>Bearbeiten</Link>
              </div>
            </td>
          </tr>)}
        </tbody>
      </table>
    </MainContent>
    
    <MainContentMenu isShown={createMenuShown}>
      <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
        Importquelle hinzufügen
      </MainContentMenuHeader>

      <CreateImportSourceMenu />
    </MainContentMenu>
  </>;
})
