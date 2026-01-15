import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";
import { requirePermission, Permissions } from "~/lib/auth";
import Chart from 'chart.js/auto';



export const onRequest: RequestHandler = requirePermission(Permissions.OVERVIEW_READ);

interface MonthPoint {
  label: string;
  count: number;
}

interface MonthValue {
  label: string;
  value: number;
}

interface RootAccountMonthlyData {
  accountId: string;
  accountName: string;
  accountCode: string;
  months: MonthValue[];
}

const CHART_COLORS = [
  '#3e8ed0', '#48c78e', '#f14668', '#ffdd57', '#7957d5',
  '#00d1b2', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'
];

interface OverviewStats {
  budgets: {
    open: number;
    closed: number;
    total: number;
  };
  accounts: {
    active: number;
    archived: number;
    total: number;
  };
  transactions: {
    total: number;
    assigned: number;
    unassigned: number;
    last12Months: MonthPoint[];
  };
  rootAccountMonthly: RootAccountMonthlyData[];
}

function toMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

export const useOverviewStats = routeLoader$<OverviewStats>(async () => {
  const [budgetsOpen, budgetsClosed, accountsArchived, accountsActive, transactionsTotal, transactionsAssigned] = await Promise.all([
    Prisma.budgets.count({ where: { is_closed: false } }),
    Prisma.budgets.count({ where: { is_closed: true } }),
    Prisma.accounts.count({ where: { is_archived: true } }),
    Prisma.accounts.count({ where: { is_archived: false } }),
    Prisma.transactions.count(),
    Prisma.transactions.count({ where: { assigned_account_id: { not: null } } }),
  ]);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const recentTransactions = await Prisma.transactions.findMany({
    where: {
      booked_at: {
        gte: start,
      },
    },
    select: {
      booked_at: true,
    },
  });

  const monthMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    monthMap.set(toMonthKey(d), 0);
  }

  for (const t of recentTransactions) {
    const key = toMonthKey(t.booked_at);
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  const last12Months = Array.from(monthMap.entries()).map(([label, count]) => ({
    label,
    count,
  }));

  const allAccounts = await Prisma.accounts.findMany();
  const rootAccounts = allAccounts.filter(a => a.parent_account_id === null);

  const getDescendantIds = (accountId: string): string[] => {
    const descendants: string[] = [accountId];
    const children = allAccounts.filter(a => a.parent_account_id === accountId);
    for (const child of children) {
      descendants.push(...getDescendantIds(child.id));
    }
    return descendants;
  };

  const rootAccountMonthly: RootAccountMonthlyData[] = [];

  for (const rootAccount of rootAccounts) {
    const descendantIds = getDescendantIds(rootAccount.id);

    const assignments = await Prisma.transaction_account_assignments.findMany({
      where: {
        account_id: { in: descendantIds },
        transactions: {
          document_date: { gte: start }
        }
      },
      include: {
        transactions: true
      }
    });

    const monthValueMap = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      monthValueMap.set(toMonthKey(d), 0);
    }

    for (const a of assignments) {
      const key = toMonthKey(a.transactions.document_date);
      const currentValue = monthValueMap.get(key) ?? 0;
      monthValueMap.set(key, currentValue + parseFloat(a.value.toString()));
    }

    const sortedMonths = Array.from(monthValueMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }));

    rootAccountMonthly.push({
      accountId: rootAccount.id,
      accountName: rootAccount.display_name,
      accountCode: rootAccount.display_code,
      months: sortedMonths
    });
  }

  return {
    budgets: {
      open: budgetsOpen,
      closed: budgetsClosed,
      total: budgetsOpen + budgetsClosed,
    },
    accounts: {
      active: accountsActive,
      archived: accountsArchived,
      total: accountsActive + accountsArchived,
    },
    transactions: {
      total: transactionsTotal,
      assigned: transactionsAssigned,
      unassigned: transactionsTotal - transactionsAssigned,
      last12Months,
    },
    rootAccountMonthly,
  };
});

interface ChartCanvasProps {
  type: string;
  data: any;
  options?: any;
}

const ChartCanvas = component$<ChartCanvasProps>(({ type, data, options }) => {
  const canvasRef = useSignal<HTMLCanvasElement>();

  useVisibleTask$(async ({ cleanup }) => {
    if (!canvasRef.value) {
      return;
    }

    const chart = new Chart(canvasRef.value, {
      type: type as any,
      data: data,
      options: options
    });

    cleanup(() => chart.destroy());
  });

  return <canvas ref={canvasRef} style="width: 100%; height: 100%;" />;
});

export default component$(() => {
  const stats = useOverviewStats();

  const budgetsChartData = {
    labels: [_`Offen`, _`Geschlossen`],
    datasets: [
      {
        label: _`Haushaltspläne`,
        data: [stats.value.budgets.open, stats.value.budgets.closed],
        backgroundColor: ["#48c78e", "#f14668"],
      },
    ],
  };

  const accountsChartData = {
    labels: [_`Aktiv`, _`Archiviert`],
    datasets: [
      {
        label: _`Haushaltskonten`,
        data: [stats.value.accounts.active, stats.value.accounts.archived],
        backgroundColor: ["#3e8ed0", "#b5b5b5"],
      },
    ],
  };

  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active">
                  <Link href="#" aria-current="page">
                    {_`Übersicht`}
                  </Link>
                </li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>

        <div class="columns is-multiline">
          <div class="column is-12">
            <div class="columns is-multiline">
              <div class="column is-6">
                <div class="box">
                  <p class="title is-6">{_`Haushaltspläne`}</p>
                  <p class="subtitle is-7">{_`Gesamt`}: {stats.value.budgets.total}</p>
                  <ChartCanvas type="doughnut" data={budgetsChartData} />
                </div>
              </div>
              <div class="column is-6">
                <div class="box">
                  <p class="title is-6">{_`Haushaltskonten`}</p>
                  <p class="subtitle is-7">{_`Gesamt`}: {stats.value.accounts.total}</p>
                  <ChartCanvas type="doughnut" data={accountsChartData} />
                </div>
              </div>
            </div>
          </div>

          {stats.value.rootAccountMonthly.length > 0 && (
            <div class="column is-12">
              <div class="box">
                <p class="title is-6">{_`Buchungen der letzten 12 Monate`}</p>
                <div style="height: 300px">
                  <ChartCanvas
                    type="line"
                    data={{
                      labels: stats.value.rootAccountMonthly[0]?.months.map((m) => m.label) ?? [],
                      datasets: stats.value.rootAccountMonthly.map((rootAccount, index) => ({
                        label: `${rootAccount.accountCode} - ${rootAccount.accountName}`,
                        data: rootAccount.months.map((m) => m.value),
                        borderColor: CHART_COLORS[index % CHART_COLORS.length],
                        backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}40`,
                        fill: false,
                        tension: 0.25,
                      })),
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: true,
                          position: 'bottom',
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Übersicht`,
  meta: [],
};
