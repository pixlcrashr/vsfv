import Decimal from "decimal.js";
import { formatCurrency } from "../format";
import { createHtm2PdfClient } from "../html2pdf";
import Handlebars from "handlebars";
import { writeFile } from "node:fs";
import path from "node:path";



export interface BudgetRevision {
  id: string;
  date: Date;
}

export interface Budget {
  id: string;
  name: string;
  description: string;
  periodStart: Date;
  periodEnd: Date;
  revisions: BudgetRevision[];
}

export interface Account {
  id: string;
  depth: number;
  name: string;
  code: string;
  description: string;
  children: Account[];
}

export interface RenderReportParams {
  accounts?: Account[];
  budgets?: Budget[];
  getTargetValueHandler?: (budgetRevisionId: string, accountId: string) => Decimal;
  getDiffValueHandler?: (budgetRevisionId: string, accountId: string) => Decimal;
  getActualValueHandler?: (budgetId: string, accountId: string) => Decimal;
  actualValuesEnabled?: boolean,
  targetValuesEnabled?: boolean,
  differenceValuesEnabled?: boolean,
  accountDescriptionsEnabled?: boolean,
  budgetDescriptionsEnabled?: boolean
}

function calcMaxDepth(accounts: Account[]): number {
  let maxDepth = 0;

  const dfs = (account: Account) => {
    if (account.depth > maxDepth) {
      maxDepth = account.depth;
    }

    for (const child of account.children ?? []) {
      dfs(child);
    }
  };

  for (const account of accounts) {
    dfs(account);
  }

  return maxDepth;
}

export async function renderReport(
  template: string,
  html2PdfUrl: string,
  params?: RenderReportParams
): Promise<Blob> {
  const c = createHtm2PdfClient(html2PdfUrl);

  Handlebars.registerHelper('formatCurrency', formatCurrency);
  Handlebars.registerHelper('getTargetValue', function (budgetRevisionId: string, accountId: string): string {
    return (params?.getTargetValueHandler?.(budgetRevisionId, accountId) ?? new Decimal(0)).toFixed(2);
  });
  Handlebars.registerHelper('getDiffValue', function (budgetRevisionId: string, accountId: string): string {
    return (params?.getDiffValueHandler?.(budgetRevisionId, accountId) ?? new Decimal(0)).toFixed(2);
  });
  Handlebars.registerHelper('getActualValue', function (budgetRevisionId: string, accountId: string): string {
    return (params?.getActualValueHandler?.(budgetRevisionId, accountId) ?? new Decimal(0)).toFixed(2);
  });
  Handlebars.registerHelper('subtract', function (a: any, b: any) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      // Optional: fail loudly or just return empty string
      // throw new Error(`subtract helper received non-numeric args: ${a}, ${b}`);
      return '';
    }
    return na - nb;
  });
  Handlebars.registerHelper('times', function (n: any, block: Handlebars.HelperOptions) {
    const count = Number(n);
    if (!Number.isFinite(count) || count <= 0) {
      return '';
    }

    let result = '';
    for (let i = 0; i < count; i++) {
      result += block.fn(i);
    }
    return result;
  });
  Handlebars.registerHelper('add', function (a: any, b: any) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      // Optional: throw or just return empty string
      // throw new Error(`add helper received non-numeric args: ${a}, ${b}`);
      return '';
    }
    return na + nb;
  });

  let html = template;

  const compiledTemplate = Handlebars.compile(html);
  try {
    html = compiledTemplate({
      options: {
        actualValuesEnabled: params?.actualValuesEnabled ?? false,
        targetValuesEnabled: params?.targetValuesEnabled ?? false,
        differenceValuesEnabled: params?.differenceValuesEnabled ?? false,
        accountDescriptionsEnabled: params?.accountDescriptionsEnabled ?? false,
        budgetDescriptionsEnabled: params?.budgetDescriptionsEnabled ?? false
      },
      maxAccountDepth: calcMaxDepth(params?.accounts ?? []),
      budgets: params?.budgets ?? [],
      accounts: params?.accounts ?? []
    });

    const fp = path.resolve('./report.html');
    console.log(fp);

    writeFile(fp, html, (err) => {
      if (err) {
        console.error(err);
      }
    });

    const d = await c.POST('/render', {
      body: html,
      parseAs: "blob",
      bodySerializer: (body) => body
    });

    if (!d.data) {
      throw new Error('failed to request rendered template');
    }

    return d.data;
  } catch (e) {
    // TODO: handle errors
    console.error(e);
    throw new Error('failed to render template', {cause: e});
  }
}
