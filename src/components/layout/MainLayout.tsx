import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { _ } from 'compiled-i18n';
import MainContentContainer from "./MainContentContainer";
import styles from "./MainLayout.scss?inline";
import { useSession, useSignOut } from "~/routes/plugin@auth";
import type { MenuItem } from "~/lib/auth";
import { useNameLoader } from "~/routes/layout-menu";

interface MainLayoutProps {
  mainMenuItems: MenuItem[];
  adminMenuItems: MenuItem[];
}

export default component$<MainLayoutProps>(({ mainMenuItems, adminMenuItems }) => {
  useStylesScoped$(styles);
  const location = useLocation();
  const session = useSession();
  const signOut = useSignOut();
  const name = useNameLoader();

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
          <h1>{name.value}</h1>
        </div>

        <aside class="menu p-4">
          {mainMenuItems.length > 0 && (
            <ul class="menu-list">
              {mainMenuItems.map(({ name, path }) => <li key={name}>
                <Link class={["menu-list-link", { 'is-active': location.url.pathname.startsWith(path) }]} href={path} prefetch="js">{name}</Link>
              </li>)}
            </ul>
          )}
          {adminMenuItems.length > 0 && (
            <>
              <p class="menu-label">{_`Administration`}</p>
              <ul class="menu-list">
                {adminMenuItems.map(({ name, path }) => <li key={name}>
                  <Link class={["menu-list-link", { 'is-active': location.url.pathname.startsWith(path) }]} href={path} prefetch="js">{name}</Link>
                </li>)}
              </ul>
            </>
          )}
        </aside>

        <footer class="nav-menu-footer">
          {session.value?.user && (
            <div class="pb-4">
              <div class="media is-align-items-center">
                <div class="media-left">
                  {session.value.user.image && (
                    <figure class="image is-32x32">
                      <img class="is-rounded" src={session.value.user.image} alt={session.value.user.name || 'User'} />
                    </figure>
                  )}
                </div>
                <div class="media-content has-text-left">
                  <p class="is-size-7 has-text-weight-semibold">{session.value.user.name}</p>
                  <p class="is-size-7 has-text-grey">{session.value.user.email}</p>
                </div>
                <div class="media-right">
                  <button 
                    class="button is-small is-light" 
                    onClick$={async () => {
                      await signOut.submit({ redirectTo: '/login' });
                    }}
                    title={_`Abmelden`}
                  >
                    <span class="icon">
                      <i class="fas fa-sign-out-alt"></i>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
          <p>Copyright © 2025 Vincent Heins, Version {import.meta.env.PUBLIC_VERSION ?? "0.0.0"}<br/><a href="https://github.com/pixlcrashr/vs-finanzverwaltung" target="_blank">github.com/pixlcrashr/vs-finanzverwaltung</a></p>
        </footer>
      </div>
      <MainContentContainer>
        <Slot />
      </MainContentContainer>
    </div>
  );
});
