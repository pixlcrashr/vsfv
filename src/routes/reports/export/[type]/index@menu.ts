import { type RequestHandler } from "@builder.io/qwik-city";
import { generateReportPdf, generateReportHtml } from "~/lib/reports/generate";
import { requirePermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.REPORTS_READ);

export const onPost: RequestHandler = async ({ send, env, request, params }) => {
  const exportType = params.type;

  if (exportType !== 'html' && exportType !== 'pdf') {
    send(new Response("Bad Request: Invalid export type. Must be 'html' or 'pdf'.", {
      status: 400
    }));
    return;
  }

  const formData = await request.formData();

  const reportTemplateId = formData.get("reportTemplateId");
  const selectedBudgetIds = formData.getAll("selectedBudgetIds[]").map(String);
  const selectedAccountIds = formData.getAll("selectedAccountIds[]").map(String);

  if (!reportTemplateId || selectedBudgetIds.length === 0 || selectedAccountIds.length === 0) {
    send(new Response("Bad Request", {
      status: 400
    }));
    return;
  }

  const checkboxEnabled = (name: string) => formData.get(name) === "on";

  try {
    switch (exportType) {
      case 'html': {
        const html = await generateReportHtml(
          String(reportTemplateId),
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
        return;
      }
      case 'pdf': {
        const pdf = await generateReportPdf(
          env.get("HTML2PDF_URL") ?? "",
          String(reportTemplateId),
          selectedBudgetIds,
          selectedAccountIds,
          checkboxEnabled("actualValuesEnabled"),
          checkboxEnabled("targetValuesEnabled"),
          checkboxEnabled("differenceValuesEnabled"),
          checkboxEnabled("accountDescriptionsEnabled"),
          checkboxEnabled("budgetDescriptionsEnabled")
        );

        const headers = new Headers();
        headers.append("Content-Type", "application/pdf");

        send(new Response(pdf, {
          status: 200,
          headers
        }));
        return;
      }
    }
  } catch (e) {
    console.error("Error generating report:", e);
    send(new Response("Internal Server Error", {
      status: 500
    }));
  }
};
