import { component$, Slot } from "@builder.io/qwik";
import { RequestHandler } from "@builder.io/qwik-city";
import { requirePermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.ACCOUNT_GROUPS_READ);

export default component$(() => {
  return <Slot />;
});
