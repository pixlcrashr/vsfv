import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import MainContentContainer from "./MainContentContainer";
import styles from "./MainLayout.scss?inline";

const menuItems = [
  {
    name: 'Haushaltsmatrix',
    path: '/matrix'
  },
  {
    name: 'Haushaltspläne',
    path: '/budgets'
  },
  {
    name: 'Haushaltskonten',
    path: '/accounts'
  },
  {
    name: 'Journal',
    path: '/journal'
  },
  {
    name: 'Berichte',
    path: '/reports'
  },
  {
    name: 'Berichtsvorlagen',
    path: '/reportTemplates'
  }
];

const menuItemsAdmin = [
  {
    name: 'Importquellen',
    path: '/admin/importSources'
  }
];

export default component$(() => {
  useStylesScoped$(styles);
  const location = useLocation();

  return (
    <div class="columns">
      <div class="nav-menu column">
        <div class="menu-logo">
          <img
            height="28"
            width="28"
            src="/assets/logo.svg"
            alt="Bulma logo"
          />
          <h1>AStA TUHH</h1>
        </div>

        <aside class="menu p-4">
          <ul class="menu-list">
            {menuItems.map(({ name, path }) => <li key={name}>
              <Link class={["menu-list-link", { 'is-active': location.url.pathname.startsWith(path) }]} href={path} prefetch="js">{name}</Link>
            </li>)}
          </ul>
          <p class="menu-label">Administration</p>
          <ul class="menu-list">
            {menuItemsAdmin.map(({ name, path }) => <li key={name}>
              <Link class={["menu-list-link", { 'is-active': location.url.pathname.startsWith(path) }]} href={path} prefetch="js">{name}</Link>
            </li>)}
          </ul>
        </aside>

        <footer class="nav-menu-footer">
          <p>Copyright © 2025 Vincent Heins<br/><a href="https://github.com/pixlcrashr/vs-finanzverwaltung" target="_blank">github.com/pixlcrashr/vs-finanzverwaltung</a></p>
        </footer>
      </div>
      <MainContentContainer>
        <Slot />
      </MainContentContainer>
    </div>
  );
});
