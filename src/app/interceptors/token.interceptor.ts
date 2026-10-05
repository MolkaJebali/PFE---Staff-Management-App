import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  private baseUrl = 'http://localhost:8081/api';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    // Skip token for auth endpoints
    if (req.url.includes('/login') || req.url.includes('/signin') || req.url.includes('/refresh-token')) {
      return next.handle(req);
    }

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      const userEmail = localStorage.getItem('userEmail');

      if (token && this.shouldAddAuth(req.url)) {
        // Clone request and add authorization header
        const authReq = req.clone({
          headers: req.headers.set('Authorization', `Bearer ${token}`)
        });

        return next.handle(authReq).pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status === 401 || error.status === 403) {
              console.log('Authentication error:', error);
              
              // Try to refresh token if we have user email
              if (userEmail) {
                return this.refreshTokenAndRetry(authReq, next, userEmail);
              }
            }
            return throwError(() => error);
          })
        );
      }
    }

    return next.handle(req);
  }

  private shouldAddAuth(url: string): boolean {
    // Add auth header for notification endpoints
    return url.includes('/notifications/');
  }

  private refreshTokenAndRetry(req: HttpRequest<any>, next: HttpHandler, email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/refresh-token?email=${email}`, {}).pipe(
      switchMap((response: any) => {
        if (response.jwt) {
          localStorage.setItem('token', response.jwt);
          console.log('Token refreshed successfully');
          
          // Retry original request with new token
          const newAuthReq = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${response.jwt}`)
          });
          
          return next.handle(newAuthReq);
        }
        return throwError(() => new Error('Token refresh failed'));
      }),
      catchError((refreshError) => {
        console.error('Token refresh failed:', refreshError);
        // Clear localStorage and redirect to login
        localStorage.clear();
        window.location.href = '/';
        return throwError(() => refreshError);
      })
    );
  }
}
