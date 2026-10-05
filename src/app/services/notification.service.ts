import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface NotificationData {
  userId: number;
  message: string;
  type: string;
  data: any;
}

export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: string;
  data?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = 'http://localhost:8081/api/notifications';
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  private getCurrentUserId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const userId = localStorage.getItem('userId');
      return userId ? parseInt(userId, 10) : null;
    }
    return null;
  }

  private ensureUserEmail(): void {
    if (isPlatformBrowser(this.platformId)) {
      let userEmail = localStorage.getItem('userEmail');
      const token = localStorage.getItem('token');
      
      if (!userEmail && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userEmail = payload.sub || payload.email;
          if (userEmail) {
            localStorage.setItem('userEmail', userEmail);
            console.log('Email extracted and stored for notifications:', userEmail);
          }
        } catch (error) {
          console.error('Error extracting email from token for notifications:', error);
        }
      }
    }
  }

  // Get notifications for current user
  getUserNotifications(userId?: number): Observable<Notification[]> {
    const finalUserId = userId || this.getCurrentUserId();
    if (!finalUserId) {
      console.warn('User ID not found for notifications');
      return of([]);
    }
    
    return this.http.get<Notification[]>(`${this.baseUrl}/user/${finalUserId}`, { headers: this.getAuthHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching notifications:', error);
        return of([]);
      })
    );
  }

  // Get unread notifications count
  getUnreadCount(userId?: number): Observable<number> {
    const finalUserId = userId || this.getCurrentUserId();
    if (!finalUserId) {
      console.warn('User ID not found for unread count');
      return of(0);
    }
    
    return this.http.get<number>(`${this.baseUrl}/user/${finalUserId}/unread-count`, { headers: this.getAuthHeaders() }).pipe(
      tap(count => this.unreadCountSubject.next(count)),
      catchError(error => {
        console.error('Error fetching unread count:', error);
        return of(0);
      })
    );
  }

  // Create notification (for manager actions)
  createNotification(notificationData: {
    userId: number;
    message: string;
    type: string;
    data?: any;
  }): Observable<Notification> {
    // Ensure user authentication is available
    this.ensureUserEmail();
    
    const headers = this.getAuthHeaders();
    console.log('Creating notification with headers:', headers.keys());
    
    return this.http.post<Notification>(`${this.baseUrl}/create`, notificationData, { headers }).pipe(
      catchError(error => {
        console.error('Error creating notification:', error);
        
        // Handle specific database schema errors
        if (error.error && typeof error.error === 'string' && error.error.includes('Data truncated')) {
          console.error('Database schema issue: notification type column too small');
          // You could implement a fallback with shorter notification types here
          const fallbackData = {
            ...notificationData,
            type: 'GENERAL', // Shorter fallback type
            message: `${notificationData.message} (Note: Assignment notification)`
          };
          
          console.log('Attempting fallback notification with GENERAL type');
          return this.http.post<Notification>(`${this.baseUrl}/create`, fallbackData, { headers }).pipe(
            catchError(fallbackError => {
              console.error('Fallback notification also failed:', fallbackError);
              return throwError(() => new Error('Notification system temporarily unavailable'));
            })
          );
        }
        
        // Handle authentication errors
        if (error.status === 401 || error.status === 403) {
          console.error('Authentication error for notifications');
          return throwError(() => new Error('Authentication required for notifications'));
        }
        
        return throwError(() => error);
      })
    );
  }

  // Mark notification as read
  markAsRead(notificationId: number, userId?: number): Observable<any> {
    const finalUserId = userId || this.getCurrentUserId();
    if (!finalUserId) {
      return throwError(() => new Error('User ID not found'));
    }
    
    const params = new HttpParams().set('userId', finalUserId.toString());
    return this.http.put(`${this.baseUrl}/${notificationId}/read`, {}, { 
      params, 
      headers: this.getAuthHeaders() 
    }).pipe(
      tap(() => this.updateUnreadCount()),
      catchError(error => {
        console.error('Error marking notification as read:', error);
        return throwError(() => error);
      })
    );
  }

  // Mark all notifications as read
  markAllAsRead(userId?: number): Observable<any> {
    const finalUserId = userId || this.getCurrentUserId();
    if (!finalUserId) {
      return throwError(() => new Error('User ID not found'));
    }
    
    return this.http.put(`${this.baseUrl}/user/${finalUserId}/mark-all-read`, {}, { headers: this.getAuthHeaders() }).pipe(
      tap(() => {
        this.unreadCountSubject.next(0);
      }),
      catchError(error => {
        console.error('Error marking all notifications as read:', error);
        return throwError(() => error);
      })
    );
  }

  // Delete notification
  deleteNotification(notificationId: number, userId?: number): Observable<any> {
    const finalUserId = userId || this.getCurrentUserId();
    if (!finalUserId) {
      return throwError(() => new Error('User ID not found'));
    }
    
    const params = new HttpParams().set('userId', finalUserId.toString());
    return this.http.delete(`${this.baseUrl}/${notificationId}`, { 
      params, 
      headers: this.getAuthHeaders() 
    }).pipe(
      tap(() => this.updateUnreadCount()),
      catchError(error => {
        console.error('Error deleting notification:', error);
        return throwError(() => error);
      })
    );
  }

  // Update unread count
  private updateUnreadCount(): void {
    const userId = this.getCurrentUserId();
    if (userId) {
      this.getUnreadCount(userId).subscribe();
    }
  }
}
