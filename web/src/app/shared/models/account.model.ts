export interface Account {
  id: string;
  name: string;
  code: string;
  fullCode: string;
  displayFullCode?: string;
  displayFullName?: string;
  description: string;
  isArchived: boolean;
  isContainer?: boolean;
  /** When true (own flag or inherited from an ancestor), actual values are reported with a reversed sign. */
  invertSign?: boolean;
  parentAccountId: string | null;
}

export interface HierarchicalAccount extends Account {
  depth: number;
  children: HierarchicalAccount[];
}
