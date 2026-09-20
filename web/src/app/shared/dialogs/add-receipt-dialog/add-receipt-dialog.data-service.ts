import { Observable } from 'rxjs';
import { SubmissionItem } from '../../models';

export interface AddReceiptParams {
  category: string;
  amount: number; // in cents
  description: string | null;
  file: File;
}

export abstract class AddReceiptDialogDataService {
  abstract uploadReceipt(organizationId: string, params: AddReceiptParams): Observable<SubmissionItem>;
}
