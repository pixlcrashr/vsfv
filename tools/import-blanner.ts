#!/usr/bin/env ts-node

/**
 * Migration tool to import data from the old blanner.json format
 * into the new database schema using Prisma.
 *
 * Usage: npx ts-node tools/import-blanner.ts <path-to-blanner.json>
 *
 * Example: npx ts-node tools/import-blanner.ts test/haushaltsplan.blanner.json
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient, Prisma } from '../src/lib/prisma/generated/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx ts-node tools/import-blanner.ts <path-to-blanner.json>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading file: ${filePath}`);
  const rawData = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(rawData);

  console.log(`Importing data from blanner format version: ${data.$version || 'unknown'}`);
  console.log(`  - Accounts: ${data.accounts?.length || 0}`);
  console.log(`  - Account Groups: ${data.accountGroups?.length || 0}`);
  console.log(`  - Budgets: ${data.budgets?.length || 0}`);
  console.log(`  - Account Budget Values: ${data.accountBudgetValues?.length || 0}`);

  await importData(data);

  console.log('\nImport completed successfully!');
}

type BlannerAccount = {
  id: string;
  name: string;
  description?: string;
  isVisible: boolean;
  code?: string;
  parentId?: string | null;
  createdAt?: string;
};

type BlannerAccountGroup = {
  id: string;
  name: string;
  description?: string;
  isVisible: boolean;
  additionAccountIds: string[];
  substractionAccountIds: string[];
  createdAt?: string;
};

type BlannerBudgetRevision = {
  id: string;
  budgetId: string;
  name?: string;
  description?: string;
  isVisible: boolean;
  date?: string;
  createdAt?: string;
};

type BlannerBudget = {
  id: string;
  name: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  isVisible: boolean;
  showTarget?: boolean;
  showActual?: boolean;
  showDifference?: boolean;
  isClosed?: boolean;
  createdAt?: string;
  revisions: BlannerBudgetRevision[];
};

type BlannerAccountBudgetValue = {
  accountId: string;
  budgetId: string;
  revision: number;
  value: string;
};

type BlannerData = {
  $version: string;
  currency: string;
  accounts: BlannerAccount[];
  accountGroups: BlannerAccountGroup[];
  budgets: BlannerBudget[];
  accountBudgetValues: BlannerAccountBudgetValue[];
};

async function importData(data: BlannerData) {
  await prisma.$transaction(
    async (tx) => {
      await importAccounts(tx, data.accounts || []);
      await importAccountGroups(tx, data.accountGroups || []);
      await importBudgets(tx, data.budgets || []);
      await importAccountBudgetValues(tx, data.budgets || [], data.accountBudgetValues || []);
    },
    {
      timeout: 60000,
    },
  );
}

async function importAccounts(tx: Prisma.TransactionClient, accounts: BlannerAccount[]) {
  if (accounts.length === 0) return;
  console.log('\nImporting accounts...');
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const sortedAccounts = topologicalSortAccounts(accounts, accountMap);
  let created = 0;
  let skipped = 0;
  for (const account of sortedAccounts) {
    try {
      const existing = await tx.accounts.findUnique({ where: { id: account.id } });
      if (existing) { skipped++; continue; }
      await tx.accounts.create({
        data: {
          id: account.id,
          display_name: account.name || '',
          display_code: account.code || '',
          display_description: account.description || '',
          parent_account_id: account.parentId || null,
          is_archived: !account.isVisible,
          created_at: account.createdAt ? new Date(account.createdAt) : new Date(),
          updated_at: new Date(),
        },
      });
      created++;
    } catch (error: any) {
      console.error(`  Error importing account ${account.id} (${account.name}):`, error.message);
    }
  }
  console.log(`  Created: ${created}, Skipped (existing): ${skipped}`);
}

function topologicalSortAccounts(accounts: BlannerAccount[], accountMap: Map<string, BlannerAccount>): BlannerAccount[] {
  const sorted: BlannerAccount[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(account: BlannerAccount) {
    if (visited.has(account.id)) return;
    if (visiting.has(account.id)) throw new Error(`Circular dependency detected for account ${account.id}`);
    visiting.add(account.id);
    if (account.parentId && accountMap.has(account.parentId)) visit(accountMap.get(account.parentId)!);
    visiting.delete(account.id);
    visited.add(account.id);
    sorted.push(account);
  }
  for (const account of accounts) visit(account);
  return sorted;
}

async function importAccountGroups(tx: Prisma.TransactionClient, accountGroups: BlannerAccountGroup[]) {
  if (accountGroups.length === 0) return;
  console.log('\nImporting account groups...');
  let created = 0;
  let skipped = 0;
  for (const group of accountGroups) {
    try {
      const existing = await tx.account_groups.findUnique({ where: { id: group.id } });
      if (existing) { skipped++; continue; }
      await tx.account_groups.create({
        data: {
          id: group.id,
          display_name: group.name || '',
          display_description: group.description || '',
          created_at: group.createdAt ? new Date(group.createdAt) : new Date(),
          updated_at: new Date(),
        },
      });
      for (const accountId of group.additionAccountIds || []) {
        try {
          await tx.account_group_assignments.create({
            data: {
              account_group_id: group.id,
              account_id: accountId,
              negate: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });
        } catch (error: any) {
          console.error(`  Error creating assignment for account ${accountId}:`, error.message);
        }
      }
      for (const accountId of group.substractionAccountIds || []) {
        try {
          await tx.account_group_assignments.create({
            data: {
              account_group_id: group.id,
              account_id: accountId,
              negate: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          });
        } catch (error: any) {
          console.error(`  Error creating assignment for account ${accountId}:`, error.message);
        }
      }
      created++;
    } catch (error: any) {
      console.error(`  Error importing account group ${group.id} (${group.name}):`, error.message);
    }
  }
  console.log(`  Created: ${created}, Skipped (existing): ${skipped}`);
}

async function importBudgets(tx: Prisma.TransactionClient, budgets: BlannerBudget[]) {
  if (budgets.length === 0) return;
  console.log('\nImporting budgets...');
  let budgetsCreated = 0;
  let budgetsSkipped = 0;
  let revisionsCreated = 0;
  for (const budget of budgets) {
    try {
      const existing = await tx.budgets.findUnique({ where: { id: budget.id } });
      if (existing) { budgetsSkipped++; continue; }
      await tx.budgets.create({
        data: {
          id: budget.id,
          display_name: budget.name || '',
          display_description: budget.description || '',
          is_closed: budget.isClosed || false,
          period_start: budget.periodStart ? new Date(budget.periodStart) : new Date(),
          period_end: budget.periodEnd ? new Date(budget.periodEnd) : new Date(),
          created_at: budget.createdAt ? new Date(budget.createdAt) : new Date(),
          updated_at: new Date(),
        },
      });
      budgetsCreated++;
      for (const revision of budget.revisions || []) {
        try {
          await tx.budget_revisions.create({
            data: {
              id: revision.id,
              budget_id: budget.id,
              display_description: revision.description || revision.name || '',
              date: revision.date ? new Date(revision.date) : new Date(),
              created_at: revision.createdAt ? new Date(revision.createdAt) : new Date(),
              updated_at: new Date(),
            },
          });
          revisionsCreated++;
        } catch (error: any) {
          console.error(`  Error importing revision ${revision.id}:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`  Error importing budget ${budget.id} (${budget.name}):`, error.message);
    }
  }
  console.log(`  Budgets created: ${budgetsCreated}, Skipped (existing): ${budgetsSkipped}`);
  console.log(`  Revisions created: ${revisionsCreated}`);
}

async function importAccountBudgetValues(tx: Prisma.TransactionClient, budgets: BlannerBudget[], accountBudgetValues: BlannerAccountBudgetValue[]) {
  if (accountBudgetValues.length === 0) return;
  console.log('\nImporting account budget values (target values)...');
  const revisionMap = new Map<string, Map<number, string>>();
  for (const budget of budgets) {
    const revisions = budget.revisions || [];
    const revisionIndexMap = new Map<number, string>();
    for (let i = 0; i < revisions.length; i++) {
      revisionIndexMap.set(i, revisions[i].id);
    }
    revisionMap.set(budget.id, revisionIndexMap);
  }
  let created = 0;
  let skipped = 0;
  let errors = 0;
  for (const value of accountBudgetValues) {
    try {
      const budgetRevisions = revisionMap.get(value.budgetId);
      if (!budgetRevisions) { errors++; continue; }
      const revisionId = budgetRevisions.get(value.revision);
      if (!revisionId) { errors++; continue; }
      const existing = await tx.budget_revision_account_values.findFirst({
        where: {
          budget_revision_id: revisionId,
          account_id: value.accountId,
        },
      });
      if (existing) { skipped++; continue; }
      await tx.budget_revision_account_values.create({
        data: {
          budget_revision_id: revisionId,
          account_id: value.accountId,
          value: parseFloat(value.value) || 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      created++;
    } catch (error: any) {
      errors++;
    }
  }
  console.log(`  Created: ${created}, Skipped (existing): ${skipped}, Errors: ${errors}`);
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
