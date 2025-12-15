import { component$, Slot } from "@builder.io/qwik";
import MainLayout from "~/components/layout/MainLayout";
import { guessLocale } from 'compiled-i18n';
import { RequestHandler, routeLoader$ } from "@builder.io/qwik-city";
import { getAccessibleMenuItems, menuItems, menuItemsAdmin } from "~/lib/auth";

export const onRequest: RequestHandler = async ({
	query,
	cookie,
	headers,
	locale,
	sharedMap,
	redirect,
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

	const sessionCookie = cookie.get('authjs.session-token') || cookie.get('__Secure-authjs.session-token');
	if (sessionCookie?.value) {
		const sessionData = sharedMap.get('session');
		if (sessionData && typeof sessionData === 'object' && 'user' in sessionData) {
			const user = (sessionData as any).user;
			if (user?.id) {
				sharedMap.set('userId', user.id);
			} else {
				throw redirect(302, '/login');
			}
		} else {
			throw redirect(302, '/login');
		}
	} else {
		throw redirect(302, '/login');
	}
}

export const useAccessibleMenuItems = routeLoader$(async ({ sharedMap }) => {
	const userId = sharedMap.get('userId') as string | undefined;
	
	if (!userId) {
		return {
			mainMenuItems: [],
			adminMenuItems: []
		};
	}
	
	const [mainMenuItems, adminMenuItems] = await Promise.all([
		getAccessibleMenuItems(userId, menuItems),
		getAccessibleMenuItems(userId, menuItemsAdmin)
	]);
	
	return {
		mainMenuItems,
		adminMenuItems
	};
});

export default component$(() => {
	const accessibleMenuItems = useAccessibleMenuItems();
  return (
    <>
      <MainLayout 
        mainMenuItems={accessibleMenuItems.value.mainMenuItems}
        adminMenuItems={accessibleMenuItems.value.adminMenuItems}
      >
        <Slot />
      </MainLayout>
    </>
  );
});
