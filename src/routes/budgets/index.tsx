import { component$, useComputed$, useSignal, useStylesScoped$, useTask$ } from "@builder.io/qwik";
import { DocumentHead, Link, routeAction$, routeLoader$, zod$, z } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import MainContentMenu from "~/components/layout/MainContentMenu";
import MainContentMenuHeader from "~/components/layout/MainContentMenuHeader";
import { formatDateShort } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import styles from "./index.scss?inline";
import CreateBudgetMenu from "~/components/budgets/CreateBudgetMenu";
import EditBudgetMenu from "~/components/budgets/EditBudgetMenu";



export const CreateBudgetSchema = {
  name: z.string(),
  description: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date()
};

export const SaveBudgetSchema = {
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  revisions: z.array(z.object({
    id: z.string().uuid(),
    date: z.string().date(),
    description: z.string()
  }))
};

async function createBudget(name: string, description: string, startDate: Date, endDate: Date): Promise<void> {
  await Prisma.budgets.create({
    data: {
      display_name: name,
      display_description: description,
      period_start: startDate,
      period_end: endDate,
      budget_revisions: {
        create: {
          date: startDate,
        }
      }
    }
  });
}

interface Revision {
  id: string;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

async function listRevisions(budgetId: string): Promise<Revision[]> {
  const revisions = await Prisma.budget_revisions.findMany({
    where: {
      budget_id: budgetId,
    },
    orderBy: {
      created_at: "asc"
    }
  });

  return revisions.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.display_description,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function saveBudget(id: string, name: string, description: string, startDate: Date, endDate: Date): Promise<void> {
  const m = await Prisma.budgets.findFirst({
    where: {
      id: id,
    },
  });
  if (!m) {
    return;
  }

  m.display_name = name;
  m.display_description = description;
  m.period_start = startDate;
  m.period_end = endDate;

  await Prisma.budgets.update({
    where: {
      id: id,
    },
    data: m,
  });
}

async function saveRevision(id: string, date: Date, description: string): Promise<void> {
  const m = await Prisma.budget_revisions.findFirst({
    where: {
      id: id,
    },
  });
  if (!m) {
    return;
  }

  m.display_description = description;
  m.date = date;

  await Prisma.budget_revisions.update({
    where: {
      id: id,
    },
    data: m,
  });
};

async function deleteRevision(id: string): Promise<void> {
  await Prisma.budget_revisions.delete({
    where: {
      id: id,
    },
  });
}

export const useCreateBudgetRouteAction = routeAction$(async (args) => {
  await createBudget(args.name, args.description, new Date(args.startDate), new Date(args.endDate));

  return {
    success: true
  };
}, zod$(CreateBudgetSchema));

export const useSaveBudgetRouteAction = routeAction$(async (values) => {
  await saveBudget(
    values.id,
    values.name,
    values.description,
    new Date(values.startDate),
    new Date(values.endDate)
  );

  const rs = await listRevisions(values.id);

  for (const r of rs) {
    const v = values.revisions.find((v) => v.id === r.id);
    if (v) {
      await saveRevision(r.id, new Date(v.date), v.description);
    } else {
      await deleteRevision(r.id);
    }
  }

  return {
    status: "success"
  }
}, zod$(SaveBudgetSchema));

export enum MenuStatus {
  None,
  Create,
  Edit
}

interface Budget {
  id: string;
  display_name: string;
  display_description: string;
  period_start: Date;
  period_end: Date;
  is_closed: boolean;
}

async function getBudgets(offset: number, limit: number): Promise<Budget[]> {
  const res = await Prisma.budgets.findMany({
    skip: offset,
    take: limit,
  });

  return res.map((budget) => ({
    id: budget.id,
    display_name: budget.display_name,
    display_description: budget.display_description,
    is_closed: budget.is_closed,
    period_start: budget.period_start,
    period_end: budget.period_end,
  }));
}

export const useGetBudgets = routeLoader$<Budget[]>(async () => await getBudgets(0, 10));

export default component$(() => {
  useStylesScoped$(styles);

  const budgets = useGetBudgets();
  const menuStatus = useSignal<MenuStatus>(MenuStatus.None);
  const createMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Create);
  const editMenuShown = useComputed$(() => menuStatus.value === MenuStatus.Edit);
  const editMenuBudgetId = useSignal<string>('');

  useTask$(({ track }) => {
    track(() => menuStatus.value);

    if (menuStatus.value !== MenuStatus.Edit) {
      editMenuBudgetId.value = '';
    }
  });

  return (
    <>
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li class="is-active"><Link href="#" aria-current="page">Haushaltspläne</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
          <HeaderButtons>
            <button class="button is-primary is-rounded"
              onClick$={() => menuStatus.value = menuStatus.value === MenuStatus.Create ? MenuStatus.None : MenuStatus.Create}>Hinzufügen</button>
          </HeaderButtons>
        </Header>
        <table class="table is-narrow is-hoverable is-striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Beginn</th>
              <th>Ende</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {budgets.value.map((budget) => (
              <tr key={budget.id}>
                <td class="is-vcentered">{budget.display_name}</td>
                <td class="is-vcentered">{formatDateShort(budget.period_start)}</td>
                <td class="is-vcentered">{formatDateShort(budget.period_end)}</td>
                <td class="is-vcentered"><span class={[
                  'tag',
                  budget.is_closed ? 'is-danger' : 'is-success'
                ]}>{budget.is_closed ? 'Geschlossen' : 'Offen'}</span></td>
                <td class="is-vcentered">
                  <p class="buttons are-small is-right">
                    <button class="button" onClick$={() => {
                      editMenuBudgetId.value = budget.id;
                      menuStatus.value = MenuStatus.Edit;
                    }}>Bearbeiten</button>
                    <Link class="button is-danger is-outlined" href={`/budgets/${budget.id}/delete`}>Entfernen</Link>
                  </p>
                </td>
              </tr>
            ))}
            {budgets.value.length === 0 && (
              <tr>
                <td colSpan={6} class="has-text-centered">
                  <p class="is-size-6">Keine Haushaltspläne gefunden</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MainContent>

      <MainContentMenu isShown={editMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          Haushaltsplan bearbeiten
        </MainContentMenuHeader>

        <EditBudgetMenu budgetId={editMenuBudgetId}></EditBudgetMenu>
      </MainContentMenu>

      <MainContentMenu isShown={createMenuShown}>
        <MainContentMenuHeader onClose$={() => menuStatus.value = MenuStatus.None}>
          Haushaltsplan erstellen
        </MainContentMenuHeader>

        <CreateBudgetMenu />
      </MainContentMenu >
    </>
  );
});

export const head: DocumentHead = {
  title: "VSFV | Haushaltspläne",
  meta: [],
};
