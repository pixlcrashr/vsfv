import { component$, QRL, Resource, Signal, useResource$ } from "@builder.io/qwik";
import { Form, server$ } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import { delay } from "~/lib/delay";
import { formatDateInputField } from "~/lib/format";
import { Prisma } from "~/lib/prisma";
import { useSaveBudgetRouteAction } from "~/routes/budgets/index@menu";

interface EditBudgetMenuProps {
  budgetId: Signal<string>;
  onSaved$?: QRL<() => void>;
}

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
        budget_revisions: true,
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
      lastRevisionDate: m.budget_revisions[m.budget_revisions.length - 1].date ?? new Date(),
    };
  } catch {
    return null;
  }
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

export const addRevisionServer = server$(async (budgetId: string) => {
  return await addRevision(budgetId);
});

export const fetchBudget = server$(async (budgetId: string) => {
  const b = await getBudget(budgetId);

  return b;
});

export default component$<EditBudgetMenuProps>(({ budgetId, onSaved$ }) => {
  const budgetResource = useResource$(async ({ track }) => {
    track(() => budgetId.value);

    if (budgetId.value === '') {
      return null;
    }

    const b = await fetchBudget(budgetId.value);

    await delay(300);

    return b;
  });
  const saveBudgetAction = useSaveBudgetRouteAction();

  return (
    <>
      <Resource value={budgetResource} onPending={() => {
        return <progress class="progress is-small is-primary" max="100"></progress>;
      }} onResolved={(budget) => {
        return (<>
          {budget !== null && <Form action={saveBudgetAction}>
            <input hidden name="id" type="hidden" value={budget.id} />

            <div class="field">
              <label class="label">{_`Status`}</label>
              <div class="control">
                <p>{!budget.is_closed ? _`Offen` : _`Geschlossen`}</p>
              </div>
            </div>

            <div class="field">
              <label class="label">{_`Name`}</label>
              <div class="control">
                <input name="name" class="input is-small" disabled={saveBudgetAction.isRunning} type="text" value={budget.name} />
              </div>
            </div>

            <div class="field">
              <label class="label">{_`Beschreibung`}</label>
              <div class="control">
                <textarea name="description" class="textarea is-small" disabled={saveBudgetAction.isRunning} rows={10} value={budget.description} />
              </div>
            </div>

            <div class="field is-horizontal">
              <div class="field-body">
                <div class="field">
                  <label class="label">{_`Start Zeitraum`}</label>
                  <div class="control">
                    <input name="startDate" class="input is-small" disabled={saveBudgetAction.isRunning} type="date" value={formatDateInputField(budget.startDate)} />
                  </div>
                </div>
                <div class="field">
                  <label class="label">{_`Ende Zeitraum`}</label>
                  <div class="control">
                    <input name="endDate" class="input is-small" disabled={saveBudgetAction.isRunning} type="date" value={formatDateInputField(budget.endDate)} />
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {budget.revisions.map((revision, index) => <tr key={revision.id}>
                        <td class="is-vcentered">{index + 1}</td>
                        <td class="is-vcentered">
                          <input hidden name={`revisions.${index}.id`} disabled={index !== budget.revisions.length - 1} type="hidden" value={revision.id} />
                          <div class="field">
                            <div class="control is-small">
                              <input
                                name={`revisions.${index}.date`}
                                class="input is-small"
                                disabled={index !== budget.revisions.length - 1}
                                type="date"
                                placeholder={_`Revisionsdatum`}
                                value={formatDateInputField(revision.date)}
                              />
                            </div>
                          </div>
                        </td>
                        <td class="is-vcentered">
                          <textarea
                              class="textarea is-small"
                              disabled={index !== budget.revisions.length - 1}
                              placeholder={_`Revisionsbeschreibung`}
                              rows={3}
                              name={`revisions.${index}.description`}
                              value={revision.description}
                            ></textarea>
                        </td>
                        <td class="is-vcentered">
                          {index === budget.revisions.length - 1 && <button type="button" class="delete" onClick$={() => {
                            budget.revisions.splice(index, 1);
                          }}></button>}
                        </td>
                      </tr>)}
                </tbody>
              </table>
              <div class="buttons is-right are-small">
                <button class="button" type="button" onClick$={async () => {
                  const r = await addRevisionServer(budget.id ?? '');

                  budget.revisions.push({
                    id: r.id,
                    date: r.date,
                    description: r.description,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt
                  });
                }}>{_`Revision hinzufügen`}</button>
              </div>
            </div>

            <div class="buttons mt-5 is-right are-small">
              <button type="submit" class={["button", "is-warning", {
                'is-loading': saveBudgetAction.isRunning
              }]}>{_`Speichern`}</button>
            </div>
          </Form>}
        </>);
      }} />

    </>
  );
});

