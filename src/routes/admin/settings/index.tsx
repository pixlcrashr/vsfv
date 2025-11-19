import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import Header from "~/components/layout/Header";
import HeaderTitle from "~/components/layout/HeaderTitle";
import MainContent from "~/components/layout/MainContent";

export default component$(() => {
  return (
    <MainContent>
      <Header>
        <HeaderTitle>
          <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
              <li class="is-active"><Link href="#" aria-current="page">Einstellungen</Link></li>
            </ul>
          </nav>
        </HeaderTitle>
      </Header>

      <p>test</p>
    </MainContent>
  );
})
