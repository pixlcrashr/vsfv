import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import CreateReportMenu from "~/components/reports/CreateReportMenu";
import RenderReportMenu from "~/components/reports/RenderReportMenu";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { buildTreeFromDB, sortedFlatAccountIterator } from "~/lib/accounts/tree";
import { generateReportPdf } from "~/lib/reports/generate";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";
import { _ } from "compiled-i18n";



export const onRequest: RequestHandler = requirePermission(Permissions.REPORTS_READ);

export interface Report {
  id: string;
  name: string;
  createdAt: Date;
}

async function getReports(): Promise<Report[]> {
  return (await Prisma.reports.findMany({
    orderBy: {
      created_at: 'desc'
    }
  })).map(x => ({
    id: x.id,
    name: x.display_name,
    createdAt: x.created_at
  }));
}

export const useGetReportsLoader = routeLoader$(async () => {
  return await getReports();
});

export const useReportPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canCreate: Permissions.REPORTS_CREATE,
    canDelete: Permissions.REPORTS_DELETE
  });
});

export const DeleteReportSchema = {
  id: z.string().uuid()
};

async function deleteReport(id: string): Promise<void> {
  await Prisma.reports.delete({
    where: {
      id: id
    }
  });
}

export const useDeleteReportAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.REPORTS_DELETE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  await deleteReport(values.id);

  return {
    success: true
  };
}, zod$(DeleteReportSchema));

export interface Account {
  id: string;
  code: string;
  name: string;
  isGroup: boolean;
  depth: number;
}

async function getAccounts(): Promise<Account[]> {
  const as = await Prisma.accounts.findMany({
    orderBy: {
      display_code: 'asc',
    }
  });

  const tree = buildTreeFromDB(as);
  const flatAccounts: Account[] = [];

  for (const flat of sortedFlatAccountIterator(tree)) {
    flatAccounts.push({
      id: flat.id,
      code: flat.code,
      name: flat.name,
      depth: flat.depth,
      isGroup: flat.isGroup
    });
  }

  return flatAccounts;
}

export const useGetAccountsLoader = routeLoader$(async () => {
  return await getAccounts();
});

export interface Budget {
  id: string;
  name: string;
  revisions: {
    id: string;
    date: Date;
  }[]
}

async function getBudgets(): Promise<Budget[]> {
  return (await Prisma.budgets.findMany({
    include: {
      budget_revisions: true
    },
    orderBy: {
      period_start: 'desc'
    }
  })).map(x => ({
    id: x.id,
    name: x.display_name,
    revisions: x.budget_revisions.map(x => ({
      id: x.id,
      date: x.date
    }))
  }));
}

export const useGetBudgetsLoader = routeLoader$(async () => {
  return await getBudgets();
});

export interface ReportTemplate {
  id: string;
  name: string;
}

async function getReportTemplates(): Promise<ReportTemplate[]> {
  return (await Prisma.report_templates.findMany({
    orderBy: {
      display_name: 'asc'
    }
  })).map(x => ({
    id: x.id,
    name: x.display_name
  }));
}

export const useGetReportTemplatesLoader = routeLoader$(async () => {
  return await getReportTemplates();
});

enum MenuStatus {
  None,
  Create,
  Render
}

export const CreateReportSchema = {
  reportTemplateId: z.string().uuid(),
  name: z.string().min(1),
  selectedBudgetIds: z.array(z.string().uuid()),
  selectedAccountIds: z.array(z.string().uuid()),
  actualValuesEnabled: z.string().optional().transform(x => x === 'on'),
  targetValuesEnabled: z.string().optional().transform(x => x === 'on'),
  differenceValuesEnabled: z.string().optional().transform(x => x === 'on'),
  accountDescriptionsEnabled: z.string().optional().transform(x => x === 'on'),
  budgetDescriptionsEnabled: z.string().optional().transform(x => x === 'on'),
  latestRevisionOnly: z.string().optional().transform(x => x === 'on')
};

async function createReport(
  html2pdfUrl: string,
  reportTemplateId: string,
  name: string,
  selectedBudgetIds: string[],
  selectedAccountIds: string[],
  actualValuesEnabled: boolean,
  targetValuesEnabled: boolean,
  differenceValuesEnabled: boolean,
  accountDescriptionsEnabled: boolean,
  budgetDescriptionsEnabled: boolean,
  latestRevisionOnly: boolean
): Promise<void> {
  const d = await generateReportPdf(
    html2pdfUrl,
    reportTemplateId,
    selectedBudgetIds,
    selectedAccountIds,
    actualValuesEnabled,
    targetValuesEnabled,
    differenceValuesEnabled,
    accountDescriptionsEnabled,
    budgetDescriptionsEnabled,
    latestRevisionOnly
  );

  await Prisma.reports.create({
    data: {
      display_name: name,
      data: await d.bytes()
    }
  });
}

export const useCreateReportAction = routeAction$(async (values, { env, sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.REPORTS_CREATE);
  if (!auth.authorized) {
    return auth.result;
  }
  
  await createReport(
    env.get('HTML2PDF_URL') ?? '',
    values.reportTemplateId,
    values.name,
    values.selectedBudgetIds,
    values.selectedAccountIds,
    values.actualValuesEnabled,
    values.targetValuesEnabled,
    values.differenceValuesEnabled,
    values.accountDescriptionsEnabled,
    values.budgetDescriptionsEnabled,
    values.latestRevisionOnly
  );

  return {
    success: true
  };
}, zod$(CreateReportSchema));

export default component$(() => {
  const getLoader = useGetReportsLoader();
  const deleteAction = useDeleteReportAction();
  const permissions = useReportPermissions();

  const getAccountsLoader = useGetAccountsLoader();
  const getBudgetsLoader = useGetBudgetsLoader();
  const getReportTemplatesLoader = useGetReportTemplatesLoader();

  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);
  const renderMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Render);

  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active"><Link href="#" aria-current="page">{_`Berichte`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            {permissions.value.canCreate && (
              <button class="button is-primary is-rounded" onClick$={() => menuStatus.value = MenuStatus.Create}>{_`Erstellen`}</button>
            )}
            <button class="button is-link is-rounded" onClick$={() => menuStatus.value = MenuStatus.Render}>{_`Export`}</button>
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
            {getLoader.value.map((report) => (
              <tr key={report.id}>
                <td class="is-vcentered">{report.name}</td>
                <td class="is-vcentered">{formatDateShort(report.createdAt)}</td>
                <td class="is-vcentered">
                  <div class="buttons are-small">
                    <Link href={`/reports/${report.id}/view`} target="_blank" class="button">{_`Anzeigen`}</Link>
                    {permissions.value.canDelete && (
                      <Form action={deleteAction}>
                        <input type="hidden" name="id" value={report.id} />
                        <button type="submit" class="button is-danger is-outlined" disabled={deleteAction.isRunning}>{_`Entfernen`}</button>
                      </Form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {getLoader.value.length === 0 && (
              <tr>
                <td colSpan={6} class="has-text-centered">
                  <p class="is-size-6">{_`Keine Berichte gefunden`}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MainContent>
      <MainContentMenu isShown={createMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          {_`Bericht erstellen`}
        </MainContentMenuHeader>

        <CreateReportMenu
          budgets={getBudgetsLoader.value}
          accounts={getAccountsLoader.value}
          reportTemplates={getReportTemplatesLoader.value} />
      </MainContentMenu>
      <MainContentMenu isShown={renderMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          {_`Bericht exportieren`}
        </MainContentMenuHeader>

        <RenderReportMenu
          budgets={getBudgetsLoader.value}
          accounts={getAccountsLoader.value}
          reportTemplates={getReportTemplatesLoader.value} />
      </MainContentMenu>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Berichte`,
  meta: [],
};
