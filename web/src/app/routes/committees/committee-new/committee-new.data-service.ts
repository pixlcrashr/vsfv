import { Observable } from 'rxjs';
import { Committee } from '../../../shared/models';
import { SaveCommitteeInput } from '../committee-form.model';

export abstract class CommitteeNewDataService {
  abstract createCommittee(organizationId: string, input: SaveCommitteeInput): Observable<Committee>;
}
