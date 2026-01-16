import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, server$, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { formatDateInputField } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions, checkPermissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.BUDGETS_READ);

interface Revision {
  id: string;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Budget {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  is_closed: boolean;
  created_at: Date;
  updated_at: Date;
  revisions: Revision[];
  lastRevisionDate: Date;
}

async function getBudget(id: string): Promise<Budget | null> {
  try {
    const m = await Prisma.budgets.findUnique({
      include: {
        budget_revisions: {
          orderBy: {
            date: 'asc'
          }
        },
      },
      where: {
        id: id,
      },
    });
    if (!m) {
      return null;
    }

    return {
      id: m.id,
      name: m.display_name,
      description: m.display_description,
      startDate: m.period_start,
      endDate: m.period_end,
      is_closed: m.is_closed,
      created_at: m.created_at,
      updated_at: m.updated_at,
      revisions: m.budget_revisions.map((r) => ({
        id: r.id,
        date: r.date,
        description: r.display_description,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      lastRevisionDate: m.budget_revisions[m.budget_revisions.length - 1]?.date ?? new Date(),
    };
  } catch {
    return null;
  }
}

export const useGetBudget = routeLoader$<Budget | null>(async ({ params }) => {
  return await getBudget(params.budgetId);
});

export const useBudgetPermissions = routeLoader$(async ({ sharedMap }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  return await checkPermissions(userId, {
    canUpdate: Permissions.BUDGETS_UPDATE
  });
});

export const SaveBudgetSchema = {
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  revisions: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) {
        return [];
      }
      return (val as unknown[]).filter(Boolean);
    },
    z.array(z.object({
      id: z.string().uuid(),
      date: z.string().date().optional(),
      description: z.string().optional()
    }))
  ).optional()
};

async function saveBudget(id: string, name: string, description: string, startDate: Date, endDate: Date): Promise<void> {
  await Prisma.budgets.update({
    where: {
      id: id,
    },
    data: {
      display_name: name,
      display_description: description,
      period_start: startDate,
      period_end: endDate
    },
  });
}

async function saveRevision(id: string, date: Date, description: string): Promise<void> {
  await Prisma.budget_revisions.update({
    where: {
      id: id,
    },
    data: {
      display_description: description,
      date: date
    },
  });
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

async function deleteRevision(id: string): Promise<void> {
  await Prisma.budget_revision_account_values.deleteMany({
    where: {
      budget_revision_id: id
    }
  });

  await Prisma.budget_revisions.delete({
    where: {
      id: id,
    },
  });
}

async function addRevision(budgetId: string): Promise<Revision> {
  const m = await Prisma.budget_revisions.create({
    data: {
      budget_id: budgetId,
      date: new Date(),
    }
  });

  return {
    id: m.id,
    date: m.date,
    description: m.display_description,
    createdAt: m.created_at,
    updatedAt: m.updated_at
  };
}

async function closeBudget(id: string): Promise<void> {
  await Prisma.budgets.update({
    where: { id },
    data: { is_closed: true }
  });
}

export const useSaveBudgetAction = routeAction$(async (values, { sharedMap, fail, redirect }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.BUDGETS_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const budget = await Prisma.budgets.findUnique({ where: { id: values.id } });
  if (budget?.is_closed) {
    return fail(400, { message: 'Budget is closed and cannot be edited' });
  }
  
  await saveBudget(
    values.id,
    values.name,
    values.description,
    new Date(values.startDate),
    new Date(values.endDate)
  );

  const submittedRevisions = values.revisions ?? [];
  const rs = await listRevisions(values.id);

  for (const r of rs) {
    const v = submittedRevisions.find((v) => v.id === r.id);
    if (v && v.date && v.description !== undefined) {
      await saveRevision(r.id, new Date(v.date), v.description);
    }
  }

  throw redirect(302, '/budgets');
}, zod$(SaveBudgetSchema));

export const addRevisionServer = server$(async (budgetId: string): Promise<Revision | null> => {
  try {
    return await addRevision(budgetId);
  } catch {
    return null;
  }
});

export const deleteRevisionServer = server$(async (revisionId: string): Promise<boolean> => {
  try {
    await deleteRevision(revisionId);
    return true;
  } catch {
    return false;
  }
});

export const closeBudgetServer = server$(async (budgetId: string): Promise<boolean> => {
  try {
    await closeBudget(budgetId);
    return true;
  } catch {
    return false;
  }
});

export default component$(() => {
  const budget = useGetBudget();
  const permissions = useBudgetPermissions();
  const saveBudgetAction = useSaveBudgetAction();

  const localRevisions = useSignal<Revision[]>([]);
  const isAddingRevision = useSignal(false);
  const isRemovingRevision = useSignal(false);
  const isClosingBudget = useSignal(false);

  useTask$(({ track }) => {
    track(() => budget.value);

    if (budget.value) {
      localRevisions.value = budget.value.revisions;
    }
  });

  if (!budget.value) {
    return (
      <MainContent>
        <Header>
          <HeaderTitle>
            <nav class="breadcrumb" aria-label="breadcrumbs">
              <ul>
                <li><Link href="/budgets">{_`Haushaltspläne`}</Link></li>
                <li class="is-active"><Link href="#" aria-current="page">{_`Bearbeiten`}</Link></li>
              </ul>
            </nav>
          </HeaderTitle>
        </Header>
        <div class="notification is-warning">{_`Haushaltsplan nicht gefunden`}</div>
      </MainContent>
    );
  }

  const b = budget.value;

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/budgets">{_`Haushaltspläne`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Bearbeiten`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <Form action={saveBudgetAction}>
        <input hidden name="id" type="hidden" value={b.id} />

        <div class="field">
          <label class="label">{_`Status`}</label>
          <div class="control is-flex is-align-items-center" style="gap: 0.5rem;">
            <span class={["tag", b.is_closed ? "is-danger" : "is-success"]}>
              {!b.is_closed ? _`Offen` : _`Geschlossen`}
            </span>
            {permissions.value.canUpdate && !b.is_closed && (
              <button 
                type="button" 
                class={["button", "is-small", "is-danger", "is-outlined", { "is-loading": isClosingBudget.value }]}
                onClick$={async () => {
                  if (confirm(_`Möchten Sie diesen Haushaltsplan wirklich schließen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                    isClosingBudget.value = true;
                    const success = await closeBudgetServer(b.id);
                    if (success) {
                      window.location.reload();
                    }
                    isClosingBudget.value = false;
                  }
                }}
              >
                {_`Schließen`}
              </button>
            )}
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Name`}</label>
          <div class="control">
            <input 
              name="name" 
              class="input" 
              disabled={saveBudgetAction.isRunning || !permissions.value.canUpdate || b.is_closed} 
              type="text" 
              value={b.name} 
            />
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Beschreibung`}</label>
          <div class="control">
            <textarea 
              name="description" 
              class="textarea" 
              disabled={saveBudgetAction.isRunning || !permissions.value.canUpdate || b.is_closed} 
              rows={5} 
              value={b.description} 
            />
          </div>
        </div>

        <div class="field is-horizontal">
          <div class="field-body">
            <div class="field">
              <label class="label">{_`Start Zeitraum`}</label>
              <div class="control">
                <input 
                  name="startDate" 
                  class="input" 
                  disabled={saveBudgetAction.isRunning || !permissions.value.canUpdate || b.is_closed} 
                  type="date" 
                  value={formatDateInputField(b.startDate)} 
                />
              </div>
            </div>
            <div class="field">
              <label class="label">{_`Ende Zeitraum`}</label>
              <div class="control">
                <input 
                  name="endDate" 
                  class="input" 
                  disabled={saveBudgetAction.isRunning || !permissions.value.canUpdate || b.is_closed} 
                  type="date" 
                  value={formatDateInputField(b.endDate)} 
                />
              </div>
            </div>
          </div>
        </div>

        <div class="field">
          <label class="label">{_`Revisionen`}</label>
          <table class="table is-narrow is-fullwidth">
            <thead>
              <tr>
                <th>{_`Nr.`}</th>
                <th>{_`Datum`}</th>
                <th>{_`Beschreibung`}</th>
                {permissions.value.canUpdate && !b.is_closed && <th></th>}
              </tr>
            </thead>
            <tbody>
              {localRevisions.value.map((revision, index) => {
                const isLatest = index === localRevisions.value.length - 1;
                const canEditRevision = isLatest && permissions.value.canUpdate && !b.is_closed;
                return (
                  <tr key={revision.id}>
                    <td class="is-vcentered">{index + 1}</td>
                    <td class="is-vcentered">
                      <input type="hidden" name={`revisions.${index}.id`} value={revision.id} />
                      {!canEditRevision && (
                        <>
                          <input type="hidden" name={`revisions.${index}.date`} value={formatDateInputField(revision.date)} />
                          <span>{formatDateInputField(revision.date)}</span>
                        </>
                      )}
                      {canEditRevision && (
                        <div class="field">
                          <div class="control">
                            <input
                              name={`revisions.${index}.date`}
                              class="input"
                              type="date"
                              placeholder={_`Revisionsdatum`}
                              value={formatDateInputField(revision.date)}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td class="is-vcentered">
                      {!canEditRevision && (
                        <>
                          <input type="hidden" name={`revisions.${index}.description`} value={revision.description} />
                          <span>{revision.description || '-'}</span>
                        </>
                      )}
                      {canEditRevision && (
                        <textarea
                          class="textarea"
                          placeholder={_`Revisionsbeschreibung`}
                          rows={2}
                          name={`revisions.${index}.description`}
                          value={revision.description}
                        ></textarea>
                      )}
                    </td>
                    {permissions.value.canUpdate && !b.is_closed && (
                      <td class="is-vcentered">
                        {isLatest && localRevisions.value.length > 1 && (
                          <button
                            type="button"
                            class={["button", "is-small", "is-danger", "is-outlined", { "is-loading": isRemovingRevision.value }]}
                            onClick$={async () => {
                              if (confirm(_`Möchten Sie diese Revision wirklich entfernen?`)) {
                                isRemovingRevision.value = true;
                                const success = await deleteRevisionServer(revision.id);
                                if (success) {
                                  localRevisions.value = localRevisions.value.filter(r => r.id !== revision.id);
                                }
                                isRemovingRevision.value = false;
                              }
                            }}
                          >
                            {_`Entfernen`}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {permissions.value.canUpdate && !b.is_closed && (
            <div class="buttons is-right">
              <button 
                class={["button", { "is-loading": isAddingRevision.value }]} 
                type="button"
                onClick$={async () => {
                  isAddingRevision.value = true;
                  const newRevision = await addRevisionServer(b.id);
                  if (newRevision) {
                    localRevisions.value = [...localRevisions.value, newRevision];
                  }
                  isAddingRevision.value = false;
                }}
              >
                {_`Revision hinzufügen`}
              </button>
            </div>
          )}
        </div>

        <div class="buttons mt-5 is-right">
          <Link href="/budgets" class="button">{_`Abbrechen`}</Link>
          {permissions.value.canUpdate && !b.is_closed && (
            <button type="submit" class={["button", "is-warning", {
              'is-loading': saveBudgetAction.isRunning
            }]}>{_`Speichern`}</button>
          )}
        </div>
      </Form>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Haushaltsplan bearbeiten`,
  meta: [],
};
