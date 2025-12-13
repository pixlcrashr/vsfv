import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";



export interface ReportTemplate {
  id: string;
  name: string;
  createdAt: Date;
}

async function getReportTemplates(): Promise<ReportTemplate[]> {
  return (await Prisma.report_templates.findMany({
    orderBy: {
      display_name: 'asc'
    }
  })).map(x => ({
    id: x.id,
    name: x.display_name,
    createdAt: x.created_at
  }));
}

export const useGetReportTemplatesLoader = routeLoader$(async () => {
  return await getReportTemplates();
});

export const DeleteReportTemplateSchema = {
  id: z.string().uuid()
};

async function deleteReportTemplate(id: string): Promise<void> {
  await Prisma.report_templates.delete({
    where: {
      id: id
    }
  });
}

export const useDeleteReportTemplateAction = routeAction$(async (values) => {
  await deleteReportTemplate(values.id);

  return {
    success: true
  };
}, zod$(DeleteReportTemplateSchema));

export default component$(() => {
  const getLoader = useGetReportTemplatesLoader();
  const deleteAction = useDeleteReportTemplateAction();


  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active"><Link href="#" aria-current="page">Berichtsvorlagen</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            <Link class="button is-primary is-rounded" href="/reportTemplates/new">Hinzufügen</Link>
          </HeaderButtons>
        </Header>
        <table class="table is-narrow is-hoverable is-fullwidth">
          <thead>
            <tr>
              <th>Name</th>
              <th>Erstellt am</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {getLoader.value.map((reportTemplate) => (
              <tr key={reportTemplate.id}>
                <td class="is-vcentered">{reportTemplate.name}</td>
                <td class="is-vcentered">{formatDateShort(reportTemplate.createdAt)}</td>
                <td class="is-vcentered">
                  <p class="buttons are-small is-right">
                    <Link href={`/reportTemplates/${reportTemplate.id}/edit`} class="button">Bearbeiten</Link>
                    <Form action={deleteAction}>
                      <input type="hidden" name="id" value={reportTemplate.id} />
                      <button type="submit" class="button is-danger is-outlined" disabled={deleteAction.isRunning}>Entfernen</button>
                    </Form>
                  </p>
                </td>
              </tr>
            ))}
            {getLoader.value.length === 0 && (
              <tr>
                <td colSpan={6} class="has-text-centered">
                  <p class="is-size-6">Keine Berichtsvorlagen gefunden</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MainContent>
    </>
  );
});
