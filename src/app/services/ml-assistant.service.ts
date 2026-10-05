import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// Define interfaces for ML Assistant responses
export interface EmployeeAnalysisDTO {
  managerId: number;
  analysisDate: string;
  periodDays: number;
  totalEmployees: number;
  activeEmployees: number;
  averageProductivity: number;
  productivityScores: { [key: string]: number };
  topPerformers: EmployeeMetricDTO[];
  underPerformers: EmployeeMetricDTO[];
  projectProgress: { [key: string]: number };
  trends: { [key: string]: any };
  insights: string[];
  teamSize: number;
  performanceMetrics: { [key: number]: number };
  performanceRatings: { [key: number]: string };
  productivityTrends: { [key: number]: number };
}

export interface EmployeeMetricDTO {
  employeeName: string;
  score: number;
  metrics: { [key: string]: any };
}

export interface ChatResponseDTO {
  response: string;
  queryType: string;
  confidence: number;
  data: { [key: string]: any };
  timestamp: string;
  suggestions: string[];
}

export interface ChatRequestDTO {
  query: string;
  managerId?: number;
  context?: string;
}

export interface AssistantRecommendationsDTO {
  managerId: number;
  recommendations: string[];
  priority: string;
  metrics: { [key: string]: any };
  actionableItems: string[];
  actionItems: string[];
  estimatedImpact: number;
  generatedAt: string;
  implementationTimeline: string;
  categories: string[];
}

export interface ProjectStatusDTO {
  projectName: string;
  status: string;
  completion: number;
  delayRisk: number;
  teamMembers: string[];
  estimatedCompletion: string;
}

export interface WorkloadDistributionDTO {
  managerId: number;
  teamWorkload: { [key: string]: number };
  averageWorkload: number;
  overloadedEmployees: string[];
  underutilizedEmployees: string[];
  recommendations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MlAssistantService {
  private baseUrl = 'http://localhost:8081/api/assistant';

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

  private getCurrentManagerId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const userId = localStorage.getItem('userId');
      return userId ? parseInt(userId) : null;
    }
    return null;
  }

  analyzeEmployees(managerId?: number, days: number = 30): Observable<EmployeeAnalysisDTO> {
    const headers = this.getAuthHeaders();
    const currentManagerId = managerId || this.getCurrentManagerId();
    
    let params = new HttpParams().set('days', days.toString());
    if (currentManagerId) {
      params = params.set('managerId', currentManagerId.toString());
    }

    return this.http.get<EmployeeAnalysisDTO>(`${this.baseUrl}/analyze-employees`, { 
      headers, 
      params 
    }).pipe(
      catchError(error => {
        console.error('Error analyzing employees:', error);
        return throwError(() => error);
      })
    );
  }

  processQuery(request: ChatRequestDTO): Observable<ChatResponseDTO> {
    const headers = this.getAuthHeaders();
    const requestWithManagerId = {
      ...request,
      managerId: request.managerId || this.getCurrentManagerId()
    };

    return this.http.post<ChatResponseDTO>(`${this.baseUrl}/chat`, requestWithManagerId, { 
      headers 
    }).pipe(
      catchError(error => {
        console.error('Error processing chat query:', error);
        return throwError(() => error);
      })
    );
  }

  getRecommendations(managerId?: number): Observable<AssistantRecommendationsDTO> {
    const headers = this.getAuthHeaders();
    const currentManagerId = managerId || this.getCurrentManagerId();
    
    let params = new HttpParams();
    if (currentManagerId) {
      params = params.set('managerId', currentManagerId.toString());
    }

    return this.http.get<AssistantRecommendationsDTO>(`${this.baseUrl}/recommendations`, { 
      headers, 
      params 
    }).pipe(
      catchError(error => {
        console.error('Error getting recommendations:', error);
        return throwError(() => error);
      })
    );
  }

  getMetrics(managerId?: number, days: number = 7): Observable<{ [key: string]: any }> {
    const headers = this.getAuthHeaders();
    const currentManagerId = managerId || this.getCurrentManagerId();
    
    let params = new HttpParams().set('days', days.toString());
    if (currentManagerId) {
      params = params.set('managerId', currentManagerId.toString());
    }

    return this.http.get<{ [key: string]: any }>(`${this.baseUrl}/metrics`, { 
      headers, 
      params 
    }).pipe(
      catchError(error => {
        console.error('Error getting metrics:', error);
        return throwError(() => error);
      })
    );
  }

  getProjectStatus(projectName?: string): Observable<ProjectStatusDTO> {
    const headers = this.getAuthHeaders();
    
    let params = new HttpParams();
    if (projectName) {
      params = params.set('projectName', projectName);
    }

    return this.http.get<ProjectStatusDTO>(`${this.baseUrl}/projects/status`, { 
      headers, 
      params 
    }).pipe(
      catchError(error => {
        console.error('Error getting project status:', error);
        return throwError(() => error);
      })
    );
  }

  getWorkloadDistribution(managerId?: number): Observable<WorkloadDistributionDTO> {
    const headers = this.getAuthHeaders();
    const currentManagerId = managerId || this.getCurrentManagerId();
    
    let params = new HttpParams();
    if (currentManagerId) {
      params = params.set('managerId', currentManagerId.toString());
    }

    return this.http.get<WorkloadDistributionDTO>(`${this.baseUrl}/workload/distribution`, { 
      headers, 
      params 
    }).pipe(
      catchError(error => {
        console.error('Error getting workload distribution:', error);
        return throwError(() => error);
      })
    );
  }

  getDelayedProjects(): Observable<ProjectStatusDTO[]> {
    const headers = this.getAuthHeaders();

    return this.http.get<ProjectStatusDTO[]>(`${this.baseUrl}/delayed-projects`, { 
      headers 
    }).pipe(
      catchError(error => {
        console.error('Error getting delayed projects:', error);
        return throwError(() => error);
      })
    );
  }

  private transformEmployeeAnalysis(response: any): AnalysisResponse {
    console.log('Raw ML Assistant response:', response);
    
    // Handle the actual ML Assistant response structure
    const topPerformers = (response.topPerformers || []).map((emp: any) => ({
      employeeName: emp.employeeName || emp.name || 'Unknown',
      productivity: emp.score || 0,
      tasksCompleted: emp.metrics?.tasksCompleted || 0,
      hoursWorked: emp.metrics?.totalHours || 0,
      score: emp.score || 0
    }));

    const underPerformers = (response.underPerformers || []).map((emp: any) => ({
      employeeName: emp.employeeName || emp.name || 'Unknown',
      productivity: emp.score || 0,
      tasksCompleted: emp.metrics?.tasksCompleted || 0,
      hoursWorked: emp.metrics?.totalHours || 0,
      score: emp.score || 0
    }));

    // Create workload distribution from performance metrics if available
    let workloadDistribution = [];
    if (response.performanceMetrics && Object.keys(response.performanceMetrics).length > 0) {
      workloadDistribution = Object.entries(response.performanceMetrics).map(([employeeId, hours]: [string, any]) => ({
        employeeName: `Employee ${employeeId}`,
        hoursThisWeek: hours || 0,
        tasksAssigned: Math.floor((hours || 0) / 8),
        status: this.determineWorkloadStatus(hours || 0, response.averageProductivity * 40 || 40)
      }));
    }

    // Create project insights from project progress
    const projectInsights = response.projectProgress ? 
      this.transformProjectInsights(response.projectProgress) : [];

    return {
      topPerformers,
      underPerformers,
      workloadDistribution,
      projectInsights,
      delayedProjects: [],
      metrics: {
        totalEmployees: response.teamSize || response.totalEmployees || 0,
        activeProjects: Object.keys(response.projectProgress || {}).length,
        averageProductivity: response.averageProductivity || 0,
        teamProductivity: response.averageProductivity || 0
      }
    };
  }
}
