import { HttpAccountGroupListDataService } from '../lib/data/http/account-group-list.data-service.http';
import { HttpAccountGroupEditDataService } from '../lib/data/http/account-group-edit.data-service.http';
import { HttpAccountGroupStatsDataService } from '../lib/data/http/account-group-stats.data-service.http';
import { HttpAccountListDataService } from '../lib/data/http/account-list.data-service.http';
import { HttpAccountEditDataService } from '../lib/data/http/account-edit.data-service.http';
import { HttpAccountCompareDataService } from '../lib/data/http/account-compare.data-service.http';
import { HttpBudgetListDataService } from '../lib/data/http/budget-list.data-service.http';
import { HttpBudgetEditDataService } from '../lib/data/http/budget-edit.data-service.http';
// Applications and Reimbursements - using mock services until HTTP implementations exist
import { MockReimbursementListDataService } from '../lib/data/mock/reimbursement-list.data-service.mock';
import { MockReimbursementEditDataService } from '../lib/data/mock/reimbursement-edit.data-service.mock';
import { MockReimbursementNewDataService } from '../lib/data/mock/reimbursement-new.data-service.mock';
import { HttpReportTemplateListDataService } from '../lib/data/http/report-template-list.data-service.http';
import { HttpReportTemplateEditDataService } from '../lib/data/http/report-template-edit.data-service.http';
import { HttpReportTemplateNewDataService } from '../lib/data/http/report-template-new.data-service.http';
import { HttpReportListDataService } from '../lib/data/http/report-list.data-service.http';
import { HttpReportViewDataService } from '../lib/data/http/report-view.data-service.http';
import { HttpTransactionEditDataService } from '../lib/data/http/transaction-edit.data-service.http';
import { HttpJournalListDataService } from '../lib/data/http/journal-list.data-service.http';
import { HttpJournalAssignmentEditorDataService } from '../lib/data/http/journal-assignment-editor.data-service.http';
import { HttpJournalImportDataService } from '../lib/data/http/journal-import.data-service.http';
import { HttpDashboardDataService } from '../lib/data/http/dashboard.data-service.http';
import { HttpMatrixDataService } from '../lib/data/http/matrix.data-service.http';
import { HttpUserListDataService } from '../lib/data/http/user-list.data-service.http';
import { HttpUserEditDataService } from '../lib/data/http/user-edit.data-service.http';
import { HttpGroupListDataService } from '../lib/data/http/group-list.data-service.http';
import { HttpGroupEditDataService } from '../lib/data/http/group-edit.data-service.http';
import { HttpGroupNewDataService } from '../lib/data/http/group-new.data-service.http';
import { HttpLedgerAccountListDataService } from '../lib/data/http/ledger-account-list.data-service.http';
import { HttpLedgerAccountEditDataService } from '../lib/data/http/ledger-account-edit.data-service.http';
import { HttpLedgerYearListDataService } from '../lib/data/http/ledger-year-list.data-service.http';
import { HttpOrganizationSettingsDataService } from '../lib/data/http/organization-settings.data-service.http';
import { HttpCreateAccountGroupDialogDataService } from '../lib/data/http/create-account-group-dialog.data-service.http';
import { HttpAddAccountToGroupDialogDataService } from '../lib/data/http/add-account-to-group-dialog.data-service.http';
import { HttpCreateBudgetDialogDataService } from '../lib/data/http/create-budget-dialog.data-service.http';
import { HttpCloseBudgetDialogDataService } from '../lib/data/http/close-budget-dialog.data-service.http';
import { HttpCreateAccountDialogDataService } from '../lib/data/http/create-account-dialog.data-service.http';
import { HttpCreateReportDialogDataService } from '../lib/data/http/create-report-dialog.data-service.http';
// Add Receipt Dialog - using mock until HTTP implementation exists
import { MockAddReceiptDialogDataService } from '../lib/data/mock/add-receipt-dialog.data-service.mock';
import { HttpOrganizationListDataService } from '../lib/data/http/organization-list.data-service.http';
import { HttpOrganizationEditDataService } from '../lib/data/http/organization-edit.data-service.http';
import { HttpCreateOrganizationDialogDataService } from '../lib/data/http/create-organization-dialog.data-service.http';
import { HttpMainLayoutDataService } from '../lib/data/http/main-layout.data-service.http';
import { HttpAuthorizationDataService } from '../lib/data/http/authorization-data.service.http';
import { HttpCurrentUserService } from '../lib/data/http/current-user.service.http';
import { HttpUserProfileDataService } from '../lib/data/http/user-profile.data-service.http';
import { HttpAuditLogDataService } from '../lib/data/http/audit-log.data-service.http';



export const environment = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8080/api',
  oauthIssuer: 'http://127.0.0.1:8080',
  dataServices: {
    accountGroupList: HttpAccountGroupListDataService,
    accountGroupEdit: HttpAccountGroupEditDataService,
    accountGroupStats: HttpAccountGroupStatsDataService,
    accountList: HttpAccountListDataService,
    accountEdit: HttpAccountEditDataService,
    accountCompare: HttpAccountCompareDataService,
    budgetList: HttpBudgetListDataService,
    budgetEdit: HttpBudgetEditDataService,
    reimbursementList: MockReimbursementListDataService,
    reimbursementEdit: MockReimbursementEditDataService,
    reimbursementNew: MockReimbursementNewDataService,
    reportTemplateList: HttpReportTemplateListDataService,
    reportTemplateEdit: HttpReportTemplateEditDataService,
    reportTemplateNew: HttpReportTemplateNewDataService,
    reportList: HttpReportListDataService,
    reportView: HttpReportViewDataService,
    transactionEdit: HttpTransactionEditDataService,
    journalList: HttpJournalListDataService,
    journalAssignmentEditor: HttpJournalAssignmentEditorDataService,
    journalImport: HttpJournalImportDataService,
    dashboard: HttpDashboardDataService,
    matrix: HttpMatrixDataService,
    userList: HttpUserListDataService,
    userEdit: HttpUserEditDataService,
    groupList: HttpGroupListDataService,
    groupEdit: HttpGroupEditDataService,
    groupNew: HttpGroupNewDataService,
    ledgerAccountList: HttpLedgerAccountListDataService,
    ledgerAccountEdit: HttpLedgerAccountEditDataService,
    ledgerYearList: HttpLedgerYearListDataService,
    organizationSettings: HttpOrganizationSettingsDataService,
    // Dialog data services
    createAccountGroupDialog: HttpCreateAccountGroupDialogDataService,
    addAccountToGroupDialog: HttpAddAccountToGroupDialogDataService,
    createBudgetDialog: HttpCreateBudgetDialogDataService,
    closeBudgetDialog: HttpCloseBudgetDialogDataService,
    createAccountDialog: HttpCreateAccountDialogDataService,
    createReportDialog: HttpCreateReportDialogDataService,
    addReceiptDialog: MockAddReceiptDialogDataService,
    organizationList: HttpOrganizationListDataService,
    organizationEdit: HttpOrganizationEditDataService,
    createOrganizationDialog: HttpCreateOrganizationDialogDataService,
    mainLayout: HttpMainLayoutDataService,
    authorizationData: HttpAuthorizationDataService,
    currentUser: HttpCurrentUserService,
    userProfile: HttpUserProfileDataService,
    auditLog: HttpAuditLogDataService,
  },
};
