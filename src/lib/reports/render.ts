import { Decimal } from "decimal.js";
import { formatCurrency, formatDateShort } from "../format";
import { createHtm2PdfClient } from "../html2pdf";
import Handlebars from "handlebars";



export interface BudgetRevision {
  id: string;
  name: string;
  description: string;
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
  isLeaf: boolean;
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

function buildReportHtml(
  template: string,
  params?: RenderReportParams
): string {
  Handlebars.registerHelper('formatCurrency', formatCurrency);
  Handlebars.registerHelper('formatDateShort', formatDateShort);
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
  Handlebars.registerHelper('countTrue', function (...bs: any[]) {
    bs.pop();
    return bs.filter(v => !!v).length;
  });
  Handlebars.registerHelper('add', function (a: any, b: any) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      return '';
    }
    return na + nb;
  });
  Handlebars.registerHelper('budgetColspan', function (revisionsLength: any): number {
    const revs = Number(revisionsLength) || 0;

    let perRevision = 0;
    if (params?.targetValuesEnabled) {
      perRevision++;
    }
    if (params?.actualValuesEnabled) {
      perRevision++;
    }
    if (params?.differenceValuesEnabled) {
      perRevision++;
    }

    if (perRevision === 0) {
      return revs;
    }

    return revs * perRevision;
  });

  let html = template;

  const compiledTemplate = Handlebars.compile(html);
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

  return html;
}

export function renderReportHtml(
  template: string,
  params?: RenderReportParams
): string {
  return buildReportHtml(template, params);
}

export async function renderReport(
  template: string,
  html2PdfUrl: string,
  params?: RenderReportParams
): Promise<Blob> {
  const c = createHtm2PdfClient(html2PdfUrl);

  try {
    const html = buildReportHtml(template, params);

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
