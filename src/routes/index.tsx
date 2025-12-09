import { component$ } from "@builder.io/qwik";
import type { DocumentHead, RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = ({ redirect }) => {
  throw redirect(307, "/matrix");
}
