import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NotificationService, Notification } from '../../services/notification.service';
import { UserService } from '../../user.service';
import { switchMap, finalize, tap, map, filter, mergeMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-notification-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <!-- Notification Button -->
      <button 
        (click)="toggleNotifications()" 
        class="relative p-2 text-gray-400 hover:text-orange-500 focus:outline-none focus:text-orange-500 transition-colors duration-200"
        title="Notifications">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        <!-- Badge for unread count -->
        <span 
          *ngIf="unreadCount > 0" 
          class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
          {{ unreadCount > 99 ? '99+' : unreadCount }}
        </span>
      </button>

      <!-- Dropdown Panel -->
      <div 
        *ngIf="showNotifications" 
        class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
        
        <!-- Header -->
        <div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-900">Notifications</h3>
            <div class="flex items-center space-x-2">
              <button 
                *ngIf="unreadCount > 0"
                (click)="markAllAsRead()" 
                class="text-xs text-orange-600 hover:text-orange-800 transition-colors">
                Tout marquer comme lu
              </button>
              <button 
                (click)="closeNotifications()" 
                class="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="isLoading" class="px-4 py-8 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
          <p class="text-sm text-gray-500 mt-2">Chargement...</p>
        </div>

        <!-- Notifications List -->
        <div *ngIf="!isLoading" class="max-h-80 overflow-y-auto">
          <div *ngIf="notifications.length === 0" class="px-4 py-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
            </svg>
            <p class="text-sm text-gray-500 mt-2">Aucune notification</p>
          </div>

          <div *ngFor="let notification of notifications; let i = index" 
               class="px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
               [class.bg-blue-50]="!notification.isRead">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-900" [class.font-semibold]="!notification.isRead">
                  {{ notification.message }}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ formatDate(notification.createdAt) }}
                </p>
                <span *ngIf="notification.type" 
                      class="inline-block mt-1 px-2 py-0.5 text-xs rounded-full"
                      [ngClass]="{
                        'bg-green-100 text-green-800': notification.type === 'PROJECT_ASSIGNMENT',
                        'bg-blue-100 text-blue-800': notification.type === 'TIMESHEET_SUBMISSION',
                        'bg-gray-100 text-gray-800': notification.type === 'GENERAL'
                      }">
                  {{ getTypeLabel(notification.type) }}
                </span>
              </div>
              
              <div class="flex items-center space-x-2 ml-2">
                <button 
                  *ngIf="!notification.isRead"
                  (click)="markAsRead(notification.id)" 
                  class="text-xs text-orange-600 hover:text-orange-800 transition-colors"
                  title="Marquer comme lu">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                
                <button 
                  (click)="deleteNotification(notification.id)" 
                  class="text-xs text-red-400 hover:text-red-600 transition-colors"
                  title="Supprimer">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Backdrop -->
    <div 
      *ngIf="showNotifications" 
      class="fixed inset-0 z-40" 
      (click)="closeNotifications()">
    </div>
  `,
  styles: [`
    :host {
      position: relative;
      display: inline-block;
    }
  `]
})
export class NotificationButtonComponent implements OnInit {
  notifications: Notification[] = [];
  unreadCount = 0;
  showNotifications = false;
  isLoading = false;
  currentUserId: number | null = null;

  constructor(
    private notificationService: NotificationService,
    private userService: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Initialize user data first
    if (isPlatformBrowser(this.platformId)) {
      this.userService.initializeUserFromToken();
    }
    this.loadUserAndNotifications();
  }

  private loadUserAndNotifications(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    let userEmail = localStorage.getItem('userEmail');
    const token = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');

    console.log('Loading notifications - Email:', userEmail, 'Token exists:', !!token, 'UserId:', storedUserId);

    // If we already have userId, use it directly
    if (storedUserId) {
      this.currentUserId = parseInt(storedUserId);
      console.log('Using stored userId for notifications:', this.currentUserId);
      this.loadNotifications();
      this.loadUnreadCount();
      return;
    }

    // If no email but we have a token, try to extract email
    if (!userEmail && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userEmail = payload.sub || payload.email;
        if (userEmail) {
          localStorage.setItem('userEmail', userEmail);
          console.log('Email extracted from token for notifications:', userEmail);
        }
      } catch (error) {
        console.error('Error extracting email from token:', error);
      }
    }

    if (!userEmail && !token) {
      console.warn('No user authentication found - notifications disabled');
      return;
    }

    if (userEmail) {
      this.loadUserByEmail(userEmail);
    } else {
      console.warn('Could not determine user email - notifications disabled');
    }
  }

  private loadUserByEmail(email: string): void {
    this.userService.getUserByEmail(email)
      .pipe(
        tap(user => {
          this.currentUserId = user.id || parseInt(localStorage.getItem('userId') || '0');
          if (this.currentUserId) {
            localStorage.setItem('userId', this.currentUserId.toString());
            console.log('User ID set for notifications:', this.currentUserId);
          }
        }),
        filter(user => !!user.id),
        mergeMap(user => {
          this.loadNotifications();
          this.loadUnreadCount();
          return of(user);
        }),
        catchError(error => {
          console.error('Error loading user for notifications:', error);
          // Don't disable notifications entirely, just skip loading for now
          return of(null);
        })
      )
      .subscribe();
  }

  loadNotifications(): void {
    if (!this.currentUserId) return;
    
    this.isLoading = true;
    this.notificationService.getUserNotifications(this.currentUserId)
      .pipe(
        finalize(() => this.isLoading = false),
        tap(notifications => console.log('Loaded notifications:', notifications)),
        catchError(error => {
          console.error('Error loading notifications:', error);
          return of([]);
        })
      )
      .subscribe(notifications => {
        this.notifications = notifications;
      });
  }

  loadUnreadCount(): void {
    if (!this.currentUserId) return;
    
    this.notificationService.getUnreadCount(this.currentUserId)
      .pipe(
        tap(count => console.log('Loaded unread count:', count)),
        catchError(error => {
          console.error('Error loading unread count:', error);
          return of(0);
        })
      )
      .subscribe(count => {
        this.unreadCount = count;
      });
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications && this.currentUserId) {
      this.loadNotifications();
      this.loadUnreadCount();
    }
  }

  closeNotifications(): void {
    this.showNotifications = false;
  }

  markAsRead(notificationId: number): void {
    if (!this.currentUserId) return;
    
    this.notificationService.markAsRead(notificationId, this.currentUserId)
      .subscribe({
        next: () => {
          const notification = this.notifications.find(n => n.id === notificationId);
          if (notification) {
            notification.isRead = true;
            this.unreadCount = Math.max(0, this.unreadCount - 1);
          }
        },
        error: (error) => console.error('Error marking notification as read:', error)
      });
  }

  markAllAsRead(): void {
    if (!this.currentUserId) return;
    
    this.notificationService.markAllAsRead(this.currentUserId)
      .subscribe({
        next: () => {
          this.notifications.forEach(n => n.isRead = true);
          this.unreadCount = 0;
        },
        error: (error) => console.error('Error marking all as read:', error)
      });
  }

  deleteNotification(notificationId: number): void {
    if (!this.currentUserId) return;
    
    this.notificationService.deleteNotification(notificationId, this.currentUserId)
      .subscribe({
        next: () => {
          const index = this.notifications.findIndex(n => n.id === notificationId);
          if (index > -1) {
            const wasUnread = !this.notifications[index].isRead;
            this.notifications.splice(index, 1);
            if (wasUnread) {
              this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
          }
        },
        error: (error) => console.error('Error deleting notification:', error)
      });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'À l\'instant';
    } else if (diffInHours < 24) {
      return `Il y a ${Math.floor(diffInHours)}h`;
    } else {
      return date.toLocaleDateString('fr-FR');
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'PROJECT_ASSIGNMENT': return 'Assignation';
      case 'TIMESHEET_SUBMISSION': return 'Feuille de temps';
      case 'GENERAL': return 'Général';
      default: return type;
    }
  }
}
