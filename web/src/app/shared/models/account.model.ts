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
  parentAccountId: string | null;
}

export interface HierarchicalAccount extends Account {
  depth: number;
  children: HierarchicalAccount[];
}
