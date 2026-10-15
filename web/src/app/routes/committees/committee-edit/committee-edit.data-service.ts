import { Observable } from 'rxjs';
import { Committee } from '../../../shared/models';
import { CommitteeMember, CommitteeUser, SaveCommitteeInput } from '../committee-form.model';

export abstract class CommitteeEditDataService {
  abstract getCommittee(organizationId: string, id: string): Observable<Committee>;
  abstract updateCommittee(organizationId: string, id: string, input: SaveCommitteeInput): Observable<Committee>;
  abstract listMembers(organizationId: string, committeeId: string): Observable<CommitteeMember[]>;
  abstract addMember(organizationId: string, committeeId: string, userId: string): Observable<CommitteeMember>;
  abstract removeMember(organizationId: string, committeeId: string, memberId: string): Observable<void>;
  abstract listUsers(organizationId: string): Observable<CommitteeUser[]>;
}
