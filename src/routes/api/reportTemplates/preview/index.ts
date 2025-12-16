import { type RequestHandler } from "@builder.io/qwik-city";
import Decimal from "decimal.js";
import { faker } from '@faker-js/faker';
import { Account, Budget, renderReport } from "~/lib/reports/render";
import { requirePermission, Permissions } from "~/lib/auth";

export const onRequest: RequestHandler = requirePermission(Permissions.REPORT_TEMPLATES_READ);



function generateRandomBudget(minRevisions: number, maxRevisions: number): Budget {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    description: faker.company.catchPhrase(),
    periodStart: faker.date.past(),
    periodEnd: faker.date.future(),
    revisions: Array.from({ length: Math.floor(Math.random() * (maxRevisions - minRevisions + 1) + minRevisions) }, () => ({
      id: faker.string.uuid(),
      date: faker.date.past(),
    }))
  }
}

function generateRandomAccount(minChildren: number, maxChildren: number, maxDepth: number = 1, depth: number): Account {
  if (depth >= maxDepth) {
    return {
      id: faker.string.uuid(),
      depth: depth,
      name: faker.company.name(),
      code: faker.string.numeric(4),
      description: faker.company.catchPhrase(),
      children: []
    };
  }

  return {
    id: faker.string.uuid(),
    depth: depth,
    name: faker.company.name(),
    code: faker.string.numeric(4),
    description: faker.company.catchPhrase(),
    children: Array.from({ length: Math.floor(Math.random() * (maxChildren - minChildren + 1) + minChildren) }, () => generateRandomAccount(minChildren, maxChildren, maxDepth, depth + 1))
  };
}

export const onPost: RequestHandler = async ({ send, env, request }) => {
  const budgets = Array.from({ length: 4 }, () => generateRandomBudget(1, 3));
  const accounts = Array.from({ length: 4 }, () => generateRandomAccount(0, 4, 4, 0));

  try {
    const d = await renderReport(
      await request.text(),
      env.get('HTML2PDF_URL')!,
      {
        budgets,
        accounts,
        getTargetValueHandler: (budgetRevisionId: string, accountId: string) => {
          return new Decimal(Math.random() * 10000);
        },
        getDiffValueHandler: (budgetRevisionId: string, accountId: string) => {
          return new Decimal(Math.random() * 10000);
        },
        getActualValueHandler: (budgetRevisionId: string, accountId: string) => {
          return new Decimal(Math.random() * 10000);
        },
        accountDescriptionsEnabled: true,
        budgetDescriptionsEnabled: true,
        actualValuesEnabled: true,
        targetValuesEnabled: true,
        differenceValuesEnabled: true
      }
    );

    const headers = new Headers();
    headers.append('Content-Type', 'application/pdf');

    // Create a new Response object with the blob data and headers
    send(new Response(d, {
      status: 200,
      headers: headers
    }));
  } catch (e) {

    send(new Response('', {
      status: 500
    }));
  }
};
