import { MockAccountGroupListDataService } from '../lib/data/mock/account-group-list.data-service.mock';
import { MockAccountGroupEditDataService } from '../lib/data/mock/account-group-edit.data-service.mock';
import { MockAccountGroupStatsDataService } from '../lib/data/mock/account-group-stats.data-service.mock';
import { MockAccountListDataService } from '../lib/data/mock/account-list.data-service.mock';
import { MockAccountEditDataService } from '../lib/data/mock/account-edit.data-service.mock';
import { MockAccountCompareDataService } from '../lib/data/mock/account-compare.data-service.mock';
import { MockBudgetListDataService } from '../lib/data/mock/budget-list.data-service.mock';
import { MockBudgetEditDataService } from '../lib/data/mock/budget-edit.data-service.mock';
import { MockReimbursementListDataService } from '../lib/data/mock/reimbursement-list.data-service.mock';
import { MockReimbursementEditDataService } from '../lib/data/mock/reimbursement-edit.data-service.mock';
import { MockReimbursementNewDataService } from '../lib/data/mock/reimbursement-new.data-service.mock';
import { MockReportTemplateListDataService } from '../lib/data/mock/report-template-list.data-service.mock';
import { MockReportTemplateEditDataService } from '../lib/data/mock/report-template-edit.data-service.mock';
import { MockReportTemplateNewDataService } from '../lib/data/mock/report-template-new.data-service.mock';
import { MockReportListDataService } from '../lib/data/mock/report-list.data-service.mock';
import { MockReportViewDataService } from '../lib/data/mock/report-view.data-service.mock';
import { MockTransactionEditDataService } from '../lib/data/mock/transaction-edit.data-service.mock';
import { MockJournalListDataService } from '../lib/data/mock/journal-list.data-service.mock';
import { MockJournalAssignmentEditorDataService } from '../lib/data/mock/journal-assignment-editor.data-service.mock';
import { MockJournalImportDataService } from '../lib/data/mock/journal-import.data-service.mock';
import { MockDashboardDataService } from '../lib/data/mock/dashboard.data-service.mock';
import { MockMatrixDataService } from '../lib/data/mock/matrix.data-service.mock';
import { MockUserListDataService } from '../lib/data/mock/user-list.data-service.mock';
import { MockUserEditDataService } from '../lib/data/mock/user-edit.data-service.mock';
import { MockGroupListDataService } from '../lib/data/mock/group-list.data-service.mock';
import { MockGroupEditDataService } from '../lib/data/mock/group-edit.data-service.mock';
import { MockGroupNewDataService } from '../lib/data/mock/group-new.data-service.mock';
import { MockLedgerAccountListDataService } from '../lib/data/mock/ledger-account-list.data-service.mock';
import { MockLedgerAccountEditDataService } from '../lib/data/mock/ledger-account-edit.data-service.mock';
import { MockLedgerYearListDataService } from '../lib/data/mock/ledger-year-list.data-service.mock';
import { MockOrganizationSettingsDataService } from '../lib/data/mock/organization-settings.data-service.mock';
import { MockCreateAccountGroupDialogDataService } from '../lib/data/mock/create-account-group-dialog.data-service.mock';
import { MockAddAccountToGroupDialogDataService } from '../lib/data/mock/add-account-to-group-dialog.data-service.mock';
import { MockCreateBudgetDialogDataService } from '../lib/data/mock/create-budget-dialog.data-service.mock';
import { MockCloseBudgetDialogDataService } from '../lib/data/mock/close-budget-dialog.data-service.mock';
import { MockCreateAccountDialogDataService } from '../lib/data/mock/create-account-dialog.data-service.mock';
import { MockCreateReportDialogDataService } from '../lib/data/mock/create-report-dialog.data-service.mock';
import { MockAddReceiptDialogDataService } from '../lib/data/mock/add-receipt-dialog.data-service.mock';
import { MockOrganizationListDataService } from '../lib/data/mock/organization-list.data-service.mock';
import { MockOrganizationEditDataService } from '../lib/data/mock/organization-edit.data-service.mock';
import { MockCreateOrganizationDialogDataService } from '../lib/data/mock/create-organization-dialog.data-service.mock';
import { MockMainLayoutDataService } from '../lib/data/mock/main-layout.data-service.mock';
import { MockAuthorizationDataService } from '../lib/data/mock/authorization-data.service.mock';
import { MockCurrentUserService } from '../lib/data/mock/current-user.service.mock';
import { MockUserProfileDataService } from '../lib/data/mock/user-profile.data-service.mock';
import { MockAuditLogDataService } from '../lib/data/mock/audit-log.data-service.mock';



export const environment = {
  production: false,
  apiBaseUrl: '',
  oauthIssuer: 'http://127.0.0.1:8080',
  dataServices: {
    accountGroupList: MockAccountGroupListDataService,
    accountGroupEdit: MockAccountGroupEditDataService,
    accountGroupStats: MockAccountGroupStatsDataService,
    accountList: MockAccountListDataService,
    accountEdit: MockAccountEditDataService,
    accountCompare: MockAccountCompareDataService,
    budgetList: MockBudgetListDataService,
    budgetEdit: MockBudgetEditDataService,
    reimbursementList: MockReimbursementListDataService,
    reimbursementEdit: MockReimbursementEditDataService,
    reimbursementNew: MockReimbursementNewDataService,
    reportTemplateList: MockReportTemplateListDataService,
    reportTemplateEdit: MockReportTemplateEditDataService,
    reportTemplateNew: MockReportTemplateNewDataService,
    reportList: MockReportListDataService,
    reportView: MockReportViewDataService,
    transactionEdit: MockTransactionEditDataService,
    journalList: MockJournalListDataService,
    journalAssignmentEditor: MockJournalAssignmentEditorDataService,
    journalImport: MockJournalImportDataService,
    dashboard: MockDashboardDataService,
    matrix: MockMatrixDataService,
    userList: MockUserListDataService,
    userEdit: MockUserEditDataService,
    groupList: MockGroupListDataService,
    groupEdit: MockGroupEditDataService,
    groupNew: MockGroupNewDataService,
    ledgerAccountList: MockLedgerAccountListDataService,
    ledgerAccountEdit: MockLedgerAccountEditDataService,
    ledgerYearList: MockLedgerYearListDataService,
    organizationSettings: MockOrganizationSettingsDataService,
    // Dialog data services
    createAccountGroupDialog: MockCreateAccountGroupDialogDataService,
    addAccountToGroupDialog: MockAddAccountToGroupDialogDataService,
    createBudgetDialog: MockCreateBudgetDialogDataService,
    closeBudgetDialog: MockCloseBudgetDialogDataService,
    createAccountDialog: MockCreateAccountDialogDataService,
    createReportDialog: MockCreateReportDialogDataService,
    addReceiptDialog: MockAddReceiptDialogDataService,
    organizationList: MockOrganizationListDataService,
    organizationEdit: MockOrganizationEditDataService,
    createOrganizationDialog: MockCreateOrganizationDialogDataService,
    mainLayout: MockMainLayoutDataService,
    authorizationData: MockAuthorizationDataService,
    currentUser: MockCurrentUserService,
    userProfile: MockUserProfileDataService,
    auditLog: MockAuditLogDataService,
  },
};
