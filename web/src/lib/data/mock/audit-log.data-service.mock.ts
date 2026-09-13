import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  AuditLogDataService,
  AuditLogEntry,
  AuditLogEntryFilters,
  AuditLogAction,
} from '../../../app/routes/audit-log/audit-log.data-service';
import { seedMockAuditHistory } from './_shared-audit-history';

interface MockEntrySpec {
  action: AuditLogAction;
  resource: string;
  organization?: string;
  actorUid?: string;
  actorName?: string;
  changes: Array<{ field: string; oldValue?: string; newValue?: string }>;
  minutesAgo: number;
}

const MOCK_ENTRIES: MockEntrySpec[] = [
  {
    action: 'CREATE',
    resource: 'organizations/org1/accounts/demo-cash',
    organization: 'org1',
    actorUid: 'user-1',
    actorName: 'Max Musterfrau',
    changes: [
      { field: 'display_name', newValue: 'Kasse' },
      { field: 'display_code', newValue: '1000' },
      { field: 'is_container', newValue: 'false' },
    ],
    minutesAgo: 30,
  },
  {
    action: 'UPDATE',
    resource: 'organizations/org1/accounts/demo-cash',
    organization: 'org1',
    actorUid: 'user-1',
    actorName: 'Max Musterfrau',
    changes: [
      { field: 'display_name', oldValue: 'Kasse', newValue: 'Kasse (Bar)' },
      { field: 'display_description', newValue: 'Barzahlungen' },
    ],
    minutesAgo: 90,
  },
  {
    action: 'UPDATE',
    resource: 'organizations/org1/accounts/demo-old',
    organization: 'org1',
    actorUid: 'user-2',
    actorName: 'Erika Mustermann',
    changes: [
      { field: 'is_archived', oldValue: 'false', newValue: 'true' },
    ],
    minutesAgo: 240,
  },
  {
    action: 'CREATE',
    resource: 'organizations/org1/transactions/demo-txn',
    organization: 'org1',
    actorUid: 'user-1',
    actorName: 'Max Musterfrau',
    changes: [
      { field: 'amount', newValue: '42.50' },
      { field: 'description', newValue: 'Einkauf Bioladen' },
    ],
    minutesAgo: 600,
  },
  {
    action: 'DELETE',
    resource: 'organizations/org1/transactions/demo-txn-old',
    organization: 'org1',
    actorUid: 'user-2',
    actorName: 'Erika Mustermann',
    changes: [
      { field: 'amount', oldValue: '13.37' },
      { field: 'description', oldValue: 'Falsche Buchung' },
    ],
    minutesAgo: 60 * 26,
  },
  {
    action: 'CREATE',
    resource: 'users/user-3',
    actorUid: 'user-1',
    actorName: 'Max Musterfrau',
    changes: [
      { field: 'email', newValue: 'neu@example.org' },
      { field: 'name', newValue: 'Neue Person' },
    ],
    minutesAgo: 60 * 50,
  },
  {
    action: 'UPDATE',
    resource: 'groups/group-admins',
    actorUid: 'user-1',
    actorName: 'Max Musterfrau',
    changes: [
      { field: 'permissions', oldValue: 'accounts:read', newValue: 'accounts:read,accounts:update' },
    ],
    minutesAgo: 60 * 80,
  },
  {
    action: 'CREATE',
    resource: 'organizations/org2',
    actorUid: 'user-1',
    actorName: 'Max Musterfrau',
    changes: [
      { field: 'display_name', newValue: 'Zweitverein' },
      { field: 'start_month', newValue: '1' },
    ],
    minutesAgo: 60 * 120,
  },
];

@Injectable()
export class MockAuditLogDataService extends AuditLogDataService {
  private readonly entries: AuditLogEntry[] = MOCK_ENTRIES.map((spec, i) => ({
    id: `mock-audit-${i}`,
    name: `auditLogEntries/mock-audit-${i}`,
    resource: spec.resource,
    organization: spec.organization ? `organizations/${spec.organization}` : '',
    organizationId: spec.organization,
    action: spec.action,
    actor: spec.actorUid ? `users/${spec.actorUid}` : '',
    actorId: spec.actorUid,
    actorName: spec.actorName,
    changes: spec.changes.map((c) => ({ ...c })),
    timestamp: new Date(Date.now() - spec.minutesAgo * 60_000),
  }));

  private nextSeedId = 0;
  private readonly seededResources = new Set<string>();

  listEntries(
    pageSize: number,
    pageToken: string | undefined,
    filters?: AuditLogEntryFilters,
  ): Observable<{ entries: AuditLogEntry[]; total: number; nextPageToken?: string }> {
    let filtered = this.entries;

    if (filters?.organizationId) {
      filtered = filtered.filter((e) => e.organizationId === filters.organizationId);
    }
    if (filters?.action && filters.action !== 'all') {
      filtered = filtered.filter((e) => e.action === filters.action);
    }
    if (filters?.exactResource?.trim()) {
      const resource = filters.exactResource.trim();
      this.ensureSeeded(resource);
      filtered = filtered.filter((e) => e.resource === resource);
    }
    if (filters?.resource?.trim()) {
      const resource = filters.resource.trim();
      this.ensureSeeded(resource);
      const q = resource.toLowerCase();
      filtered = filtered.filter((e) => e.resource.toLowerCase().includes(q));
    }
    if (filters?.actor?.trim()) {
      const q = filters.actor.trim().toLowerCase().replace(/^users\//, '');
      filtered = filtered.filter((e) => e.actorId === q);
    }
    if (filters?.afterDate) {
      const from = new Date(`${filters.afterDate}T00:00:00Z`).getTime();
      filtered = filtered.filter((e) => e.timestamp.getTime() >= from);
    }
    if (filters?.beforeDate) {
      const to = new Date(`${filters.beforeDate}T23:59:59Z`).getTime();
      filtered = filtered.filter((e) => e.timestamp.getTime() <= to);
    }

    // Newest first, so seeded entries interleave correctly with the hardcoded ones.
    filtered = [...filtered].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const offset = pageToken ? parseInt(pageToken, 10) || 0 : 0;
    const page = filtered.slice(offset, offset + pageSize);
    const nextOffset = offset + page.length;
    return of({
      entries: page,
      total: filtered.length,
      nextPageToken: nextOffset < filtered.length ? String(nextOffset) : undefined,
    });
  }

  /**
   * Lazily generates a small deterministic history for a structured resource
   * name the hardcoded entries do not cover, so resources queried from the
   * edit pages do not come back empty in mock mode.
   */
  private ensureSeeded(resource: string): void {
    if (this.seededResources.has(resource) || resource.split('/').filter(Boolean).length < 2) {
      return;
    }
    this.seededResources.add(resource);
    const orgMatch = resource.match(/^organizations\/([^/]+)/);
    for (const h of seedMockAuditHistory(resource, () => `mock-audit-seed-${this.nextSeedId++}`)) {
      this.entries.push({
        id: h.id,
        name: `auditLogEntries/${h.id}`,
        resource: h.resource,
        organization: orgMatch ? `organizations/${orgMatch[1]}` : '',
        organizationId: orgMatch?.[1],
        action: h.action,
        actor: h.actorId ? `users/${h.actorId}` : '',
        actorId: h.actorId,
        actorName: h.actorName,
        changes: h.changes.map((c) => ({ ...c })),
        timestamp: h.timestamp,
      });
    }
  }
}
