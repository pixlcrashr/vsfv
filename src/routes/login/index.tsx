import { component$ } from "@builder.io/qwik";
import { useSignIn, useSession } from "../plugin@auth";
import { useNavigate, DocumentHead, RequestHandler, Form } from "@builder.io/qwik-city";
import { _ } from "compiled-i18n";



export const onRequest: RequestHandler = ({ sharedMap, redirect }) => {
  const userId = sharedMap.get('userId') as string | undefined;
  
  if (userId) {
    throw redirect(302, '/overview');
  }
}

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
          <Form action={signIn}>
            <input type="hidden" name="providerId" value="gitlab" />
            <input type="hidden" name="options.redirectTo" value="/" />
            <button type="submit" class="button is-primary is-medium">
              <span class="icon">
                <i class="fab fa-gitlab"></i>
              </span>
              <span>{_`Mit GitLab anmelden`}</span>
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: _`VSFV | Login`,
  meta: [],
};
