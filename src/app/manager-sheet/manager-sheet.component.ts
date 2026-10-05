import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserService } from '../user.service';
import { NotificationService } from '../services/notification.service';
import { NotificationButtonComponent } from '../shared/notification-button/notification-button.component';
import * as XLSX from 'xlsx';

interface Employee {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
}

@Component({
  standalone: true,
  selector: 'app-manager-sheet',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NotificationButtonComponent],
  templateUrl: './manager-sheet.component.html',
  styleUrls: ['./manager-sheet.component.css']
})
export class ManagerSheetComponent implements OnInit {
  showFeaturesDropdown = false;
  
  managerForm: FormGroup;
  priority: string[] = ['Moyenne', 'Haute', 'Basse'];
  taskTypes: string[] = ['Développement', 'Test', 'Analyse', 'Réunion', 'Documentation', 'Formation'];
  employees: Employee[] = [];
  isLoading = false;
  managerName = '';

  constructor(
    private fb: FormBuilder, 
    private UserService: UserService,
    private notificationService: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.managerForm = this.fb.group({ rows: this.fb.array([]) });
  }

  ngOnInit(): void {
    // Initialize user data from token first
    this.UserService.initializeUserFromToken();
    this.loadEmployees();
    this.getCurrentManagerName();
  }

  getCurrentManagerName(): void {
    if (isPlatformBrowser(this.platformId)) {
      const storedName = localStorage.getItem('userName');
      if (storedName) {
        this.managerName = storedName;
      } else {
        const userEmail = localStorage.getItem('userEmail');
        
        if (userEmail) {
          this.UserService.getUserByEmail(userEmail).subscribe({
            next: (user) => {
              this.managerName = `${user.firstname} ${user.lastname}`;
              localStorage.setItem('userName', this.managerName);
            },
            error: (err) => console.error('Error retrieving manager info:', err)
          });
        }
      }
    }
  }

  loadEmployees() {
    this.isLoading = true;
    this.UserService.getAllUsers().subscribe({
      next: (users) => {
        this.employees = users
          .filter(user => user.role === 'EMPLOYE')
          .map(user => ({
            id: user.id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
          }));
        this.isLoading = false;
        this.addRow();
      },
      error: (err) => {
        console.error('Error loading employees', err);
        this.isLoading = false;
        this.employees = [];
        this.addRow();
      }
    });
  }
  
  getFullName(employee: Employee): string {
    return `${employee.firstname} ${employee.lastname}`;
  }
  
  get rows(): FormArray {
    return this.managerForm.get('rows') as FormArray;
  }

  addRow(): void {
    const rowGroup = this.fb.group({
      collaborator: ['', Validators.required],
      project: ['', Validators.required],
      task: ['', Validators.required],
      taskType: ['', Validators.required],
      assignmentDate: ['', [Validators.required, this.futureDateValidator]],
      deadlineDate: ['', [Validators.required, this.futureDateValidator]],
      plannedHours: ['', [Validators.required, Validators.min(0), Validators.max(24)]],
      priority: ['', Validators.required],
      commentaire: ['']
    });
    this.rows.push(rowGroup);
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) this.rows.removeAt(index);
  }

  futureDateValidator(control: any) {
    const selected = new Date(control.value);
    const today = new Date();
    today.setHours(0,0,0,0);
    return selected >= today ? null : { pastDate: true };
  }

  submitManagerSheet(): void {
    // Check if user is authenticated before proceeding
    if (isPlatformBrowser(this.platformId)) {
      const userEmail = localStorage.getItem('userEmail');
      const token = localStorage.getItem('token');
      
      console.log('Checking authentication - Email:', userEmail, 'Token exists:', !!token);
      
      if (!userEmail && !token) {
        alert('Session expirée. Veuillez vous reconnecter.');
        window.location.href = '/';
        return;
      }
      
      // If we have token but no email, try to extract it
      if (!userEmail && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const extractedEmail = payload.sub || payload.email;
          if (extractedEmail) {
            localStorage.setItem('userEmail', extractedEmail);
            console.log('Email extracted from token and stored:', extractedEmail);
          }
        } catch (error) {
          console.error('Error extracting email from token:', error);
          alert('Erreur d\'authentification. Veuillez vous reconnecter.');
          window.location.href = '/';
          return;
        }
      }
    }

    if (this.managerForm.valid) {
      this.isLoading = true;
      const rawData = this.managerForm.value.rows;
      
      // Validate data
      for (const row of rawData) {
        if (!row.collaborator || row.collaborator.trim() === '') {
          alert('Veuillez sélectionner un employé pour chaque ligne');
          this.isLoading = false;
          return;
        }
        
        if (row.assignmentDate && row.deadlineDate) {
          const assignmentDate = new Date(row.assignmentDate);
          const deadlineDate = new Date(row.deadlineDate);
          
          if (deadlineDate <= assignmentDate) {
            alert('La date deadline doit être postérieure à la date d\'assignement');
            this.isLoading = false;
            return;
          }
        }
        
        if (row.collaborator === this.managerName) {
          if (!confirm('Voulez-vous vraiment vous assigner cette tâche à vous-même?')) {
            this.isLoading = false;
            return;
          }
        }
      }
      
      console.log('Submitting manager timesheet with payload:', rawData);
      
      this.UserService.submitManagerTimesheet(rawData).subscribe({
        next: (res) => {
          console.log('Réponse backend:', res);
          
          this.sendNotificationsToEmployees(rawData);
          
          alert('Feuille manager soumise avec succès !');
          this.isLoading = false;
          
          this.managerForm = this.fb.group({ rows: this.fb.array([]) });
          this.addRow();
        },
        error: (err) => {
          console.error('Error submitting timesheet:', err);
          this.isLoading = false;
          
          let errorMessage = 'Erreur lors de la soumission. ';
          
          if (err.message && err.message.includes('Email utilisateur introuvable')) {
            errorMessage = 'Session expirée ou informations utilisateur manquantes. Redirection vers la page de connexion...';
            alert(errorMessage);
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return;
          } else if (err.message && (err.message.includes('403') || err.message.includes('401'))) {
            errorMessage = 'Session expirée. Redirection vers la page de connexion...';
            alert(errorMessage);
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            return;
          } else {
            errorMessage += 'Veuillez réessayer.';
          }
          
          alert(errorMessage);
        }
      });
    } else {
      alert('Merci de remplir tous les champs requis');
      
      this.rows.controls.forEach(control => {
        if (control instanceof FormGroup) {
          Object.keys(control.controls).forEach(key => {
            const ctrl = control.get(key);
            if (ctrl) {
              ctrl.markAsTouched();
            }
          });
        }
      });
    }
  }

  private sendNotificationsToEmployees(assignments: any[]): void {
    // Check authentication before sending notifications
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found, skipping notifications');
        return;
      }
      
      // Ensure user data is available
      this.UserService.initializeUserFromToken();
    }

    let successCount = 0;
    let totalNotifications = assignments.length;

    assignments.forEach((assignment, index) => {
      // Find employee by name
      const employeeName = assignment.collaborator;
      const employee = this.employees.find(emp => 
        `${emp.firstname} ${emp.lastname}` === employeeName
      );

      if (employee) {
        console.log('Sending notification to employee:', employee);
        const notificationData = {
          userId: employee.id,
          message: `Vous avez été assigné(e) au projet "${assignment.project}" - Tâche: "${assignment.task}" par ${this.managerName}`,
          type: 'PROJECT_ASSIGNMENT',
          data: JSON.stringify({
            projectName: assignment.project,
            taskName: assignment.task,
            managerName: this.managerName,
            assignmentDate: assignment.assignmentDate,
            deadlineDate: assignment.deadlineDate,
            priority: assignment.priority
          })
        };

        this.notificationService.createNotification(notificationData).subscribe({
          next: (response) => {
            successCount++;
            console.log(`Notification sent successfully to ${employeeName}:`, response);
            
            // Show summary after last notification attempt
            if (index === totalNotifications - 1) {
              this.showNotificationSummary(successCount, totalNotifications);
            }
          },
          error: (err) => {
            console.error(`Error sending notification to ${employeeName}:`, err);
            
            // Show specific error handling for database issues
            if (err.error && err.error.includes && err.error.includes('Data truncated')) {
              console.warn('Database schema issue with notifications - notification service needs backend update');
            } else if (err.status === 403 || err.status === 401) {
              console.warn('Authentication issue with notifications - continuing without notification');
            }
            
            // Show summary after last notification attempt
            if (index === totalNotifications - 1) {
              this.showNotificationSummary(successCount, totalNotifications);
            }
          }
        });
      } else {
        console.error(`Employee not found: ${employeeName}`);
        console.log('Available employees:', this.employees);
        
        // Check if this was the last assignment
        if (index === totalNotifications - 1) {
          this.showNotificationSummary(successCount, totalNotifications);
        }
      }
    });
  }

  private showNotificationSummary(successCount: number, totalCount: number): void {
    if (successCount === totalCount && totalCount > 0) {
      console.log(`All ${totalCount} notifications sent successfully`);
    } else if (successCount > 0) {
      console.log(`${successCount} out of ${totalCount} notifications sent successfully`);
    } else if (totalCount > 0) {
      console.warn('No notifications were sent due to errors');
    }
  }

  exportToExcel(): void {
    const data = this.managerForm.value.rows.map((r: any) => ({
      'Collaborateur': r.collaborator,
      'Projet': r.project,
      'Tâche': r.task,
      'Type de tâche': r.taskType,
      'Date d\'assignement': new Date(r.assignmentDate).toLocaleDateString(),
      'Date Deadline': new Date(r.deadlineDate).toLocaleDateString(),
      'Heures Planifiées': r.plannedHours,
      'Priorité': r.priority,
      'Commentaire': r.commentaire
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Feuille Staffing');
    XLSX.writeFile(wb, 'feuille_manager.xlsx');
  }
  
  toggleFeaturesDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showFeaturesDropdown = !this.showFeaturesDropdown;
  }
  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.features-dropdown-container');
    
    if (this.showFeaturesDropdown && dropdown && !dropdown.contains(target)) {
      this.showFeaturesDropdown = false;
    }
  }
}