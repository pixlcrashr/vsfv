import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AuthServiceService } from '../../api/services/auth-service.service';
import { LoginDataService, LoginOptions } from '../../../app/routes/login/login.data-service';

@Injectable()
export class HttpLoginDataService extends LoginDataService {
  private readonly authSvc = inject(AuthServiceService);

  getLoginOptions(): Observable<LoginOptions> {
    return this.authSvc.AuthServiceGetLoginOptions().pipe(
      map((options) => ({
        passwordEnabled: options.password_enabled ?? false,
        gitlabEnabled: options.gitlab_enabled ?? false,
      })),
    );
  }

  login(email: string, password: string): Observable<string> {
    return this.authSvc.AuthServiceLogin({ email, password }).pipe(
      map((response) => response.redirect_url ?? ''),
    );
  }
}
