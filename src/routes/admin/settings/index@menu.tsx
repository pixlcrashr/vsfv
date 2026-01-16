import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContentLarge from "~/components/layout/MainContentLarge";
import { formatDateInputField } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.SETTINGS_READ);

export const SETTING_MATRIX_TRANSACTION_CUTOFF_DATE = 'matrix_transaction_cutoff_date';
export const SETTING_DEFAULT_REPORT_TEMPLATE_ID = 'default_report_template_id';

interface Setting {
  id: string;
  type: string;
  value_text: string | null;
  value_uuid: string | null;
}

interface ReportTemplate {
  id: string;
  displayName: string;
}

async function getSetting(id: string): Promise<Setting | null> {
  const setting = await Prisma.settings.findUnique({
    where: { id }
  });
  
  if (!setting) return null;
  
  return {
    id: setting.id,
    type: setting.type,
    value_text: setting.value_text,
    value_uuid: setting.value_uuid
  };
}

async function getReportTemplates(): Promise<ReportTemplate[]> {
  const templates = await Prisma.report_templates.findMany({
    orderBy: { display_name: 'asc' }
  });
  
  return templates.map(t => ({
    id: t.id,
    displayName: t.display_name
  }));
}

export const useGetSettings = routeLoader$(async () => {
  const [matrixCutoffDate, defaultReportTemplateId] = await Promise.all([
    getSetting(SETTING_MATRIX_TRANSACTION_CUTOFF_DATE),
    getSetting(SETTING_DEFAULT_REPORT_TEMPLATE_ID)
  ]);
  
  return {
    matrixCutoffDate: matrixCutoffDate?.value_text ?? null,
    defaultReportTemplateId: defaultReportTemplateId?.value_uuid ?? null
  };
});

export const useGetReportTemplates = routeLoader$<ReportTemplate[]>(async () => {
  return await getReportTemplates();
});

export const useSettingsPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canUpdate: Permissions.SETTINGS_UPDATE
  });
});

export const useSaveSettingsAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.SETTINGS_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const now = new Date();

  if (values.matrixCutoffDate !== undefined) {
    const cutoffValue = values.matrixCutoffDate === '' ? null : values.matrixCutoffDate;
    
    await Prisma.settings.upsert({
      where: { id: SETTING_MATRIX_TRANSACTION_CUTOFF_DATE },
      update: {
        value_text: cutoffValue,
        updated_at: now
      },
      create: {
        id: SETTING_MATRIX_TRANSACTION_CUTOFF_DATE,
        type: 'text',
        value_text: cutoffValue,
        created_at: now,
        updated_at: now
      }
    });
  }

  if (values.defaultReportTemplateId !== undefined) {
    const templateValue = values.defaultReportTemplateId === '' ? null : values.defaultReportTemplateId;
    
    await Prisma.settings.upsert({
      where: { id: SETTING_DEFAULT_REPORT_TEMPLATE_ID },
      update: {
        value_uuid: templateValue,
        updated_at: now
      },
      create: {
        id: SETTING_DEFAULT_REPORT_TEMPLATE_ID,
        type: 'uuid',
        value_uuid: templateValue,
        created_at: now,
        updated_at: now
      }
    });
  }

  return { success: true };
}, zod$({
  matrixCutoffDate: z.string().optional(),
  defaultReportTemplateId: z.string().optional()
}));

export default component$(() => {
  const settings = useGetSettings();
  const reportTemplates = useGetReportTemplates();
  const permissions = useSettingsPermissions();
  const saveAction = useSaveSettingsAction();

  return (
    <MainContentLarge>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="#">{_`Admin`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Einstellungen`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <Form action={saveAction}>
        <div class="box">
          <h2 class="title is-5">{_`Matrix-Einstellungen`}</h2>
          
          <div class="field">
            <label class="label">{_`Stichtag für Ist-Werte (öffentliche Ansicht)`}</label>
            <div class="control">
              <input
                name="matrixCutoffDate"
                class="input"
                type="date"
                disabled={!permissions.value.canUpdate || saveAction.isRunning}
                value={settings.value.matrixCutoffDate ? formatDateInputField(new Date(settings.value.matrixCutoffDate)) : ''}
              />
            </div>
            <p class="help">
              {_`Bis zu diesem Datum werden Transaktionen in die Ist-Wert-Berechnung einbezogen, wenn ein Benutzer nur Leserechte auf die Matrix hat. Leer lassen, um alle Transaktionen einzubeziehen.`}
            </p>
          </div>

          <div class="field">
            <label class="label">{_`Standard-Berichtsvorlage für Matrix-Export`}</label>
            <div class="control">
              <div class="select is-fullwidth">
                <select
                  name="defaultReportTemplateId"
                  disabled={!permissions.value.canUpdate || saveAction.isRunning}
                  value={settings.value.defaultReportTemplateId ?? ''}
                >
                  <option value="">{_`- keine -`}</option>
                  {reportTemplates.value.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p class="help">
              {_`Diese Berichtsvorlage wird für den Matrix-Export-Button verwendet. Wenn keine Vorlage ausgewählt ist, wird der Export-Button ausgeblendet.`}
            </p>
          </div>
        </div>

        {saveAction.value?.success && (
          <div class="notification is-success">
            {_`Einstellungen wurden gespeichert.`}
          </div>
        )}

        <div class="buttons mt-5 is-right">
          {permissions.value.canUpdate && (
            <button type="submit" class={["button", "is-primary", {
              'is-loading': saveAction.isRunning
            }]}>{_`Speichern`}</button>
          )}
        </div>
      </Form>
    </MainContentLarge>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Einstellungen`,
  meta: [],
};
