import { component$, Resource, useResource$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { Link, routeAction$, useNavigate, z, zod$ } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import { qwikify$ } from '@builder.io/qwik-react';
import { Editor } from "@monaco-editor/react";
import MainContentLarge from "~/components/layout/MainContentLarge";
import PreviewEditor from "~/components/reports/PreviewEditor";
import { Prisma } from "~/lib/prisma";



export const QEditor = qwikify$(Editor);

export const CreateReportTemplateActionSchema = {
  name: z.string().min(1),
  template: z.string()
};

async function createReportTemplate(name: string, template: string): Promise<void> {
  await Prisma.report_templates.create({
    data: {
      display_name: name,
      template
    }
  });
}

export const useCreateReportTemplateAction = routeAction$(async (values) => {
  await createReportTemplate(values.name, values.template);

  return {
    success: true
  };
}, zod$(CreateReportTemplateActionSchema))

export default component$(() => {
  const nav = useNavigate();
  const createReportTemplateAction = useCreateReportTemplateAction();

  const editorValue = useSignal<string>('');
  const nameValue = useSignal<string>('');

  return (
    <>
      <MainContentLarge>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/reportTemplates">Berichtsvorlagen</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">Erstellen</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>
        <div class="field">
          <label class="label">Name</label>
          <div class="control">
            <input class="input" disabled={createReportTemplateAction.isRunning} value={''} onChange$={(event, elem) => nameValue.value = elem.value} type="text" />
          </div>
        </div>
        <PreviewEditor height="700px" defaultValue={''} onChange$={(value) => editorValue.value = value} />
        <div class="buttons is-right mt-4">
          <button class="button is-primary" disabled={createReportTemplateAction.isRunning} onClick$={async () => {
              const { value } = await createReportTemplateAction.submit({
                name: nameValue.value,
                template: editorValue.value
              });

              if (value.success) {
                nav('/reportTemplates');
              }
          }}>Erstellen</button>
        </div>
      </MainContentLarge>
    </>
  );
})
