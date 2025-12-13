import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";

interface MonthPoint {
  label: string;
  count: number;
}

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
  };
});

interface ChartCanvasProps {
  type: string;
  data: unknown;
  options?: unknown;
}

const ChartCanvas = component$<ChartCanvasProps>(({ type, data, options }) => {
  const canvasRef = useSignal<HTMLCanvasElement>();

  useVisibleTask$(async ({ cleanup }) => {
    if (!canvasRef.value) {
      return;
    }

    const { default: Chart } = await import("chart.js/auto");

    const chart = new Chart(canvasRef.value, {
      type: type as any,
      data: data as any,
      options: options as any,
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

  const assignmentsChartData = {
    labels: [_`Zugeordnet`, _`Nicht zugeordnet`],
    datasets: [
      {
        label: _`Journalbuchungen`,
        data: [stats.value.transactions.assigned, stats.value.transactions.unassigned],
        backgroundColor: ["#00d1b2", "#ffdd57"],
      },
    ],
  };

  const transactionsByMonthData = {
    labels: stats.value.transactions.last12Months.map((m) => m.label),
    datasets: [
      {
        label: _`Buchungen pro Monat`,
        data: stats.value.transactions.last12Months.map((m) => m.count),
        borderColor: "#7957d5",
        backgroundColor: "rgba(121, 87, 213, 0.25)",
        fill: true,
        tension: 0.25,
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
              <div class="column is-4">
                <div class="box">
                  <p class="title is-6">{_`Haushaltspläne`}</p>
                  <p class="subtitle is-7">{_`Gesamt`}: {stats.value.budgets.total}</p>
                  <ChartCanvas type="doughnut" data={budgetsChartData} />
                </div>
              </div>
              <div class="column is-4">
                <div class="box">
                  <p class="title is-6">{_`Haushaltskonten`}</p>
                  <p class="subtitle is-7">{_`Gesamt`}: {stats.value.accounts.total}</p>
                  <ChartCanvas type="doughnut" data={accountsChartData} />
                </div>
              </div>
              <div class="column is-4">
                <div class="box">
                  <p class="title is-6">{_`Journal`}</p>
                  <p class="subtitle is-7">{_`Gesamt`}: {stats.value.transactions.total}</p>
                  <ChartCanvas type="pie" data={assignmentsChartData} />
                </div>
              </div>
            </div>
          </div>

          <div class="column is-12">
            <div class="box">
              <p class="title is-6">{_`Trend`}</p>
              <p class="subtitle is-7">{_`Buchungen der letzten 12 Monate`}</p>
              <div style="height: 260px">
                <ChartCanvas
                  type="line"
                  data={transactionsByMonthData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          precision: 0,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Übersicht`,
  meta: [],
};
