import { Observable } from 'rxjs';
import { Organization } from '../models';

/**
 * Data source for the shared organization store. Kept as an abstract data
 * service so the store works against the HTTP API and the mock backend.
 */
export abstract class OrganizationStoreDataService {
  abstract getOrganizations(): Observable<Organization[]>;
}
