import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { faker } from '@faker-js/faker/locale/de';
import {
  AddReceiptDialogDataService,
  AddReceiptParams,
} from '../../../app/shared/dialogs/add-receipt-dialog/add-receipt-dialog.data-service';
import { SubmissionItem } from '../../../app/shared/models';

@Injectable()
export class MockAddReceiptDialogDataService extends AddReceiptDialogDataService {
  private receiptCounter = 1;
  private invoiceCounter = 1;

  uploadReceipt(organizationId: string, params: AddReceiptParams): Observable<SubmissionItem> {
    const year = new Date().getFullYear();
        
    const invoiceItem: SubmissionItem = {
      id: faker.string.uuid(),
      publicId: `${year}/99/1`,
      submissionId: faker.string.uuid(),
      category: params.category,
      documentForm: 'digital_original' as const,
      source: null,
      description: params.description,
      amount: params.amount,
      attachments: [
        {
          id: faker.string.uuid(),
          submissionItemId: faker.string.uuid(),
          fileName: params.file.name,
          mimeType: params.file.type,
          fileSize: params.file.size,
          storageKey: faker.string.alphanumeric(32),
          uploadedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      originalReceived: false,
      originalReceivedAt: null,
      originalReceivedByUserId: null,
      originalReceivedByUserName: null,
    };

    return of(invoiceItem).pipe(delay(800));
  }
}
