import { component$ } from "@builder.io/qwik";
import { DocumentHead, Link, type RequestHandler } from "@builder.io/qwik-city";
import { _ } from "compiled-i18n";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";
import { requirePermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.SETTINGS_READ);

export default component$(() => {
  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li class="is-active"><Link href="#" aria-current="page">{_`Einstellungen`}</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>
    </MainContent>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Einstellungen`,
  meta: [],
};
