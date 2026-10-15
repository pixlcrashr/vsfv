export interface Budget {
  id: string;
  displayName: string;
  displayDescription: string;
  periodStart: Date;
  periodEnd: Date;
  isClosed: boolean;
  isPublished: boolean;
  publishActualValues: boolean;
  publishActualValuesUntil?: Date | null;
  order: number;
}

export interface BudgetRevision {
  id: string;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetTag {
  id: string;
  name: string;
  date: Date;
  description: string;
  isPublished?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
