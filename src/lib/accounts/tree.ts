import { accountsModel } from "../prisma/generated/models";

export interface Account {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface FlatAccount extends Account {
  depth: number;
  isGroup: boolean;
  parentAccountId: string | null;
  node: Node;
}

export enum NodeSort {
  Code
}

export function sortedFlatAccountIterator(rootNode: RootNode): Iterable<FlatAccount> {
  return {
    *[Symbol.iterator]() {
      const stack: Node[] = [...rootNode.getSortedChildren()];
      stack.reverse();

      while (stack.length > 0) {
        const node = stack.pop()!;

        yield {
          id: node.account.id,
          code: node.account.code,
          name: node.account.name,
          description: node.account.description,
          depth: node.depth,
          isGroup: node.children.length > 0,
          parentAccountId: node.parentNode?.account.id ?? null,
          node: node
        };

        const cs = node.getSortedChildren();
        for (let i = cs.length - 1; i >= 0; i--) {
          stack.push(cs[i]);
        }
      }
    }
  };
}

export class RootNode {
  public constructor(
    public readonly children: ReadonlyArray<Node>
  ) {
  }

  public getSortedChildren(sort: NodeSort = NodeSort.Code): ReadonlyArray<Node> {
    const cs = Array.from(this.children);

    switch (sort) {
      case NodeSort.Code:
        cs.sort((a, b) => a.account.code.localeCompare(b.account.code, undefined, { numeric: true }));
        return cs;
    }
  }

  public findNodeByAccountId(accountId: string, recursive: boolean = true): Node | null {
    for (const c of this.children) {
      if (c.account.id === accountId) {
        return c;
      }

      if (recursive) {
        const n = c.findNodeByAccountId(accountId, true);
        if (n !== null) {
          return n;
        }
      }
    }

    return null;
  }
}

export class Node extends RootNode {
  public constructor(
    public readonly account: Account,
    public readonly parentNode: Node | null,
    public readonly depth: number,
    children: ReadonlyArray<Node>
  ) {
    super(children);
  }
}

function iterateChildren(accounts: accountsModel[], parentNode: Node | null, account: accountsModel, depth: number): Node {
  const children: Node[] = [];
  const n = new Node(
    {
      id: account.id,
      code: account.display_code,
      name: account.display_name,
      description: account.display_description,
    },
    parentNode,
    depth,
    children
  );

  const childAccounts = accounts.filter(a => a.parent_account_id === account.id);
  children.push(...childAccounts.map(a => iterateChildren(accounts, n, a, depth + 1)));

  return n;
}

export function buildTreeFromDB(accounts: accountsModel[]): RootNode {
  const cs: Node[] = [];
  const rN = new RootNode(cs);

  const rootAccounts = accounts.filter(a => a.parent_account_id === null);
  cs.push(...rootAccounts.map(a => iterateChildren(accounts, null, a, 0)));

  return rN;
}
