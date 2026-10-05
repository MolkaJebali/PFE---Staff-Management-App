import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserService } from '../user.service';
import * as XLSX from 'xlsx';

interface TimesheetEntry {
  task: string;
  project: string;
  date: string;
  hours: number;
  comment: string;
  taskType?: string;
}

interface Timesheet {
  id: number;
  employee: string;
  week: string;
  entries: TimesheetEntry[];
}

@Component({
  selector: 'app-missions',
  standalone: true,
  templateUrl: './manager-suivi.component.html',
  styleUrl: './manager-suivi.component.css',
  imports: [CommonModule, FormsModule, RouterModule]
})
export class ManagerSuiviComponent implements OnInit {
  allTimesheets: Timesheet[] = [];
  projects: string[] = [];
  selectedProject: string = '';
  searchTerm: string = '';
  selectedTimesheet: Timesheet | null = null;
  showFeaturesDropdown = false;
  loading = false;
  error = '';
  
  // Add new properties for week selection
  availableWeeks: string[] = [];
  selectedWeek: string = '';
  
  private usingDemoData = false;
  private requestInProgress = false;
  private dataLoadAttempts = 0;
  private maxRetries = 3;
  private currentWeekStart: string;

  constructor(
    private userService: UserService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.currentWeekStart = this.getCurrentWeekStart();
  }

  ngOnInit(): void {
    this.loadTimesheets();
  }

  loadTimesheets(): void {
    if (this.requestInProgress || this.usingDemoData) {
      console.log('Request already in progress or using demo data, skipping...');
      return;
    }

    // Prevent excessive retries
    if (this.dataLoadAttempts >= this.maxRetries) {
      console.log('Max retry attempts reached, using demo data');
      this.loadDemoData();
      return;
    }

    this.loading = true;
    this.error = '';
    this.requestInProgress = true;
    this.dataLoadAttempts++;

    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      this.requestInProgress = false;
      return;
    }

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const email = localStorage.getItem('userEmail');
    let managerName = localStorage.getItem('userName') || localStorage.getItem('userFullName') || '';

    // Try to get manager name from email if not available
    if (!managerName && email) {
      this.userService.getUserByEmail(email).subscribe({
        next: (user) => {
          managerName = `${user.firstname} ${user.lastname}`;
          localStorage.setItem('userName', managerName);
          console.log('Manager name retrieved:', managerName);
        },
        error: (err) => console.warn('Could not retrieve manager name:', err)
      });
    }

    if (!token || !userId || !email) {
      console.warn('User authentication information missing.');
      this.error = 'Please log in again to access the data.';
      this.loading = false;
      this.requestInProgress = false;
      return;
    }

    console.log('Loading employee timesheets - Manager:', managerName);

    this.userService.getAllEmployeeTimesheets().subscribe({
      next: (data) => {
        console.log('Employee timesheets loaded successfully:', data);
        
        // Reset retry counter on successful load
        this.dataLoadAttempts = 0;

        if (!data || data.length === 0) {
          console.log('No employee timesheet data returned from API');
          this.allTimesheets = [];
          this.loading = false;
          this.requestInProgress = false;
          return;
        }

        // Process the data - group by employee and week
        const processedTimesheets = this.processEmployeeTimesheets(data, managerName);
        
        console.log('Processed timesheets:', processedTimesheets);
        
        this.allTimesheets = processedTimesheets;
        this.extractProjects();
        this.loading = false;
        this.requestInProgress = false;
      },
      error: (err) => {
        console.error('Error loading employee timesheets:', err);

        if (!this.usingDemoData && this.dataLoadAttempts < this.maxRetries) {
          console.log(`Retrying... (attempt ${this.dataLoadAttempts}/${this.maxRetries})`);
          this.requestInProgress = false;
          // Retry after a short delay
          setTimeout(() => this.loadTimesheets(), 1000);
          return;
        }

        if (!this.usingDemoData) {
          this.error = 'Error loading data. Demo data will be used.';
          this.loadDemoData();
        }

        this.loading = false;
        this.requestInProgress = false;
      }
    });
  }

  private processEmployeeTimesheets(rawData: any[], managerName: string): Timesheet[] {
    console.log('Processing raw employee timesheet data:', rawData);
    console.log('Manager name for filtering:', managerName);
    
    if (!rawData || rawData.length === 0) {
      return [];
    }

    // Group data by employee and week
    const groupedData = new Map<string, Map<string, any>>();

    rawData.forEach(entry => {
      console.log('Processing entry:', entry);
      
      // Skip entries without required data
      if (!entry.teamMember || !entry.date) {
        console.log('Skipping entry with missing teamMember or date:', entry);
        return;
      }

      // Skip manager's own entries (if any) - but be more flexible with matching
      if (entry.teamMember === managerName || 
          entry.teamMember.toLowerCase().includes(managerName.toLowerCase()) ||
          managerName.toLowerCase().includes(entry.teamMember.toLowerCase())) {
        console.log('Skipping manager entry:', entry.teamMember, 'Manager:', managerName);
        return;
      }

      const employee = entry.teamMember;
      const entryDate = new Date(entry.date);
      
      // Calculate week start (Monday)
      const dayOfWeek = entryDate.getDay();
      const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const weekStart = new Date(entryDate);
      weekStart.setDate(entryDate.getDate() + diffToMonday);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!groupedData.has(employee)) {
        groupedData.set(employee, new Map());
      }

      if (!groupedData.get(employee)!.has(weekKey)) {
        groupedData.get(employee)!.set(weekKey, []);
      }

      groupedData.get(employee)!.get(weekKey)!.push(entry);
    });

    console.log('Grouped data by employee:', groupedData);

    // Convert grouped data to Timesheet format
    const timesheets: Timesheet[] = [];
    let idCounter = 1;

    groupedData.forEach((weekMap, employee) => {
      console.log(`Processing employee: ${employee}, weeks: ${weekMap.size}`);
      weekMap.forEach((entries, week) => {
        const timesheet: Timesheet = {
          id: idCounter++,
          employee: employee,
          week: week,
          entries: entries.map((entry: any) => ({
            task: entry.task || 'No task specified',
            project: entry.project || 'No project specified',
            date: entry.date,
            hours: entry.effort || 0,
            comment: entry.comment || '',
            taskType: entry.taskType || 'Non spécifié'
          }))
        };
        timesheets.push(timesheet);
      });
    });

    console.log('Final processed timesheets:', timesheets);
    console.log('Total team members found:', groupedData.size);
    return timesheets;
  }

  loadDemoData(): void {
    this.usingDemoData = true;
    
    this.allTimesheets = [
      {
        id: 1,
        employee: 'Jean Dupont',
        week: '2023-11-06',
        entries: [
          {
            task: 'Développement fonctionnalité X',
            project: 'Projet Alpha',
            date: '2023-11-06',
            hours: 8,
            comment: 'Avancement sur le module principal',
            taskType: 'Développement' // Exemple de type de tâche
          },
          {
            task: 'Réunion équipe',
            project: 'Projet Alpha',
            date: '2023-11-07',
            hours: 2,
            comment: 'Point hebdomadaire',
            taskType: 'Réunion' // Exemple de type de tâche
          }
        ]
      },
      {
        id: 2,
        employee: 'Marie Martin',
        week: '2023-11-06',
        entries: [
          {
            task: 'Tests unitaires',
            project: 'Projet Beta',
            date: '2023-11-08',
            hours: 6,
            comment: 'Couverture 80% atteinte',
            taskType: 'Test' // Exemple de type de tâche
          }
        ]
      }
    ];
      
    this.extractProjects();
    console.log('Using demo data instead');
  }

  extractProjects(): void {
    const projectSet = new Set<string>();
    const weekSet = new Set<string>();
    
    this.allTimesheets.forEach(sheet => {
      // Add week to available weeks
      weekSet.add(sheet.week);
      
      sheet.entries.forEach(entry => {
        if (entry.project) {
          projectSet.add(entry.project);
        }
      });
    });
    
    this.projects = Array.from(projectSet).sort();
    this.availableWeeks = Array.from(weekSet).sort().reverse(); // Most recent first
    
    // Auto-select the most recent week if none selected
    if (this.availableWeeks.length > 0 && !this.selectedWeek) {
      this.selectedWeek = this.availableWeeks[0];
    }
  }

  private getCurrentWeekStart(): string {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diffToMonday);
    return weekStart.toISOString().split('T')[0];
  }

  get filteredTimesheets(): Timesheet[] {
    return this.allTimesheets.filter((sheet) => {
      // Filter by selected week (if any)
      const matchesWeek = this.selectedWeek === '' || sheet.week === this.selectedWeek;
      
      const matchesProject =
        this.selectedProject === '' ||
        sheet.entries.some(e => e.project === this.selectedProject);

      const searchTermLower = this.searchTerm.toLowerCase();
      const matchesSearch =
        this.searchTerm === '' ||
        sheet.employee.toLowerCase().includes(searchTermLower) ||
        sheet.entries.some(e =>
          e.task.toLowerCase().includes(searchTermLower) ||
          (e.comment && e.comment.toLowerCase().includes(searchTermLower)) ||
          (e.taskType && e.taskType.toLowerCase().includes(searchTermLower))
        );

      return matchesWeek && matchesProject && matchesSearch;
    });
  }

  selectSheet(sheet: Timesheet) {
    this.selectedTimesheet = sheet;
  }

  clearSelection() {
    this.selectedTimesheet = null;
  }

  exportToExcel(): void {
    const exportData: any[] = [];

    this.filteredTimesheets.forEach(timesheet => {
      timesheet.entries.forEach(entry => {
        exportData.push({
          Employé: timesheet.employee,
          Semaine: timesheet.week,
          Projet: entry.project,
          Tâche: entry.task,
          'Type de tâche': entry.taskType || 'Non spécifié', // Nouvelle colonne
          Date: entry.date,
          Heures: entry.hours,
          Commentaire: entry.comment || ''
        });
      });
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const workbook: XLSX.WorkBook = {
      Sheets: { 'Feuilles de temps': worksheet },
      SheetNames: ['Feuilles de temps']
    };

    XLSX.writeFile(workbook, 'feuilles_de_temps.xlsx');
  }

  validateSheet() {
    if (this.selectedTimesheet) {
      alert(`Feuille de temps de ${this.selectedTimesheet.employee} validée !`);
      // Implement validation functionality with API call
    }
  }

  refreshData(): void {
    console.log('Refreshing data...');
    this.usingDemoData = false;
    this.dataLoadAttempts = 0; // Reset retry counter
    this.allTimesheets = []; // Clear existing data
    this.loadTimesheets();
  }

  toggleFeaturesDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showFeaturesDropdown = !this.showFeaturesDropdown;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.features-dropdown-container');

    if (this.showFeaturesDropdown && dropdown && !dropdown.contains(target)) {
      this.showFeaturesDropdown = false;
    }
  }
}
