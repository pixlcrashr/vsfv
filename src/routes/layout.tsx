import { component$, Slot } from "@builder.io/qwik";
import { RequestHandler } from "@builder.io/qwik-city";
import { guessLocale } from "compiled-i18n";

export const onRequest: RequestHandler = ({
	query,
	cookie,
	headers,
	locale
}) => {
    if (query.has('locale')) {
      const newLocale = guessLocale(query.get('locale'));
      cookie.delete('locale');
      cookie.set('locale', newLocale, {});
      locale(newLocale);
    } else {
      const maybeLocale = cookie.get('locale')?.value || headers.get('accept-language');
      locale(guessLocale(maybeLocale));
    }
}

export default component$(() => {
  return <Slot />;
});
