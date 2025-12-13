import { component$ } from "@builder.io/qwik";
import { useSignIn, useSession } from "../plugin@auth";
import { useNavigate, DocumentHead } from "@builder.io/qwik-city";
import { _ } from "compiled-i18n";

export default component$(() => {
  const signIn = useSignIn();
  const session = useSession();
  const nav = useNavigate();

  if (session.value?.user) {
    nav("/");
  }

  return (
    <div class="hero is-fullheight">
      <div class="hero-body">
        <div class="container has-text-centered">
          <button
            class="button is-primary is-medium"
            onClick$={async () => {
              await signIn.submit({ providerId: "gitlab", options: { callbackUrl: "/" } });
            }}
          >
            <span class="icon">
              <i class="fab fa-gitlab"></i>
            </span>
            <span>Sign in with GitLab</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Login`,
  meta: [],
};
