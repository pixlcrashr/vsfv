import { component$, useSignal } from "@builder.io/qwik";
import { Link, routeAction$, routeLoader$, useNavigate, z, zod$ } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import PreviewEditor from "~/components/reports/PreviewEditor";
import { Prisma } from "~/lib/prisma";



export interface ReportTemplate {
  id: string;
  name: string;
  template: string;
}

async function getReportTemplate(id: string): Promise<ReportTemplate> {
  const m = await Prisma.report_templates.findUnique({
    where: {
      id: id
    }
  });
  if (m == null) {
    throw new Error('Report template not found');
  }

  return {
    id: m.id,
    name: m.display_name,
    template: m.template
  };
}

export const useGetReportTemplateLoader = routeLoader$(async (e) => {
  try {
    const reportTemplate = await getReportTemplate(e.params.reportTemplateId);

    return reportTemplate;
  } catch {
    throw e.redirect(307, '/reportTemplates');
  }
});

export const SaveReportTemplateAction = {
  id: z.string().uuid(),
  name: z.string().min(1),
  template: z.string()
};

async function saveReportTemplate(id: string, name: string, template: string): Promise<void> {
  await Prisma.report_templates.update({
    where: {
      id: id
    },
    data: {
      display_name: name,
      template
    }
  });
}

export const useSaveReportTemplateAction = routeAction$(async (values) => {
  await saveReportTemplate(values.id, values.name, values.template);

  return {
    success: true
  };
}, zod$(SaveReportTemplateAction));

export default component$(() => {
  const nav = useNavigate();
  const getLoader = useGetReportTemplateLoader();
  const saveAction = useSaveReportTemplateAction();

  const editorValue = useSignal<string>(getLoader.value.template);
  const nameValue = useSignal<string>(getLoader.value.name);

  return (
    <>
      <MainContentLarge>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/reportTemplates">Berichtsvorlagen</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">{getLoader.value.name} Bearbeiten</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" disabled={saveAction.isRunning} value={nameValue.value} onChange$={(event, elem) => nameValue.value = elem.value} type="text" />
          </div>
        </div>
        <PreviewEditor height="700px" defaultValue={editorValue.value} onChange$={(value) => editorValue.value = value} />
        <div class="buttons is-right mt-4">
          <button class="button is-warning" disabled={saveAction.isRunning} onClick$={async () => {
              const { value } = await saveAction.submit({
                id: getLoader.value.id,
                name: nameValue.value,
                template: editorValue.value
              });
          }}>Speichern</button>
        </div>
      </MainContentLarge>
    </>
  );
})
