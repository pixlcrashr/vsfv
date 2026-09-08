/* tslint:disable */
import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { ApiConfiguration, ApiConfigurationInterface } from './api-configuration';

import { AuditLogServiceService } from './services/audit-log-service.service';
import { GroupServiceService } from './services/group-service.service';
import { OrganizationServiceService } from './services/organization-service.service';
import { ReportTemplateServiceService } from './services/report-template-service.service';
import { UserServiceService } from './services/user-service.service';
import { AccountServiceService } from './services/account-service.service';
import { AccountGroupServiceService } from './services/account-group-service.service';
import { BudgetAccountValueServiceService } from './services/budget-account-value-service.service';
import { TransactionAssignmentServiceService } from './services/transaction-assignment-service.service';
import { AccountGroupAssignmentServiceService } from './services/account-group-assignment-service.service';
import { BudgetServiceService } from './services/budget-service.service';
import { LedgerAccountServiceService } from './services/ledger-account-service.service';
import { LedgerYearServiceService } from './services/ledger-year-service.service';
import { ReportServiceService } from './services/report-service.service';
import { TransactionServiceService } from './services/transaction-service.service';
import { UserIdentityServiceService } from './services/user-identity-service.service';
import { UserSettingsServiceService } from './services/user-settings-service.service';
import { BudgetActualAccountValueServiceService } from './services/budget-actual-account-value-service.service';
import { BudgetRevisionServiceService } from './services/budget-revision-service.service';
import { BudgetRevisionAccountValueServiceService } from './services/budget-revision-account-value-service.service';

/**
 * Provider for all Api services, plus ApiConfiguration
 */
@NgModule({
  imports: [
    HttpClientModule
  ],
  exports: [
    HttpClientModule
  ],
  declarations: [],
  providers: [
    ApiConfiguration,
    AuditLogServiceService,
    GroupServiceService,
    OrganizationServiceService,
    ReportTemplateServiceService,
    UserServiceService,
    AccountServiceService,
    AccountGroupServiceService,
    BudgetAccountValueServiceService,
    TransactionAssignmentServiceService,
    AccountGroupAssignmentServiceService,
    BudgetServiceService,
    LedgerAccountServiceService,
    LedgerYearServiceService,
    ReportServiceService,
    TransactionServiceService,
    UserIdentityServiceService,
    UserSettingsServiceService,
    BudgetActualAccountValueServiceService,
    BudgetRevisionServiceService,
    BudgetRevisionAccountValueServiceService
  ],
})
export class ApiModule {
  static forRoot(customParams: ApiConfigurationInterface): ModuleWithProviders<ApiModule> {
    return {
      ngModule: ApiModule,
      providers: [
        {
          provide: ApiConfiguration,
          useValue: {rootUrl: customParams.rootUrl}
        }
      ]
    }
  }
}
