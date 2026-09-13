import { Injectable } from '@angular/core';
import { Observable, of, delay, throwError } from 'rxjs';
import { LoginDataService, LoginOptions } from '../../../app/routes/login/login.data-service';

@Injectable()
export class MockLoginDataService extends LoginDataService {
  private readonly options: LoginOptions = {
    passwordEnabled: true,
    gitlabEnabled: true,
  };

  getLoginOptions(): Observable<LoginOptions> {
    return of({ ...this.options }).pipe(delay(300));
  }

  login(email: string, password: string): Observable<string> {
    if (!email || !password) {
      return throwError(() => new Error('Invalid credentials')).pipe(delay(300));
    }
    // Mock mode has no real OAuth2 issuer; the caller treats an empty URL
    // as "already done".
    return of('').pipe(delay(300));
  }
}
