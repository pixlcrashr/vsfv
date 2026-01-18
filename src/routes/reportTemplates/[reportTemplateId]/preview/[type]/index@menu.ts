import { type RequestHandler } from "@builder.io/qwik-city";
import { Decimal } from "decimal.js";
import { faker } from '@faker-js/faker';
import { renderReport, renderReportHtml, Account, Budget } from "~/lib/reports/render";
import { requirePermission, Permissions } from "~/lib/auth";



export const onRequest: RequestHandler = requirePermission(Permissions.REPORT_TEMPLATES_READ);

function generateRandomBudget(minRevisions: number, maxRevisions: number): Budget {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    description: faker.company.catchPhrase(),
    periodStart: faker.date.past(),
    periodEnd: faker.date.future(),
    revisions: Array.from({ length: Math.floor(Math.random() * (maxRevisions - minRevisions + 1) + minRevisions) }, (_, i) => ({
      id: faker.string.uuid(),
      name: `Rev. ${i + 1}`,
      description: faker.commerce.productDescription(),
      date: faker.date.past(),
    }))
  };
}

function generateRandomAccount(minChildren: number, maxChildren: number, maxDepth: number = 1, depth: number): Account {
  if (depth >= maxDepth) {
    return {
      id: faker.string.uuid(),
      depth: depth,
      isLeaf: true,
      name: faker.company.name(),
      code: faker.string.numeric(4),
      description: faker.company.catchPhrase(),
      children: []
    };
  }

  const cs = Array.from({ length: Math.floor(Math.random() * (maxChildren - minChildren + 1) + minChildren) }, () => generateRandomAccount(minChildren, maxChildren, maxDepth, depth + 1));

  return {
    id: faker.string.uuid(),
    isLeaf: false,
    depth: depth,
    name: faker.company.name(),
    code: faker.string.numeric(4),
    description: faker.company.catchPhrase(),
    children: cs,
  };
}

export const onPost: RequestHandler = async ({ send, env, request, params }) => {
  const exportType = params.type;

  if (exportType !== 'html' && exportType !== 'pdf') {
    send(new Response("Bad Request: Invalid export type. Must be 'html' or 'pdf'.", {
      status: 400
    }));
    return;
  }

  const budgets = Array.from({ length: 2 }, () => generateRandomBudget(1, 3));
  const accounts = Array.from({ length: 2 }, () => generateRandomAccount(0, 4, 4, 0));

  const renderParams = {
    budgets,
    accounts,
    getTargetValueHandler: () => {
      return new Decimal(Math.random() * 10000);
    },
    getDiffValueHandler: () => {
      return new Decimal(Math.random() * 10000);
    },
    getActualValueHandler: () => {
      return new Decimal(Math.random() * 10000);
    },
    accountDescriptionsEnabled: true,
    budgetDescriptionsEnabled: true,
    actualValuesEnabled: true,
    targetValuesEnabled: true,
    differenceValuesEnabled: true
  };

  const template = await request.text();

  try {
    switch (exportType) {
      case 'html': {
        const html = renderReportHtml(template, renderParams);

        const headers = new Headers();
        headers.append('Content-Type', 'text/html; charset=utf-8');

        send(new Response(html, {
          status: 200,
          headers
        }));
        return;
      }
      case 'pdf': {
        const pdf = await renderReport(template, env.get('HTML2PDF_URL')!, renderParams);

        const headers = new Headers();
        headers.append('Content-Type', 'application/pdf');

        send(new Response(pdf, {
          status: 200,
          headers
        }));
        return;
      }
    }
  } catch (e) {
    console.error("Error generating preview:", e);
    send(new Response('Internal Server Error', {
      status: 500
    }));
  }
};
