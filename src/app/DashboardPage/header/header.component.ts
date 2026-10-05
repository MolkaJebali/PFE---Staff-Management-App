import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationButtonComponent } from '../../shared/notification-button/notification-button.component';

interface Notification {
  message: string;
  date: Date;
  read: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, NotificationButtonComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  notifications: Notification[] = [
    {
      message: "Votre rapport est prêt",
      date: new Date(),
      read: false
    },
    {
      message: "Mise à jour disponible",
      date: new Date(Date.now() - 86400000), // Hier
      read: true
    }
  ];
  currentDate = new Date();
  showFeaturesDropdown = false; // Add this property
  showNotifModal: boolean = false;
  unreadNotificationsCount: number = 0;
  showHelpModal = false;

  constructor(private router: Router) {}

  getDate() {
    const currentDate = new Date(this.currentDate);
  
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsOfYear = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
    const dayOfWeek = daysOfWeek[currentDate.getDay()];
    const month = monthsOfYear[currentDate.getMonth()];
    const day = currentDate.getDate().toString().padStart(2, '0');
    const year = currentDate.getFullYear();
  
    return `${dayOfWeek} ${month} ${day} ${year}`;
  }
  
  showHelp() {
    this.showHelpModal = true;
  }

  closeHelp() {
    this.showHelpModal = false;
  }

  openNotifications(): void {
    this.showNotifModal = true;
    this.markAllAsRead(); // Optionnel : marquer comme lues à l'ouverture
  }
  
  closeNotifications(): void {
    this.showNotifModal = false;
  }
  
  addNotification(message: string) {
    this.notifications.unshift({
      message: message,
      date: new Date(),
      read: false
    });
    this.updateUnreadCount();
  }
  
  private updateUnreadCount() {
    this.unreadNotificationsCount = this.notifications.filter(n => !n.read).length;
  }
  
  removeNotification(index: number): void {
    this.notifications.splice(index, 1);
    this.updateUnreadCount();
  }
  
  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.updateUnreadCount();
  }
  
  navigateBack() {
    this.router.navigate(['/manager-home']);
  }

  // Toggle features dropdown
  toggleFeaturesDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation(); // Prevent document click from immediately closing it
    }
    this.showFeaturesDropdown = !this.showFeaturesDropdown;
  }
  
  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.features-dropdown-container');
    
    if (this.showFeaturesDropdown && dropdown && !dropdown.contains(target)) {
      this.showFeaturesDropdown = false;
    }
  }

  ngOnInit() {
    this.addNotification("Alerte système");
    this.addNotification("Mise à jour disponible");
    this.addNotification("Nouveau message");
    this.updateUnreadCount();
  }
}