import { Injectable } from '@angular/core';
import { Account, HierarchicalAccount } from '../models';
import { sortAccountTreeByCode } from '../utils/account-sort.utils';

@Injectable({ providedIn: 'root' })
export class AccountHierarchyService {
  build(flatAccounts: Account[]): HierarchicalAccount[] {
    const map = new Map<string, HierarchicalAccount>();
    const roots: HierarchicalAccount[] = [];

    for (const a of flatAccounts) {
      map.set(a.id, { ...a, depth: 0, children: [] });
    }

    for (const a of map.values()) {
      if (a.parentAccountId && map.has(a.parentAccountId)) {
        map.get(a.parentAccountId)!.children.push(a);
      } else {
        roots.push(a);
      }
    }

    sortAccountTreeByCode(roots);

    function setDepth(accounts: HierarchicalAccount[], depth: number): void {
      for (const a of accounts) {
        a.depth = depth;
        setDepth(a.children, depth + 1);
      }
    }

    setDepth(roots, 0);

    return roots;
  }
}
