import { $, component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, routeLoader$, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";
import { useMinLoading } from "~/lib/delay";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.IMPORT_SOURCES_UPDATE);

interface PeriodDetails {
  id: string;
  year: number;
  isClosed: boolean;
  importSourceId: string;
  importSourceName: string;
}

async function getPeriod(id: string): Promise<PeriodDetails | null> {
  try {
    const period = await Prisma.import_source_periods.findUnique({
      where: { id },
      include: {
        import_sources: true
      }
    });

    if (!period || !period.import_sources) return null;

    return {
      id: period.id,
      year: period.year,
      isClosed: period.is_closed,
      importSourceId: period.import_source_id,
      importSourceName: period.import_sources.display_name
    };
  } catch {
    return null;
  }
}

async function closePeriod(periodId: string): Promise<boolean> {
  const period = await Prisma.import_source_periods.findUnique({
    where: { id: periodId }
  });

  if (!period || period.is_closed) {
    return false;
  }

  await Prisma.import_source_periods.update({
    where: { id: periodId },
    data: { is_closed: true }
  });

  return true;
}

export const useGetPeriod = routeLoader$<PeriodDetails>(async (req) => {
  const period = await getPeriod(req.params.periodId);
  if (!period) {
    throw req.redirect(307, "/admin/importSources");
  }
  return period;
});

export const useClosePeriodAction = routeAction$(async (_, req) => {
  const auth = await withPermission(req.sharedMap, req.fail, Permissions.IMPORT_SOURCES_UPDATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const period = await getPeriod(req.params.periodId);
  if (!period) {
    return req.fail(404, { message: 'Periode nicht gefunden.' });
  }

  if (period.isClosed) {
    return req.fail(400, { message: 'Diese Periode ist bereits geschlossen.' });
  }

  const success = await closePeriod(req.params.periodId);
  if (!success) {
    return req.fail(400, { message: 'Die Periode konnte nicht geschlossen werden.' });
  }

  throw req.redirect(307, `/admin/importSources/${period.importSourceId}/edit`);
});

export default component$(() => {
  const period = useGetPeriod();
  const closeAction = useClosePeriodAction();
  const isLoading = useMinLoading($(() => closeAction.isRunning));

  return (
    <>
      <MainContent>
        <Form action={closeAction}>
          <Header>
            <HeaderTitle>
              <nav class="breadcrumb" aria-label="breadcrumbs">
                <ul>
                  <li><a href="#">{_`Admin`}</a></li>
                  <li><Link href="/admin/importSources">{_`Importquellen`}</Link></li>
                  <li><Link href={`/admin/importSources/${period.value.importSourceId}/edit`}>{period.value.importSourceName}</Link></li>
                  <li class="is-active"><Link href="#" aria-current="page">{_`Periode ${period.value.year} abschließen`}</Link></li>
                </ul>
              </nav>
            </HeaderTitle>
            <HeaderButtons>
            </HeaderButtons>
          </Header>

          {period.value.isClosed ? (
            <div class="notification is-warning">
              {_`Diese Periode ist bereits geschlossen.`}
            </div>
          ) : (
            <>
              <div class="box">
                <p class="is-size-5 has-text-centered">
                  {_`Möchtest du die Periode für das Jahr ${period.value.year} wirklich abschließen?`}
                </p>
                <p class="has-text-centered mt-4 has-text-grey">
                  {_`Nach dem Abschließen können keine Transaktionen mehr für dieses Jahr importiert oder gelöscht werden.`}
                </p>
              </div>

              {closeAction.value?.failed && (
                <div class="notification is-danger">
                  {(closeAction.value as any).message || _`Ein Fehler ist aufgetreten.`}
                </div>
              )}

              <div class="buttons mt-6 is-centered">
                <Link href={`/admin/importSources/${period.value.importSourceId}/edit`} class="button">{_`Abbrechen`}</Link>
                <button
                  type="submit"
                  class={['button', 'is-warning', { 'is-loading': isLoading.value }]}
                >
                  {_`Abschließen`}
                </button>
              </div>
            </>
          )}
        </Form>
      </MainContent>
    </>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Periode abschließen`,
  meta: [],
};
