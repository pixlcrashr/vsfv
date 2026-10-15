import { Observable } from 'rxjs';
import { CreatedAccount, ParentAccountOption } from './create-account-dialog.component';

export abstract class CreateAccountDialogDataService {
  abstract listParentAccounts(organizationId: string): Observable<ParentAccountOption[]>;
  abstract createAccount(
    organizationId: string,
    name: string,
    code: string,
    description: string,
    parentAccountId: string | null,
    isContainer: boolean,
    invertSign: boolean,
  ): Observable<CreatedAccount>;
}
