import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  
  // Only use localStorage in browser environment
  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('token');
    
    if (token) {
      // Clone the request and add the Authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Return the cloned request with the token
      return next(authReq).pipe(
        catchError(error => {
          if (error.status === 401 || error.status === 403) {
            console.error('Authentication error:', error.message);
            
            // Clear the token and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            router.navigate(['/login']);
          }
          
          return throwError(() => error);
        })
      );
    }
  }
  
  // If no token or not in browser, continue with the original request
  return next(req);
};
