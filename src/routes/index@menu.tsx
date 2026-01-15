import { type RequestHandler } from "@builder.io/qwik-city";
import { hasPermission, Permissions } from "~/lib/auth";

export const onRequest: RequestHandler = async ({ redirect, sharedMap }) => {
  const userId = sharedMap.get('userId');

  if (await hasPermission(userId, Permissions.OVERVIEW_READ)) {
    throw redirect(307, "/overview");
  }

  throw redirect(307, "/matrix");
};
