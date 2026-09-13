import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { AuditLogHistoryEntry, Organization } from '../../../app/shared/models';
import { OrganizationEditDataService, UpdateOrganizationInput } from '../../../app/routes/admin/organizations/organization-edit.data-service';
import { MockAuditHistory } from './_shared-audit-history';

@Injectable()
export class MockOrganizationEditDataService extends OrganizationEditDataService {
  private organizations: Organization[] = this.generateMockOrganizations();
  private readonly auditHistory = new MockAuditHistory();

  private orgResource(id: string): string {
    return `organizations/${id}`;
  }

  getOrganization(id: string): Observable<Organization> {
    const org = this.organizations.find((o) => o.id === id);
    if (!org) {
      throw new Error(`Organization with id ${id} not found`);
    }
    return of({ ...org }).pipe(delay(300));
  }

  updateOrganization(id: string, input: UpdateOrganizationInput): Observable<Organization> {
    const index = this.organizations.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Organization with id ${id} not found`);
    }
    const previous = this.organizations[index];
    const changes: Array<{ field: string; oldValue?: string; newValue?: string }> = [];
    if (previous.name !== input.name) {
      changes.push({ field: 'display_name', oldValue: previous.name, newValue: input.name });
    }
    if (previous.description !== input.description) {
      changes.push({ field: 'display_description', oldValue: previous.description, newValue: input.description });
    }
    if (changes.length > 0) {
      this.auditHistory.record(this.orgResource(id), 'UPDATE', changes);
    }

    const updated = {
      ...previous,
      name: input.name,
      description: input.description,
    };
    this.organizations[index] = updated;
    return of({ ...updated }).pipe(delay(300));
  }

  deleteOrganization(id: string): Observable<void> {
    this.organizations = this.organizations.filter((o) => o.id !== id);
    return of(undefined).pipe(delay(300));
  }

  getAuditLog(id: string): Observable<AuditLogHistoryEntry[]> {
    return of(this.auditHistory.list(this.orgResource(id))).pipe(delay(300));
  }

  private generateMockOrganizations(): Organization[] {
    return [
      {
        id: 'default',
        name: 'Verein Musterstadt',
        description: 'Der fiktive Musterverein für Demonstrationszwecke',
      },
    ];
  }
}
