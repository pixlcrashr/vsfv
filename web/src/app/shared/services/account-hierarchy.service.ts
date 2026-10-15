import { Injectable } from '@angular/core';
import { naturalCompare } from '../utils/account-sort.utils';

/**
 * Minimal structural shape the hierarchy logic needs. Any account model
 * (shared Account, matrix Account, compare options, ...) conforms to this as
 * long as it carries an id, its parent's id and the code to sort by.
 */
export interface AccountHierarchyInput {
  id: string;
  /** Missing or null marks a root account. */
  parentAccountId?: string | null;
  code: string;
}

/** An account annotated with its depth in the account tree. */
export type AccountWithDepth<T extends AccountHierarchyInput> = T & { depth: number };

/** A tree node of the account hierarchy. */
export type AccountHierarchyNode<T extends AccountHierarchyInput> = AccountWithDepth<T> & {
  children: AccountHierarchyNode<T>[];
};

/**
 * Structural index over an account list: the canonical depth-first order plus
 * fast parent/child lookups. This is the single place that decides how
 * accounts are ordered and indented across the app (accounts list, compare,
 * account groups, matrix).
 */
export interface AccountHierarchyIndex<T extends AccountHierarchyInput> {
  /** All accounts, depth-first, siblings naturally sorted by code. */
  ordered: AccountWithDepth<T>[];
  byId: Map<string, AccountWithDepth<T>>;
  /** Natural-sorted children of the given account; null collects the roots. */
  childrenOf(parentId: string | null): AccountWithDepth<T>[];
  isParent(id: string): boolean;
  maxDepth: number;
}

/**
 * Builds the account tree and its canonical order from a flat account list.
 * Accounts whose parent is not part of the list are treated as roots.
 */
@Injectable({ providedIn: 'root' })
export class AccountHierarchyService {
  index<T extends AccountHierarchyInput>(accounts: T[]): AccountHierarchyIndex<T> {
    const nodes = new Map<string, AccountHierarchyNode<T>>();
    for (const account of accounts) {
      nodes.set(account.id, { ...account, depth: 0, children: [] });
    }

    const roots: AccountHierarchyNode<T>[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentAccountId ? nodes.get(node.parentAccountId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRecursively = (list: AccountHierarchyNode<T>[]): AccountHierarchyNode<T>[] => {
      list.sort((a, b) => naturalCompare(a.code, b.code));
      for (const node of list) {
        node.depth = 0;
        sortRecursively(node.children);
      }
      return list;
    };
    sortRecursively(roots);

    const byId = new Map<string, AccountWithDepth<T>>();
    const ordered: AccountWithDepth<T>[] = [];
    const setDepthAndFlatten = (list: AccountHierarchyNode<T>[], depth: number): void => {
      for (const node of list) {
        node.depth = depth;
        byId.set(node.id, node);
        ordered.push(node);
        setDepthAndFlatten(node.children, depth + 1);
      }
    };
    setDepthAndFlatten(roots, 0);

    const childrenCache = new Map<string | null, AccountWithDepth<T>[]>();
    const childrenOf = (parentId: string | null): AccountWithDepth<T>[] => {
      const cached = childrenCache.get(parentId);
      if (cached) {
        return cached;
      }
      const children = parentId === null ? roots : (nodes.get(parentId)?.children ?? []);
      childrenCache.set(parentId, children);
      return children;
    };

    let maxDepth = 0;
    for (const node of ordered) {
      maxDepth = Math.max(maxDepth, node.depth);
    }

    return {
      ordered,
      byId,
      childrenOf,
      isParent: (id: string) => (nodes.get(id)?.children.length ?? 0) > 0,
      maxDepth,
    };
  }

  /** Canonical depth-first display order for the given flat account list. */
  flatten<T extends AccountHierarchyInput>(accounts: T[]): AccountWithDepth<T>[] {
    return this.index(accounts).ordered;
  }

  /** Tree form for consumers that need to walk the hierarchy. */
  tree<T extends AccountHierarchyInput>(accounts: T[]): AccountHierarchyNode<T>[] {
    return this.index(accounts).childrenOf(null) as AccountHierarchyNode<T>[];
  }
}

/**
 * Indentation prefix for string-only contexts (native select options cannot
 * render markup). Matches the visual of AccountCodeCellComponent.
 */
export function accountIndentLabel(depth: number, label: string): string {
  const indent = '\u00A0'.repeat(Math.max(0, depth) * 4);
  const branch = depth > 0 ? '└─ ' : '';
  return `${indent}${branch}${label}`;
}
