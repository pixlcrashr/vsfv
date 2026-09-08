import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuditLogServiceService } from '../../api/services/audit-log-service.service';
import {
  AuditLogDataService,
  AuditLogEntry,
  AuditLogEntryFilters,
  AuditLogAction,
  AuditLogFieldChange,
} from '../../../app/routes/audit-log/audit-log.data-service';
import { extractUidFromResourceName } from './_mappers';

@Injectable()
export class HttpAuditLogDataService extends AuditLogDataService {
  private readonly svc = inject(AuditLogServiceService);

  listEntries(
    pageSize: number,
    pageToken: string | undefined,
    filters?: AuditLogEntryFilters,
  ): Observable<{ entries: AuditLogEntry[]; total: number; nextPageToken?: string }> {
    return this.svc
      .AuditLogServiceListAuditLogEntries({
        pageSize,
        pageToken,
        filter: this.buildApiFilter(filters),
      })
      .pipe(
        map((resp) => {
          const entries = (resp.audit_log_entries ?? []).map((e) => this.toEntry(e));
          return {
            entries,
            total: Number(resp.total_size ?? 0),
            nextPageToken: resp.next_page_token,
          };
        }),
      );
  }

  private toEntry(e: {
    name?: string;
    uid?: string;
    resource?: string;
    organization?: string;
    action?: string;
    actor?: string;
    changes?: Array<{ field?: string; old_value?: string; new_value?: string }>;
    timestamp?: string;
  }): AuditLogEntry {
    const changes: AuditLogFieldChange[] = (e.changes ?? []).map((c) => ({
      field: c.field ?? '',
      oldValue: c.old_value === '' || c.old_value === undefined ? undefined : c.old_value,
      newValue: c.new_value === '' || c.new_value === undefined ? undefined : c.new_value,
    }));

    return {
      id: e.uid ?? '',
      name: e.name ?? '',
      resource: e.resource ?? '',
      organization: e.organization ?? '',
      organizationId: e.organization
        ? extractUidFromResourceName(e.organization) || undefined
        : undefined,
      action: this.toAction(e.action),
      actor: e.actor ?? '',
      actorId: e.actor ? extractUidFromResourceName(e.actor) || undefined : undefined,
      changes,
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(0),
    };
  }

  private toAction(value: string | undefined): AuditLogAction {
    const actions: AuditLogAction[] = ['CREATE', 'UPDATE', 'DELETE'];
    const normalized = (value ?? '').replace(/^ACTION_/, '');
    return (actions as string[]).includes(normalized)
      ? (normalized as AuditLogAction)
      : 'UPDATE';
  }

  private buildApiFilter(filters?: AuditLogEntryFilters): string | undefined {
    const parts: string[] = [];
    if (filters?.organizationId) {
      parts.push(`organization="organizations/${filters.organizationId}"`);
    }
    if (filters?.action && filters.action !== 'all') {
      parts.push(`action="${filters.action}"`);
    }
    if (filters?.resource?.trim()) {
      const resource = filters.resource.trim();
      // Substring match via the AIP-160 "has" operator.
      parts.push(`resource:"${resource}"`);
    }
    if (filters?.actor?.trim()) {
      const actor = filters.actor.trim();
      // Accept both raw UIDs and full users/{uid} resource names.
      const actorName = actor.startsWith('users/')
        ? actor
        : `users/${actor}`;
      parts.push(`actor="${actorName}"`);
    }
    if (filters?.afterDate) {
      parts.push(`timestamp>="${filters.afterDate}T00:00:00Z"`);
    }
    if (filters?.beforeDate) {
      parts.push(`timestamp<="${filters.beforeDate}T23:59:59Z"`);
    }
    return parts.length > 0 ? parts.join(' AND ') : undefined;
  }
}
