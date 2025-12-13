import { Adapter, Model, Helper } from 'casbin';
import { Prisma } from '../prisma';

export class PrismaAdapter implements Adapter {
  private filtered = false;

  async loadPolicy(model: Model): Promise<void> {
    const rules = await Prisma.casbin_rule.findMany();

    for (const rule of rules) {
      const line = this.buildPolicyLine(rule);
      Helper.loadPolicyLine(line, model);
    }
  }

  async savePolicy(model: Model): Promise<boolean> {
    await Prisma.casbin_rule.deleteMany();

    const policyRuleAST = model.model.get('p');
    const groupingPolicyAST = model.model.get('g');

    const rules: any[] = [];

    if (policyRuleAST) {
      for (const [ptype, ast] of policyRuleAST) {
        for (const rule of ast.policy) {
          rules.push(this.savePolicyLine(ptype, rule));
        }
      }
    }

    if (groupingPolicyAST) {
      for (const [ptype, ast] of groupingPolicyAST) {
        for (const rule of ast.policy) {
          rules.push(this.savePolicyLine(ptype, rule));
        }
      }
    }

    await Prisma.casbin_rule.createMany({
      data: rules,
    });

    return true;
  }

  async addPolicy(sec: string, ptype: string, rule: string[]): Promise<void> {
    await Prisma.casbin_rule.create({
      data: this.savePolicyLine(ptype, rule),
    });
  }

  async removePolicy(sec: string, ptype: string, rule: string[]): Promise<void> {
    const where = this.buildWhereClause(ptype, rule);
    await Prisma.casbin_rule.deleteMany({ where });
  }

  async removeFilteredPolicy(
    sec: string,
    ptype: string,
    fieldIndex: number,
    ...fieldValues: string[]
  ): Promise<void> {
    const where: any = { ptype };

    if (fieldIndex <= 0 && fieldValues.length > 0) {
      where.v0 = fieldValues[0 - fieldIndex];
    }
    if (fieldIndex <= 1 && fieldValues.length > 1) {
      where.v1 = fieldValues[1 - fieldIndex];
    }
    if (fieldIndex <= 2 && fieldValues.length > 2) {
      where.v2 = fieldValues[2 - fieldIndex];
    }
    if (fieldIndex <= 3 && fieldValues.length > 3) {
      where.v3 = fieldValues[3 - fieldIndex];
    }
    if (fieldIndex <= 4 && fieldValues.length > 4) {
      where.v4 = fieldValues[4 - fieldIndex];
    }
    if (fieldIndex <= 5 && fieldValues.length > 5) {
      where.v5 = fieldValues[5 - fieldIndex];
    }

    await Prisma.casbin_rule.deleteMany({ where });
  }

  private buildPolicyLine(rule: any): string {
    const values = [rule.v0, rule.v1, rule.v2, rule.v3, rule.v4, rule.v5]
      .filter((v) => v !== null && v !== undefined)
      .join(', ');
    return `${rule.ptype}, ${values}`;
  }

  private savePolicyLine(ptype: string, rule: string[]): any {
    const line: any = { ptype };
    if (rule.length > 0) line.v0 = rule[0];
    if (rule.length > 1) line.v1 = rule[1];
    if (rule.length > 2) line.v2 = rule[2];
    if (rule.length > 3) line.v3 = rule[3];
    if (rule.length > 4) line.v4 = rule[4];
    if (rule.length > 5) line.v5 = rule[5];
    return line;
  }

  private buildWhereClause(ptype: string, rule: string[]): any {
    const where: any = { ptype };
    if (rule.length > 0) where.v0 = rule[0];
    if (rule.length > 1) where.v1 = rule[1];
    if (rule.length > 2) where.v2 = rule[2];
    if (rule.length > 3) where.v3 = rule[3];
    if (rule.length > 4) where.v4 = rule[4];
    if (rule.length > 5) where.v5 = rule[5];
    return where;
  }

  isFiltered(): boolean {
    return this.filtered;
  }
}
