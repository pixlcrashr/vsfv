import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
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

export const useDeleteReportAction = routeAction$(async (values) => {
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
  budgetDescriptionsEnabled: z.string().optional().transform(x => x === 'on')
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
  budgetDescriptionsEnabled: boolean
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
    budgetDescriptionsEnabled
  );

  await Prisma.reports.create({
    data: {
      display_name: name,
      data: await d.bytes()
    }
  });
}

export const useCreateReportAction = routeAction$(async (values, { env }) => {
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
    values.budgetDescriptionsEnabled
  );

  return {
    success: true
  };
}, zod$(CreateReportSchema));

export default component$(() => {
  const getLoader = useGetReportsLoader();
  const deleteAction = useDeleteReportAction();

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
                <li class="is-active"><Link href="#" aria-current="page">Berichte</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            <button class="button is-primary is-rounded" onClick$={() => menuStatus.value = MenuStatus.Create}>Erstellen</button>
            <button class="button is-link is-rounded" onClick$={() => menuStatus.value = MenuStatus.Render}>Export</button>
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
            {getLoader.value.map((report) => (
              <tr key={report.id}>
                <td class="is-vcentered">{report.name}</td>
                <td class="is-vcentered">{formatDateShort(report.createdAt)}</td>
                <td class="is-vcentered">
                  <div class="buttons are-small">
                    <Link href={`/reports/${report.id}/view`} target="_blank" class="button">Anzeigen</Link>

                    <Form action={deleteAction}>
                      <input type="hidden" name="id" value={report.id} />
                      <button type="submit" class="button is-danger is-outlined" disabled={deleteAction.isRunning}>Entfernen</button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
            {getLoader.value.length === 0 && (
              <tr>
                <td colSpan={6} class="has-text-centered">
                  <p class="is-size-6">Keine Berichte gefunden</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MainContent>
      <MainContentMenu isShown={createMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          Bericht erstellen
        </MainContentMenuHeader>

        <CreateReportMenu
          budgets={getBudgetsLoader.value}
          accounts={getAccountsLoader.value}
          reportTemplates={getReportTemplatesLoader.value} />
      </MainContentMenu>
      <MainContentMenu isShown={renderMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          Bericht exportieren
        </MainContentMenuHeader>

        <RenderReportMenu
          budgets={getBudgetsLoader.value}
          accounts={getAccountsLoader.value}
          reportTemplates={getReportTemplatesLoader.value} />
      </MainContentMenu>
    </>
  );
})
