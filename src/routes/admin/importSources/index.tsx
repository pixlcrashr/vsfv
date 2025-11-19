import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
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

export default component$(() => {
  const importSources = useGetImportSourcesLoader();

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li class="is-active"><Link href="#" aria-current="page">Importquellen</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <table class="table is-hoverable is-fullwidth is-narrow">
        <thead>
          <tr>
            <th>Name</th>
            <th>Beschreibung</th>
            <th>Erstellt am</th>
          </tr>
        </thead>
        <tbody>
          {importSources.value.map((importSource) => <tr>
            <td><Link href={`/admin/importSources/${importSource.id}`}>{importSource.name}</Link></td>
            <td>{importSource.description}</td>
            <td>{formatDateShort(importSource.created_at)}</td>
          </tr>)}
        </tbody>
      </table>
    </MainContent>
  );
})
