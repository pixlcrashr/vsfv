import { Observable } from 'rxjs';
import { Committee } from '../../../shared/models';

export abstract class CommitteeListDataService {
  abstract listCommittees(organizationId: string): Observable<Committee[]>;
  abstract deleteCommittee(organizationId: string, id: string): Observable<void>;
}
