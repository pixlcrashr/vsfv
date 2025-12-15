import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";
import { _ } from "compiled-i18n";



export const onRequest: RequestHandler = requirePermission(Permissions.REPORT_TEMPLATES_READ);

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

export const useReportTemplatePermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canCreate: Permissions.REPORT_TEMPLATES_CREATE,
    canUpdate: Permissions.REPORT_TEMPLATES_UPDATE,
    canDelete: Permissions.REPORT_TEMPLATES_DELETE
  });
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

export const useDeleteReportTemplateAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.REPORT_TEMPLATES_DELETE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  await deleteReportTemplate(values.id);

  return {
    success: true
  };
}, zod$(DeleteReportTemplateSchema));

export default component$(() => {
  const getLoader = useGetReportTemplatesLoader();
  const deleteAction = useDeleteReportTemplateAction();
  const permissions = useReportTemplatePermissions();


  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active"><Link href="#" aria-current="page">{_`Berichtsvorlagen`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            {permissions.value.canCreate && (
              <Link class="button is-primary is-rounded" href="/reportTemplates/new">{_`Hinzufügen`}</Link>
            )}
          </HeaderButtons>
        </Header>
        <table class="table is-narrow is-hoverable is-fullwidth">
          <thead>
            <tr>
              <th>{_`Name`}</th>
              <th>{_`Erstellt am`}</th>
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
                    {permissions.value.canUpdate && (
                      <Link href={`/reportTemplates/${reportTemplate.id}/edit`} class="button">{_`Bearbeiten`}</Link>
                    )}
                    {permissions.value.canDelete && (
                      <Form action={deleteAction}>
                        <input type="hidden" name="id" value={reportTemplate.id} />
                        <button type="submit" class="button is-danger is-outlined" disabled={deleteAction.isRunning}>{_`Entfernen`}</button>
                      </Form>
                    )}
                  </p>
                </td>
              </tr>
            ))}
            {getLoader.value.length === 0 && (
              <tr>
                <td colSpan={6} class="has-text-centered">
                  <p class="is-size-6">{_`Keine Berichtsvorlagen gefunden`}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Berichtsvorlagen`,
  meta: [],
};
