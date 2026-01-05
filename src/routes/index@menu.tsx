import { routeLoader$, type RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler[] = [
  ({ redirect }) => {
    throw redirect(307, "/overview");
  }
];
