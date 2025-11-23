import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import Decimal from "decimal.js";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import CreateReportMenu from "~/components/reports/CreateReportMenu";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { accountsModel } from "~/lib/prisma/generated/models";
import { renderReport } from "~/lib/reports/render";
import { Prisma as P } from "~/lib/prisma/generated/client";
import { Decimal as PDecimal } from "@prisma/client/runtime/library";
import { Account as ReportAccount } from "~/lib/reports/render";



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

  as.sort((a, b) => a.display_code.localeCompare(b.display_code, undefined, { numeric: true }));

  const flatAccounts: Account[] = [];

  const dfs = (account: accountsModel, depth: number) => {
    const children = as.filter(x => x.parent_account_id === account.id)

    flatAccounts.push({
      id: account.id,
      code: account.display_code,
      name: account.display_name,
      depth: depth,
      isGroup: children.length > 0
    });

    children.forEach(x => dfs(x, depth + 1));
  };

  as.filter(x => x.parent_account_id === null).forEach(dfs, 0);

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
  Create
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

function bravKey(budgetRevisionId: string, accountId: string): string {
  return `${budgetRevisionId}:${accountId}`;
}

function avKey(budgetId: string, accountId: string): string {
  return `${budgetId}:${accountId}`;
}


function filterReachableAccounts(
  allAccounts: accountsModel[],
  selectedIds: string[] | Set<string>
): accountsModel[] {
  const allowedIds = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);

  const byId = new Map<string, accountsModel>();
  for (const acc of allAccounts) {
    byId.set(acc.id, acc);
  }

  const reachableCache = new Map<string, boolean>();

  const isReachable = (id: string): boolean => {
    if (reachableCache.has(id)) {
      return reachableCache.get(id)!;
    }

    const account = byId.get(id);
    if (!account) {
      reachableCache.set(id, false);
      return false;
    }

    if (allowedIds.has(id)) {
      reachableCache.set(id, true);
      return true;
    }

    if (account.parent_account_id == null) {
      reachableCache.set(id, false);
      return false;
    }

    const result = isReachable(account.parent_account_id);
    reachableCache.set(id, result);
    return result;
  };

  return allAccounts.filter((acc) => isReachable(acc.id));
}

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
  // TODO: generate report pdf
  const reportTemplate = await Prisma.report_templates.findUnique({
    where: {
      id: reportTemplateId
    }
  });

  if (reportTemplate == null) {
    throw new Error('Report template not found');
  }

  const budgets = await Prisma.budgets.findMany({
    where: {
      id: {
        in: selectedBudgetIds
      }
    },
    include: {
      budget_revisions: true
    }
  });

  const allAccounts = filterReachableAccounts(await Prisma.accounts.findMany({
    orderBy: {
      display_code: 'asc'
    }
  }), selectedAccountIds);

  const bravs = await Prisma.budget_revision_account_values.findMany({
    where: {
      budget_revision_id: {
        in: budgets.flatMap(b => b.budget_revisions.map(r => r.id))
      },
      account_id: {
        in: allAccounts.map(a => a.id)
      }
    }
  });

  const sumActualChildren = (m: accountsModel, budgetId: string): Decimal => {
    const children = allAccounts.filter(x => x.parent_account_id === m.id);

    let sum = new Decimal(0);

    children.forEach(x => {
      const subChildren = allAccounts.filter(y => y.parent_account_id === x.id);
      if (subChildren.length > 0) {
        sum = sum.add(sumActualChildren(x, budgetId));
        return;
      }

      const av = avs.find(av => av.account_id === x.id && av.budget_id === budgetId);

      if (av) {
        sum = sum.add(new Decimal(av.amount));
      }
    });

    return sum;
  };

  const sumTargetChildren = (m: accountsModel, revisionId: string): Decimal => {
    const children = allAccounts.filter(x => x.parent_account_id === m.id);

    let sum = new Decimal(0);

    children.forEach(x => {
      const subChildren = allAccounts.filter(y => y.parent_account_id === x.id);
      if (subChildren.length > 0) {
        sum = sum.add(sumTargetChildren(x, revisionId));
        return;
      }

      const brav = bravs.find(br => br.account_id === x.id && br.budget_revision_id === revisionId);

      if (brav) {
        sum = sum.add(new Decimal(brav.value));
      }
    });

    return sum;

  };

  const q = P.sql`SELECT b.id as budget_id, t.assigned_account_id AS account_id, SUM(t.amount) AS amount
FROM
  budgets AS b,
  transactions AS t
WHERE
  b.id IN (${P.join(budgets.map(b => P.sql`${b.id}::uuid`))}) AND
  t.document_date >= b.period_start AND
  t.document_date <= b.period_end AND
  t.assigned_account_id IS NOT NULL
GROUP BY b.id, t.assigned_account_id`;

  const avs = await Prisma.$queryRaw<{
    budget_id: string;
    account_id: string;
    amount: PDecimal;
  }[]>(q);

  const bravMap = new Map<string, Decimal>();
  const avMap = new Map<string, Decimal>();
  const brbMap = new Map<string, string>();

  budgets.forEach(b => {
    b.budget_revisions.forEach(r => {
      brbMap.set(r.id, b.id);
    });
  });

  const traverseTree = (m: accountsModel, depth: number, parent: ReportAccount) => {
    const children = allAccounts.filter(x => x.parent_account_id === m.id);
    const isGroup = children.length > 0;

    const a: ReportAccount = {
      id: m.id,
      code: m.display_code,
      name: m.display_name,
      depth: depth,
      children: [],
      description: m.display_description
    };
    parent.children.push(a);

    budgets.forEach(b => {
      let actualValue = new Decimal(0);

      if (isGroup) {
        actualValue = sumActualChildren(m, b.id);
      } else {
        actualValue = avs.find(av => av.budget_id === b.id && av.account_id === m.id)?.amount ?? new Decimal(0);
      }

      avMap.set(avKey(b.id, m.id), actualValue);

      b.budget_revisions.forEach((r) => {
        let tV: Decimal = new Decimal(0);
        if (isGroup) {
          tV = sumTargetChildren(m, r.id);
        } else {
          const brav = bravs.find(br => br.account_id === m.id && br.budget_revision_id === r.id);
          if (brav) {
            tV = new Decimal(brav.value);
          }
        }

        bravMap.set(bravKey(r.id, m.id), tV);
      })
    });

    children.forEach(x => traverseTree(x, depth + 1, a));
  };

  const tmpRes = allAccounts.
    filter(x => x.parent_account_id === null).
    map(x => ([x, {
      id: x.id,
      children: [],
      code: x.display_code,
      depth: 0,
      description: x.display_description,
      name: x.display_name
    } as ReportAccount] as [accountsModel, ReportAccount]));

  tmpRes.forEach(x => traverseTree(x[0], 1, x[1]))

  const d = await renderReport(
    reportTemplate.template,
    html2pdfUrl,
    {
      actualValuesEnabled,
      targetValuesEnabled,
      differenceValuesEnabled,
      accountDescriptionsEnabled,
      budgetDescriptionsEnabled,
      getActualValueHandler: (budgetId: string, accountId: string) => {
        return avMap.get(avKey(budgetId, accountId)) ?? new Decimal(0);
      },
      getTargetValueHandler: (budgetRevisionId: string, accountId: string) => {
        return bravMap.get(bravKey(budgetRevisionId, accountId)) ?? new Decimal(0);
      },
      getDiffValueHandler: (budgetRevisionId: string, accountId: string) => {
        const bId = brbMap.get(budgetRevisionId);
        const av = avMap.get(avKey(bId ?? '', accountId)) ?? new Decimal(0);
        const tv = bravMap.get(bravKey(budgetRevisionId, accountId)) ?? new Decimal(0);

        return tv.sub(av);
      },
      budgets: budgets.map(x => ({
        id: x.id,
        name: x.display_name,
        description: x.display_description,
        periodStart: x.period_start,
        periodEnd: x.period_end,
        revisions: x.budget_revisions.map(x => ({
          id: x.id,
          date: x.date
        }))
      })),
      accounts: tmpRes.map(x => x[1])
    }
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
    </>
  );
})
