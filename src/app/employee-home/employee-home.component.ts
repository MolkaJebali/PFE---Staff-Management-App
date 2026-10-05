import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserService } from '../user.service';
import { NotificationButtonComponent } from '../shared/notification-button/notification-button.component';

interface Notification { 
  id: number;
  message: string; 
  date: string; 
  read: boolean; 
}

interface ManagerAssignment {
  id: number;
  date: string;
  note: string;
  project: string;
  task: string;
  teamMember: string;
  typeStaffing: string;
  taskType: string;
  plannedHours: number;
  priority: string;
  managerName: string;
}

interface EmployeeTimesheet {
  id: number;
  comment: string;
  date: string;
  effort: number;
  employeeId: number;
  project: string;
  task: string;
  teamMember: string;
  taskType: string;
}

@Component({
  standalone: true,
  selector: 'app-employee-home',
  imports: [CommonModule, RouterModule, NotificationButtonComponent],
  templateUrl: './employee-home.component.html',
  styleUrls: ['./employee-home.component.css']
})
export class EmployeeHomeComponent implements OnInit {
  currentDate = new Date();
  userName: string = '';
  
  weeklyHours = 0;
  completedTasks = 0;
  activeProjects = 0;
  showMenu = false;
  notifications: Notification[] = [];
  managerAssignments: ManagerAssignment[] = [];
  employeeTimesheets: EmployeeTimesheet[] = [];
  assignedProjects: number = 0;

  constructor(
    private service: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  userEmail: string | null = null;
  userId: number = 0;
  private isDataLoaded = false; // Add flag to prevent multiple loads
  private isInitializing = false; // Add flag to prevent concurrent initialization

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeUserData();
    }
  }

  private initializeUserData(): void {
    if (this.isInitializing) return;
    this.isInitializing = true;

    // Check for fresh login data first
    const loginResponse = localStorage.getItem('loginResponse');
    if (loginResponse) {
      try {
        const response = JSON.parse(loginResponse);
        console.log('Found fresh login response:', response);
        
        // Store the fresh data
        if (response.email) {
          this.userEmail = response.email;
          localStorage.setItem('userEmail', response.email);
        }
        if (response.id) {
          this.userId = response.id;
          localStorage.setItem('userId', response.id.toString());
        }
        
        // Clear the login response after using it
        localStorage.removeItem('loginResponse');
        
        // Load user data directly if we have both email and ID
        if (this.userEmail && this.userId) {
          this.getUserByEmail();
          this.isInitializing = false;
          return;
        }
      } catch (error) {
        console.error('Error parsing login response:', error);
      }
    }

    // Fallback to existing logic
    this.userEmail = localStorage.getItem('userEmail');
    const storedUserId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    // If no email but we have a token, extract email from token
    if (!this.userEmail && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.userEmail = payload.sub || payload.email;
        if (this.userEmail) {
          localStorage.setItem('userEmail', this.userEmail);
          console.log('Email extracted from token and stored:', this.userEmail);
        }
      } catch (error) {
        console.error('Error extracting email from token:', error);
      }
    }

    if (!this.userEmail) {
      console.error('Email utilisateur manquant');
      this.isInitializing = false;
      return;
    }

    if (storedUserId !== null) {
      const parsedUserId = Number(storedUserId);
      if (!isNaN(parsedUserId)) {
        this.userId = parsedUserId;
        this.getUserByEmail();
      } else {
        console.error('ID utilisateur invalide dans le localStorage');
        this.getUserByEmail();
      }
    } else {
      console.log('ID utilisateur manquant, retrieving from email');
      this.getUserByEmail();
    }
    
    this.isInitializing = false;
  }

  loadUserData(): void {
    if (this.isDataLoaded) {
      console.log('Data already loaded, skipping...');
      return;
    }
    
    console.log('Loading user data - UserName:', this.userName, 'UserId:', this.userId);
    this.isDataLoaded = true;
    
    this.loadManagerAssignments();
    this.loadEmployeeTimesheets();
  }

  // Change method to get current week date range instead of upcoming week
  getCurrentWeekRange(): { start: string; end: string } {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    
    // Calculate days to Monday of current week (0 = Sunday, 1 = Monday, etc.)
    const daysToMonday = currentDayOfWeek === 0 ? -6 : -(currentDayOfWeek - 1);
    
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() + daysToMonday);
    
    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    return {
      start: formatDate(currentMonday),
      end: formatDate(currentSunday)
    };
  }

  getUserByEmail(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.userEmail) {
        console.error("Aucun email utilisateur disponible.");
        return;
      }

      this.service.getUserByEmail(this.userEmail).subscribe({
        next: (user) => {
          this.userName = user.firstname + ' ' + user.lastname;
          this.userId = user.id;
          
          // Store user info in localStorage for future use
          localStorage.setItem('userId', this.userId.toString());
          localStorage.setItem('userName', this.userName);
          
          console.log("Informations utilisateur récupérées:", this.userName, this.userId);
          
          // Now load the user data
          this.loadUserData();
        },
        error: (err) => {
          console.error("Erreur lors de la récupération des informations utilisateur", err);
          this.isDataLoaded = false; // Reset flag on error
        }
      });
    }
  }

  loadManagerAssignments(): void {
    if (!this.userName) {
      console.error('Cannot load manager assignments: userName is empty');
      return;
    }
    
    const currentWeek = this.getCurrentWeekRange();
    console.log('Loading manager assignments for:', this.userName, 'current week:', currentWeek);
    
    this.service.getManagerAssignmentsForEmployee(this.userName).subscribe({
      next: data => {
        console.log('All manager assignments:', data);
        
        // Filter assignments for current week only
        const currentWeekAssignments = data.filter((item: any) => {
          const assignmentDate = item.assignmentDate || item.date;
          if (!assignmentDate) return false;
          
          return assignmentDate >= currentWeek.start && assignmentDate <= currentWeek.end;
        });
        
        console.log('Filtered current week assignments:', currentWeekAssignments);
        
        this.managerAssignments = currentWeekAssignments.map((item: any) => ({
          id: item.id,
          date: item.assignmentDate || item.date,
          note: item.note || '-',
          project: item.project,
          task: item.task,
          teamMember: item.teamMember,
          typeStaffing: item.typeStaffing,
          taskType: item.taskType || 'Non spécifié',
          plannedHours: item.plannedHours || 0,
          priority: item.priority || 'Non spécifié',
          managerName: item.managerName || item.assignedBy || 'Non spécifié'
        }));
        
        this.assignedProjects = new Set(currentWeekAssignments.map((item: any) => item.project)).size;
        console.log('Manager assignments loaded:', this.managerAssignments.length, 'assignments');
      },
      error: err => {
        console.error('Erreur lors du chargement des missions assignées:', err);
      }
    });
  }

  loadEmployeeTimesheets(): void {
    if (!this.userId) {
      console.error('Cannot load employee timesheets: userId is 0');
      return;
    }
    
    const currentWeek = this.getCurrentWeekRange();
    console.log('Loading employee timesheets for userId:', this.userId, 'current week:', currentWeek);
    
    this.service.searchEmployeeTimesheets(this.userId, currentWeek.start, currentWeek.end).subscribe({
      next: (data: any[]) => {
    console.log('Current week employee timesheets:', data);
    this.employeeTimesheets = data.map((item: any) => {
        // Format the date if it's a valid [day, month, year] array
        const formattedDate = Array.isArray(item.date) && item.date.length === 3
            ? item.date
                .map((val: any, i: number) => 
                    i < 2 ? String(val).padStart(2, '0') : String(val) // Pad day/month to 2 digits
                )
                .join('-') // Join with hyphens
            : item.date; // Fallback to original if invalid

        return {
            ...item,
            taskType: item.taskType || 'Non spécifié',
            date: formattedDate // Use the formatted date
        };
    });

        
        this.weeklyHours = data.reduce((sum: number, entry: any) => sum + (entry.effort || 0), 0);
        this.completedTasks = new Set(data.map((entry: any) => entry.task)).size;
        this.activeProjects = new Set(data.map((entry: any) => entry.project)).size;
        console.log('Employee timesheets loaded:', data.length, 'entries');
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des feuilles de temps:', err);
        // If no data for current week, reset to empty arrays
        this.employeeTimesheets = [];
        this.weeklyHours = 0;
        this.completedTasks = 0;
        this.activeProjects = 0;
      }
    });
  }

  getGreeting(): string {
    const hours = this.currentDate.getHours();
    if (hours < 12) return 'Bonjour';
    if (hours < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }

  getUserInitials(): string {
    return this.userName.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  toggleUserMenu(): void {
    this.showMenu = !this.showMenu;
  }

  markAllRead(): void {
    this.notifications.forEach(notif => notif.read = true);
  }

  refreshData(): void {
    console.log('Refreshing data...');
    this.isDataLoaded = false; // Reset the flag to allow reload
    this.loadUserData();
  }

  formatNotificationDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
           ' • ' + 
           date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
}