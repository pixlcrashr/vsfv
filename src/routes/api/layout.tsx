import { component$, Slot } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = async ({
  cookie,
  sharedMap,
  redirect,
  url,
}) => {
  const sessionCookie = cookie.get('authjs.session-token') || cookie.get('__Secure-authjs.session-token');
  if (sessionCookie?.value) {
    const sessionData = sharedMap.get('session');
    if (sessionData && typeof sessionData === 'object' && 'user' in sessionData) {
      const user = (sessionData as any).user;
      if (user?.id) {
        sharedMap.set('userId', user.id);
      } else {
        if (url.pathname !== '/login') {
          throw redirect(302, '/login');
        }
      }
    } else {
      if (url.pathname !== '/login') {
        throw redirect(302, '/login');
      }
    }
  } else {
    if (url.pathname !== '/login') {
      throw redirect(302, '/login');
    }
  }
}

export default component$(() => {
  return <Slot />;
});
