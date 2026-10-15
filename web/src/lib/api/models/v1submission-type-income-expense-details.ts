/* tslint:disable */
import { V1SubmissionDirectionExpenseDetails } from './v1submission-direction-expense-details';
import { V1SubmissionDirectionIncomeDetails } from './v1submission-direction-income-details';
import { V1SubmissionScope } from './v1submission-scope';
export interface V1SubmissionTypeIncomeExpenseDetails {
  expense?: V1SubmissionDirectionExpenseDetails;
  income?: V1SubmissionDirectionIncomeDetails;
  scope: V1SubmissionScope;
}
