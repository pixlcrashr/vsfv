import {
  AuditLogHistoryAction,
  AuditLogHistoryChange,
  AuditLogHistoryEntry,
} from '../../../app/shared/models';

const ACTORS = [
  { uid: 'user-1', name: 'Max Musterfrau' },
  { uid: 'user-2', name: 'Erika Mustermann' },
] as const;

/** Actor used for entries recorded by mock mutations in the current session. */
export const MOCK_AUDIT_ACTOR = ACTORS[0];

const NAME_VALUES = [
  'Allgemein',
  'Verwaltung',
  'Öffentlichkeitsarbeit',
  'Sparte Nord',
  'Projekt Kasse',
] as const;

const DESCRIPTION_VALUES = [
  'Beschreibung aktualisiert',
  'Neu angelegt',
  'Für Veröffentlichung angepasst',
] as const;

const FIELD_POOLS: Array<{ test: (resource: string) => boolean; fields: string[] }> = [
  { test: (r) => r.includes('/revisions/'), fields: ['display_name', 'display_description', 'is_published'] },
  { test: (r) => r.includes('/accountValues/'), fields: ['value'] },
  { test: (r) => r.includes('/assignments/'), fields: ['negate'] },
  {
    test: (r) => r.includes('/accounts/'),
    fields: ['display_name', 'display_code', 'display_description', 'is_archived'],
  },
  { test: (r) => /\/budgets\/[^/]+$/.test(r), fields: ['display_name', 'display_description', 'is_published'] },
  { test: (r) => /^organizations\/[^/]+$/.test(r), fields: ['display_name', 'display_description'] },
  { test: () => true, fields: ['display_name', 'display_description'] },
];

/** Deterministic PRNG (mulberry32) so a given resource always gets the same mock history. */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Generates a small deterministic audit history for `resource`
 * (one CREATE followed by 1-3 UPDATEs, oldest first).
 */
export function seedMockAuditHistory(
  resource: string,
  makeId: () => string,
): AuditLogHistoryEntry[] {
  const rand = seededRandom(hashString(resource));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const fields = FIELD_POOLS.find((p) => p.test(resource))!.fields;

  const valueFor = (field: string): string => {
    switch (field) {
      case 'display_name':
        return pick(NAME_VALUES);
      case 'display_description':
        return pick(DESCRIPTION_VALUES);
      case 'display_code':
        return String(1000 + Math.floor(rand() * 8999));
      case 'value':
        return (rand() * 500).toFixed(2);
      case 'is_published':
      case 'is_archived':
      case 'negate':
        return rand() < 0.5 ? 'true' : 'false';
      default:
        return `${field} #${1 + Math.floor(rand() * 90)}`;
    }
  };

  const build = (
    action: AuditLogHistoryAction,
    changes: AuditLogHistoryChange[],
    minutesAgo: number,
  ): AuditLogHistoryEntry => {
    const actor = pick(ACTORS);
    return {
      id: makeId(),
      resource,
      action,
      actorId: actor.uid,
      actorName: actor.name,
      changes,
      timestamp: new Date(Date.now() - minutesAgo * 60_000),
    };
  };

  const displayName = pick(NAME_VALUES);
  const entries: AuditLogHistoryEntry[] = [];
  let minutesAgo = 60 * 24 * (2 + Math.floor(rand() * 20));

  entries.push(
    build(
      'CREATE',
      fields.map((f) => ({ field: f, newValue: valueFor(f) })),
      minutesAgo,
    ),
  );

  const updateCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < updateCount; i++) {
    minutesAgo = Math.max(5, minutesAgo - (60 + Math.floor(rand() * 60 * 24 * 5)));
    const field = pick(fields);
    const newValue = valueFor(field);
    const changes =
      newValue === displayName
        ? [{ field, newValue }]
        : [{ field, oldValue: field === 'display_name' ? displayName : undefined, newValue }];
    entries.push(build('UPDATE', changes, minutesAgo));
  }

  return entries;
}

/**
 * In-memory audit history for mock data services: lazily seeds a plausible
 * history per resource and records entries for mutations performed in the
 * session, mirroring what the backend audit writer records.
 */
export class MockAuditHistory {
  private readonly entries: AuditLogHistoryEntry[] = [];
  private readonly seeded = new Set<string>();
  private nextId = 0;

  /** Entries under `resource` (prefix match, includes child resources), newest first. */
  list(resource: string): AuditLogHistoryEntry[] {
    this.ensureSeeded(resource);
    const q = resource.toLowerCase();
    return this.entries
      .filter((e) => e.resource.toLowerCase().includes(q))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .map((e) => ({ ...e, changes: e.changes.map((c) => ({ ...c })) }));
  }

  /** Records an entry for a mutation performed in the current session. */
  record(
    resource: string,
    action: AuditLogHistoryAction,
    changes: AuditLogHistoryChange[],
  ): void {
    this.entries.push({
      id: `mock-history-${this.nextId++}`,
      resource,
      action,
      actorId: MOCK_AUDIT_ACTOR.uid,
      actorName: MOCK_AUDIT_ACTOR.name,
      changes,
      timestamp: new Date(),
    });
  }

  private ensureSeeded(resource: string): void {
    if (this.seeded.has(resource)) {
      return;
    }
    this.seeded.add(resource);
    this.entries.push(...seedMockAuditHistory(resource, () => `mock-history-${this.nextId++}`));
  }
}
