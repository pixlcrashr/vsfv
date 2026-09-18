import { environment as prodEnvironment } from './environment.api-development';



export const environment = {
  production: true,
  apiBaseUrl: '/',
  oauthIssuer: '',
  requireLogin: true,
  dataServices: prodEnvironment.dataServices
};
