import { type RequestHandler } from "@builder.io/qwik-city";
import { hasPermission, Permissions } from "~/lib/auth";

export const onRequest: RequestHandler = async ({ redirect, sharedMap }) => {
  const userId = sharedMap.get('userId');

  if (await hasPermission(userId, Permissions.DASHBOARD_READ)) {
    throw redirect(307, "/dashboard");
  }

  throw redirect(307, "/matrix");
};
