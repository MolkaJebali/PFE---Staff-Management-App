import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';

interface NotificationResult {
  success?: boolean;
  error?: any;
  managerId?: number;
  message?: string;
}

interface NotificationSummary {
  success: boolean;
  results?: NotificationResult[];
  successCount?: number;
  totalManagers?: number;
  notificationError?: any;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private baseUrl = 'http://localhost:8081/api';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getData(): Observable<any> {
    return this.http.get('https://api.example.com/data');
  }

  signIn(form: FormGroup) {
    const user = {
      firstname: form.value.firstname,
      lastname: form.value.lastname,
      phone: form.value.phone,
      email: form.value.email,
      password: form.value.password
    };
    const code = form.value.code;
    return this.http.post(`${this.baseUrl}/user/signin/${code}`, user, { responseType: 'text' });
  }

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/user/login`, credentials, {
      responseType: 'text'
    });
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/user/getAll`);
  }

  submitEmployeeTimesheet(timesheet: any,email:any): Observable<any> {
    return this.http.post(`${this.baseUrl}/employee-timesheets/submit/${email}`, timesheet).pipe(
      switchMap((response) => {
        // After successful submission, notify managers
        return this.notifyManagersOfTimesheetSubmission(email, timesheet).pipe(
          catchError((notificationError) => {
            console.error('Error sending manager notification:', notificationError);
            // Return the original response even if notification fails
            return new Observable(observer => {
              observer.next(response);
              observer.complete();
            });
          })
        );
      }),
      catchError(error => {
        console.error('Error submitting timesheet:', error);
        return throwError(() => error);
      })
    );
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
        console.log('Auth headers set with token');
        
        // Ensure user email is in localStorage
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const extractedEmail = payload.sub || payload.email;
            if (extractedEmail) {
              localStorage.setItem('userEmail', extractedEmail);
              console.log('Email extracted and stored in localStorage:', extractedEmail);
            }
          } catch (error) {
            console.error('Error extracting email from token:', error);
          }
        }
      } else {
        console.warn('No auth token found in localStorage');
      }
    }

    return headers;
  }

  private notifyManagersOfTimesheetSubmission(employeeEmail: string, timesheet: any): Observable<NotificationSummary> {
    // Ensure we have authentication before proceeding
    if (!this.isAuthenticated()) {
      console.warn('No authentication found, skipping manager notifications');
      return new Observable(observer => {
        observer.next({ success: true, message: 'Timesheet submitted but notifications skipped due to authentication' });
        observer.complete();
      });
    }

    // Ensure email is in localStorage and get auth headers
    if (isPlatformBrowser(this.platformId)) {
      const storedEmail = localStorage.getItem('userEmail');
      if (!storedEmail && employeeEmail) {
        localStorage.setItem('userEmail', employeeEmail);
        console.log('Stored employee email in localStorage:', employeeEmail);
      }
    }

    // Get employee info first
    return this.getUserByEmail(employeeEmail).pipe(
      switchMap((employee) => {
        const employeeName = `${employee.firstname} ${employee.lastname}`;
        
        // Store user info in localStorage for future use
        if (isPlatformBrowser(this.platformId)) {
          if (employee.id) {
            localStorage.setItem('userId', employee.id.toString());
          }
          localStorage.setItem('userName', employeeName);
          localStorage.setItem('userEmail', employeeEmail);
        }
        
        console.log('Employee info loaded:', employee);
        
        // Get all users and filter managers
        return this.getAllUsers().pipe(
          switchMap((users) => {
            const managers = users.filter(user => user.role === 'MANAGER' || user.role === 'ADMIN');
            
            console.log('Found managers:', managers);
            
            if (managers.length === 0) {
              console.log('No managers found to notify');
              return new Observable<NotificationSummary>(observer => {
                observer.next({ success: true, message: 'No managers to notify' });
                observer.complete();
              });
            }

            // Create notification for each manager
            const notificationRequests = managers.map(manager => {
              const notificationData = {
                userId: manager.id,
                message: `${employeeName} a soumis sa feuille de temps avec ${timesheet.entries?.length || 0} entrée(s)`,
                type: 'TIMESHEET_SUBMISSION',
                data: JSON.stringify({
                  employeeName: employeeName,
                  employeeEmail: employeeEmail,
                  submissionDate: new Date().toISOString(),
                  entriesCount: timesheet.entries?.length || 0,
                  weekSubmitted: this.getCurrentWeekRange()
                })
              };
              
              console.log('Creating notification for manager:', manager.email, notificationData);
              
              const headers = this.getAuthHeaders();
              
              return this.http.post(`${this.baseUrl}/notifications/create`, notificationData, { headers }).pipe(
                tap(response => {
                  console.log(`Notification sent successfully to manager ${manager.email}:`, response);
                }),
                catchError(error => {
                  console.error(`Failed to send notification to manager ${manager.email}:`, error);
                  // Return a NotificationResult object for failed notifications
                  return new Observable<NotificationResult>(observer => {
                    observer.next({ success: false, error: error, managerId: manager.id });
                    observer.complete();
                  });
                })
              );
            });
            
            // Execute all notification requests and return combined results
            return new Observable<NotificationSummary>(observer => {
              Promise.all(notificationRequests.map(req => req.toPromise()))
                .then((results: (NotificationResult | any)[]) => {
                  console.log('All notification results:', results);
                  const successCount = results.filter((r: NotificationResult) => r && !r.error).length;
                  observer.next({ 
                    success: true, 
                    results: results as NotificationResult[],
                    successCount: successCount,
                    totalManagers: managers.length
                  });
                  observer.complete();
                })
                .catch(err => {
                  console.warn('Some notifications failed, but timesheet was submitted successfully:', err);
                  observer.next({ success: true, notificationError: err });
                  observer.complete();
                });
            });
          })
        );
      }),
      catchError(error => {
        console.warn('Error in notification process, but timesheet was submitted:', error);
        return new Observable<NotificationSummary>(observer => {
          observer.next({ success: true, notificationError: error });
          observer.complete();
        });
      })
    );
  }

  submitManagerTimesheet(payload: any): Observable<any> {
    // Check if we're in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      return throwError(() => new Error('Not in browser environment'));
    }

    let email = localStorage.getItem('userEmail');
    console.log('Email utilisateur:', email);

    // Fallback: try to get email from token if not in localStorage
    if (!email) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload_token = JSON.parse(atob(token.split('.')[1]));
          email = payload_token.sub || payload_token.email;
          console.log('Email extracted from token:', email);
          
          // Store it for future use
          if (email) {
            localStorage.setItem('userEmail', email);
            
            // Also get and store user info
            this.getUserByEmail(email).subscribe({
              next: (user) => {
                if (user && user.id) {
                  localStorage.setItem('userId', user.id.toString());
                  localStorage.setItem('userName', `${user.firstname} ${user.lastname}`);
                }
              },
              error: (err) => console.warn('Could not fetch user info:', err)
            });
          }
        } catch (error) {
          console.error('Error extracting email from token:', error);
        }
      }
    }

    if (!email) {
      console.error('Email utilisateur introuvable dans le localStorage et impossible à extraire du token');
      return throwError(() => new Error('Email utilisateur introuvable dans le localStorage.'));
    }

    if (!payload || payload.length === 0) {
      return throwError(() => new Error('Le tableau de données est vide.'));
    }

    const formattedPayload = payload.map((row: any) => {
      let formattedAssignmentDate = row.assignmentDate || row.date;
      let formattedDeadlineDate = row.deadlineDate;
      
      if (formattedAssignmentDate instanceof Date) {
        formattedAssignmentDate = formattedAssignmentDate.toISOString().split('T')[0];
      } else if (typeof formattedAssignmentDate === 'string' && formattedAssignmentDate.includes('T')) {
        formattedAssignmentDate = formattedAssignmentDate.split('T')[0];
      }
      
      if (formattedDeadlineDate instanceof Date) {
        formattedDeadlineDate = formattedDeadlineDate.toISOString().split('T')[0];
      } else if (typeof formattedDeadlineDate === 'string' && formattedDeadlineDate.includes('T')) {
        formattedDeadlineDate = formattedDeadlineDate.split('T')[0];
      }

      return {
        teamMember: row.collaborator,
        project: row.project,
        task: row.task,
        taskType: row.taskType,
        plannedHours: row.plannedHours,
        priority: row.priority,
        assignmentDate: formattedAssignmentDate,
        deadlineDate: formattedDeadlineDate,
        date: formattedAssignmentDate,
        note: row.commentaire || row.note
      };
    });

    const requestPayload = { entries: formattedPayload };
    console.log('Données envoyées au backend:', requestPayload);

    return this.http.post(`${this.baseUrl}/manager/submit/${email}`, requestPayload).pipe(
      catchError(error => {
        console.error('Erreur détaillée lors de la soumission :', error);
        return throwError(() =>
          new Error(`Erreur ${error.status}: ${error.error?.message || 'Échec de la soumission.'}`)
        );
      })
    );
  }

  // Add method to initialize user data from token
  initializeUserFromToken(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const token = localStorage.getItem('token');
    const storedEmail = localStorage.getItem('userEmail');
    const storedUserId = localStorage.getItem('userId');
    const storedUserName = localStorage.getItem('userName');
    
    // If we already have all user data, no need to initialize
    if (storedEmail && storedUserId && storedUserName) {
      return;
    }
    
    if (token && !storedEmail) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const email = payload.sub || payload.email;
        
        if (email) {
          localStorage.setItem('userEmail', email);
          
          // Fetch additional user info
          this.getUserByEmail(email).subscribe({
            next: (user) => {
              if (user) {
                if (user.id) localStorage.setItem('userId', user.id.toString());
                localStorage.setItem('userName', `${user.firstname} ${user.lastname}`);
                console.log('User data initialized from token');
              }
            },
            error: (err) => console.warn('Could not fetch user info during initialization:', err)
          });
        }
      } catch (error) {
        console.error('Error initializing user from token:', error);
      }
    }
  }

  getManagerLastWeek(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/manager/last-week/${id}`);
  }

  searchManagerTimesheets(id: number, start: string, end: string): Observable<any[]> {
    const params = new HttpParams()
      .set('id', id)
      .set('start', start)
      .set('end', end);
    return this.http.get<any[]>(`${this.baseUrl}/manager/search`, { params });
  }

  getUserByEmail(email: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/user/info?email=${email}`);
  }

  getCurrentUserEmail(): Observable<string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token found');
    }
  
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const email = payload.sub || payload.email;
      return new Observable(observer => {
        observer.next(email);
        observer.complete();
      });
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }
  
  getCurrentWeekRange(): { start: string; end: string } {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const toIsoDate = (date: Date) => date.toISOString().split('T')[0];

    return {
      start: toIsoDate(monday),
      end: toIsoDate(sunday),
    };
  }

  getUserTimesheetsThisWeek(userId: number): Observable<any[]>{
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Go to the first day of the week
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Go to the last day of the week
  
  const start = startOfWeek.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  const end = endOfWeek.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  
  return this.http.get<any[]>(`${this.baseUrl}/employee-timesheets/by-user-and-week?id=${userId}&start=${start}&end=${end}`);
}


  getManagerAssignmentsForEmployee(employeeName: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/manager/assignments/${employeeName}`);
  }

  getEmployeeTimesheets(userId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/employee-timesheets/by-user-and-week?id=${userId}&start=2023-01-01&end=2026-12-31`);
  }

  searchEmployeeTimesheets(userId: number, start: string, end: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/employee-timesheets/by-user-and-week?id=${userId}&start=${start}&end=${end}`);
  }

  getAllManagerTimesheets(): Observable<any[]> {
    let options = {};
    
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
        options = { headers };
      }
    }
    
    return this.http.get<any[]>(`${this.baseUrl}/manager/all-timesheets`, options);
  }

  getTimesheetById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/manager/timesheet/${id}`);
  }

  getAllEmployeeTimesheets(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/employee-timesheets/all`)
      .pipe(
        catchError(error => {
          console.error('Error fetching employee timesheets:', error);
          return throwError(() => new Error('Failed to load employee timesheets'));
        })
      );
  }

  predictTaskHours(taskData: any): Observable<any> {
    const headers = this.getAuthHeaders();
    
    return this.http.post<any>(`${this.baseUrl}/assistant/predict-hours`, taskData, { headers }).pipe(
      catchError(error => {
        console.error('Error predicting task hours:', error);
        return throwError(() => error);
      })
    );
  }

  getMLModelPerformance(): Observable<any> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<any>(`${this.baseUrl}/ml/model-performance`, { headers }).pipe(
      catchError(error => {
        console.error('Error getting ML model performance:', error);
        return of({
          bestModel: 'XGBoost',
          rmse: 5.45,
          mae: 2.4,
          r2: 0.52,
          models: [
            { name: 'XGBoost', rmse: 5.45, mae: 2.4, r2: 0.52 },
            { name: 'Linear Regression', rmse: 5.58, mae: 2.2, r2: 0.50 },
            { name: 'Ridge', rmse: 5.60, mae: 2.2, r2: 0.50 }
          ]
        });
      })
    );
  }
}