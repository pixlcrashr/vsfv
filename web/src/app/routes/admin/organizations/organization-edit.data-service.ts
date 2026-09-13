import { Observable } from 'rxjs';
import { AuditLogHistoryEntry, Organization } from '../../../shared/models';

export interface UpdateOrganizationInput {
  name: string;
  description: string;
}

export abstract class OrganizationEditDataService {
  abstract getOrganization(id: string): Observable<Organization>;
  abstract updateOrganization(id: string, input: UpdateOrganizationInput): Observable<Organization>;
  abstract deleteOrganization(id: string): Observable<void>;

  /** Audit log entries for the organization itself. */
  abstract getAuditLog(id: string): Observable<AuditLogHistoryEntry[]>;
}
