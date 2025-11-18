
/*export class BudgetNewService implements Service {
  public constructor(
    private readonly _prismaClient: PrismaClient
  ) {
  }

  async createBudget(name: string, description: string, startDate: Date, endDate: Date): Promise<void> {
    await this._prismaClient.budgets.create({
      data: {
        display_name: name,
        display_description: description,
        period_start: startDate,
        period_end: endDate,
        budget_revisions: {
          create: {
            date: startDate,
          }
        }
      },
    });
  }
}*/
