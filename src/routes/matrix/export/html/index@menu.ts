import { type RequestHandler } from "@builder.io/qwik-city";
import { generateReportHtml } from "~/lib/reports/generate";
import { requirePermission, Permissions } from "~/lib/auth";
import { Prisma } from "~/lib/prisma";



const SETTING_DEFAULT_REPORT_TEMPLATE_ID = 'default_report_template_id';

export const onRequest: RequestHandler = requirePermission(Permissions.MATRIX_READ);

export const onPost: RequestHandler = async ({ send, request }) => {
  const formData = await request.formData();

  const selectedBudgetIds = formData.getAll("selectedBudgetIds[]").map(String);
  const selectedAccountIds = formData.getAll("selectedAccountIds[]").map(String);

  if (selectedBudgetIds.length === 0 || selectedAccountIds.length === 0) {
    send(new Response("Bad Request: Missing budget or account IDs", {
      status: 400
    }));
    return;
  }

  const setting = await Prisma.settings.findUnique({
    where: { id: SETTING_DEFAULT_REPORT_TEMPLATE_ID }
  });

  if (!setting?.value_uuid) {
    send(new Response("No default report template configured", {
      status: 400
    }));
    return;
  }

  const reportTemplateId = setting.value_uuid;

  const checkboxEnabled = (name: string) => formData.get(name) === "on";

  try {
    const html = await generateReportHtml(
      reportTemplateId,
      selectedBudgetIds,
      selectedAccountIds,
      checkboxEnabled("actualValuesEnabled"),
      checkboxEnabled("targetValuesEnabled"),
      checkboxEnabled("differenceValuesEnabled"),
      checkboxEnabled("accountDescriptionsEnabled"),
      checkboxEnabled("budgetDescriptionsEnabled")
    );

    const headers = new Headers();
    headers.append("Content-Type", "text/html; charset=utf-8");

    send(new Response(html, {
      status: 200,
      headers
    }));
  } catch (e) {
    console.error("Error generating matrix export:", e);
    send(new Response("Internal Server Error", {
      status: 500
    }));
  }
};
