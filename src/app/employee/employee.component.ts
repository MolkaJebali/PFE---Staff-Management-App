import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { UserService } from '../user.service';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { TokenInterceptor } from '../interceptors/token.interceptor';

@Component({
  standalone: true,
  selector: 'app-employee',
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TokenInterceptor,
      multi: true
    }
  ],
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css']
})
export class EmployeeComponent implements OnInit {
  timesheetForm: FormGroup;
  currentUserEmail: string | null = null;
  currentUserFullName: string = '';
  isSubmitting = false;
  taskTypes: string[] = ['Développement', 'Test', 'Analyse', 'Réunion', 'Documentation', 'Formation'];

  constructor(
    private fb: FormBuilder, 
    private service: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.timesheetForm = this.fb.group({
      rows: this.fb.array([])
    });
  }

  ngOnInit(): void {
    // Only access localStorage in browser environment
    if (isPlatformBrowser(this.platformId)) {
      // Ensure we have proper authentication
      this.currentUserEmail = localStorage.getItem('userEmail');
      
      // If no email in localStorage, try to extract from token
      if (!this.currentUserEmail) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            this.currentUserEmail = payload.sub || payload.email;
            if (this.currentUserEmail) {
              localStorage.setItem('userEmail', this.currentUserEmail);
              console.log('Email extracted from token and stored:', this.currentUserEmail);
            }
          } catch (error) {
            console.error('Error extracting email from token:', error);
          }
        }
      }

      if (!this.currentUserEmail) {
        alert("Aucun utilisateur connecté.");
        return;
      }

      this.service.getUserByEmail(this.currentUserEmail).subscribe({
        next: (user) => {
          this.currentUserFullName = user.firstname + ' ' + user.lastname;
          console.log("Nom complet récupéré du backend :", this.currentUserFullName);
          
          // Store user information for future use
          localStorage.setItem('userName', this.currentUserFullName);
          localStorage.setItem('userId', user.id?.toString() || '');
          
          this.addRow();
        },
        error: (err) => {
          console.error("Erreur lors de la récupération du nom de l'utilisateur", err);
          alert("Impossible de récupérer le nom de l'utilisateur.");
        }
      });
    } else {
      // In SSR environment, just add a row without authentication checks
      this.addRow();
    }
  }

  get rows(): FormArray {
    return this.timesheetForm.get('rows') as FormArray;
  }

  addRow(): void {
    const rowGroup = this.fb.group({
      teamMember: [{ value: this.currentUserFullName, disabled: true }, Validators.required],
      project: ['', Validators.required],
      task: ['', Validators.required],
      taskType: ['', Validators.required], // Nouveau champ ajouté
      date: ['', Validators.required],
      effort: [0, [Validators.required, Validators.min(0)]],
      comment: ['']
    });
    this.rows.push(rowGroup);
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.removeAt(index);
    }
  }

  getTotalEffort(): number {
    return this.rows.controls
      .map(ctrl => ctrl.get('effort')?.value || 0)
      .reduce((sum, val) => sum + Number(val), 0);
  }

  exportToExcel(): void {
    const data = this.rows.getRawValue().map((r: any) => ({
      TeamMember: this.currentUserFullName,
      Projet: r.project,
      Tâche: r.task,
      'Type de tâche': r.taskType, // Nouveau champ dans l'export
      Date: r.date,
      Heures: r.effort,
      Commentaire: r.comment
    }));
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Feuille de temps');
    XLSX.writeFile(wb, 'feuille_de_temps.xlsx');
  }

  submitTimesheet(): void {
    // Check if we're in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      alert('Cette fonctionnalité n\'est pas disponible côté serveur.');
      return;
    }

    if (!this.currentUserEmail) {
      alert('Utilisateur non authentifié.');
      return;
    }

    const timesheetPayload = {
      teamMember: this.currentUserEmail,
      entries: this.rows.getRawValue()
    };

    this.isSubmitting = true;

    this.service.submitEmployeeTimesheet(timesheetPayload, this.currentUserEmail).subscribe({
      next: () => {
        alert('Feuille de temps soumise avec succès !');
        this.timesheetForm.reset();
        this.rows.clear();
        this.addRow();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Erreur lors de la soumission', error);
        
        // Handle different types of errors
        if (error.notificationError) {
          alert('Feuille de temps soumise avec succès, mais les notifications aux managers ont échoué.');
        } else {
          alert('Échec de la soumission. Veuillez réessayer.');
        }
        
        this.isSubmitting = false;
      },
    });
  }
}