import { component$, Slot } from "@builder.io/qwik";
import { RequestHandler } from "@builder.io/qwik-city";
import { requirePermission } from "~/lib/auth";

export const onRequest: RequestHandler = requirePermission('accountGroups', 'read');

export default component$(() => {
  return <Slot />;
});
