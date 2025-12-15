import { component$ } from "@builder.io/qwik";
import { DocumentHead, Form, Link, routeAction$, useNavigate, z, zod$, type RequestHandler } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderButtons from "~/components/layout/HeaderButtons";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { Prisma } from "~/lib/prisma";
import { requirePermission, withPermission, Permissions } from "~/lib/auth";
import { _ } from "compiled-i18n";

export const onRequest: RequestHandler = requirePermission(Permissions.GROUPS_CREATE);

export const CreateGroupSchema = {
  id: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, 'Nur Buchstaben, Zahlen, - und _ erlaubt'),
  name: z.string().min(1),
  description: z.string().optional()
};

export const useCreateGroupAction = routeAction$(async (values, { sharedMap, fail }) => {
  const auth = await withPermission(sharedMap, fail, Permissions.GROUPS_CREATE);
  if (!auth.authorized) {
    return auth.result;
  }

  const existing = await Prisma.user_groups.findUnique({
    where: {
      id: values.id
    }
  });

  if (existing) {
    return fail(400, { message: 'Eine Gruppe mit dieser ID existiert bereits' });
  }

  // Create the group in the user_groups table
  await Prisma.user_groups.create({
    data: {
      id: values.id,
      name: values.name,
      description: values.description || ''
    }
  });

  return {
    success: true,
    groupId: values.id
  };
}, zod$(CreateGroupSchema));

export default component$(() => {
  const createAction = useCreateGroupAction();
  const nav = useNavigate();

  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li><Link href="/admin/settings">{_`Einstellungen`}</Link></li>
              <li><Link href="/admin/groups">{_`Gruppen`}</Link></li>
              <li class="is-active"><Link href="#" aria-current="page">{_`Neue Gruppe`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
        <HeaderButtons>
          <Link href="/admin/groups" class="button">
            <span class="icon is-small">
              <i class="fas fa-arrow-left"></i>
            </span>
            <span>{_`Zurück`}</span>
          </Link>
        </HeaderButtons>
      </Header>

      <div>
        <h2 class="title is-4">{_`Neue Gruppe erstellen`}</h2>
        <p class="subtitle is-6 mb-5">
          {_`Erstellen Sie eine neue Gruppe, um Berechtigungen zu organisieren. Nach dem Erstellen können Sie der Gruppe Berechtigungen zuweisen.`}
        </p>

        <Form action={createAction} onSubmitCompleted$={async () => {
          if (createAction.value?.success) {
            await nav(`/admin/groups/${encodeURIComponent(createAction.value.groupId)}/edit`);
          }
        }}>
          <div class="field">
            <label class="label">{_`Gruppen-ID`}</label>
            <div class="control">
              <input
                type="text"
                name="id"
                class="input"
                placeholder={_`z.B. editors`}
                required
              />
            </div>
            <p class="help">{_`Eindeutige ID für die Gruppe. Nur Buchstaben, Zahlen, Bindestriche und Unterstriche erlaubt`}</p>
          </div>

          <div class="field">
            <label class="label">{_`Gruppenname`}</label>
            <div class="control">
              <input
                type="text"
                name="name"
                class="input"
                placeholder={_`z.B. Redakteure`}
                required
              />
            </div>
            <p class="help">{_`Anzeigename der Gruppe (kann Duplikate enthalten)`}</p>
          </div>

          <div class="field">
            <label class="label">{_`Beschreibung`}</label>
            <div class="control">
              <textarea
                name="description"
                class="textarea"
                placeholder={_`Optionale Beschreibung der Gruppe`}
                rows={3}
              />
            </div>
          </div>

          {createAction.value?.failed && (
            <div class="notification is-danger mt-4">
              {createAction.value.message || _`Fehler beim Erstellen der Gruppe`}
            </div>
          )}

          <div class="field is-grouped mt-5">
            <div class="control">
              <button type="submit" class="button is-primary">
                <span class="icon is-small">
                  <i class="fas fa-plus"></i>
                </span>
                <span>{_`Gruppe erstellen`}</span>
              </button>
            </div>
          </div>
        </Form>
      </div>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Gruppe erstellen`,
  meta: [],
};
