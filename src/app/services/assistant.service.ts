import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface EmployeePerformance {
  employeeName: string;
  productivity: number;
  tasksCompleted: number;
  hoursWorked: number;
  score: number;
}

export interface WorkloadData {
  employeeName: string;
  hoursThisWeek: number;
  tasksAssigned: number;
  status: 'overloaded' | 'balanced' | 'underutilized';
}

export interface ProjectInsight {
  projectName: string;
  completionPercentage: number;
  status: string;
  assignedEmployees: string[];
  estimatedCompletion: string;
  riskFactors: string[];
  teamSize?: number;
}

export interface DelayedProject {
  projectName: string;
  completionPercentage: number;
  assignedTo: string;
  daysDelayed: number;
  status: string;
}

export interface ChatMessage {
  content: string;
  isUser: boolean;
  timestamp: Date;
  type?: 'text' | 'insight' | 'chart' | 'suggestion';
  data?: any;
}

export interface AnalysisResponse {
  topPerformers: EmployeePerformance[];
  underPerformers: EmployeePerformance[];
  workloadDistribution: WorkloadData[];
  projectInsights: ProjectInsight[];
  delayedProjects: DelayedProject[];
  metrics: {
    totalEmployees: number;
    activeProjects: number;
    averageProductivity: number;
    teamProductivity: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  private baseUrl = 'http://localhost:8081/api';

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

  // Get employee analysis
  analyzeEmployees(days: number = 30): Observable<AnalysisResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.baseUrl}/assistant/analyze-employees?days=${days}`, { headers }).pipe(
      map(response => this.transformEmployeeAnalysis(response)),
      catchError(error => {
        console.error('Error analyzing employees:', error);
        return of(this.getMockAnalysis());
      })
    );
  }

  // Chat with assistant
  chat(query: string): Observable<ChatMessage> {
    const headers = this.getAuthHeaders();
    const requestBody = {
      query: query,
      managerId: this.getCurrentManagerId(),
      context: 'employee_management'
    };

    return this.http.post<any>(`${this.baseUrl}/assistant/chat`, requestBody, { headers }).pipe(
      map(response => ({
        content: response.response,
        isUser: false,
        timestamp: new Date(),
        type: this.determineMessageType(response.data?.type),
        data: response.data
      })),
      catchError(error => {
        console.error('Error in chat:', error);
        return of({
          content: "Je rencontre des difficultés techniques. Veuillez réessayer plus tard.",
          isUser: false,
          timestamp: new Date(),
          type: 'text' as const
        });
      })
    );
  }

  // Get performance metrics
  getPerformanceMetrics(days: number = 7): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.baseUrl}/assistant/metrics?days=${days}`, { headers }).pipe(
      catchError(error => {
        console.error('Error getting metrics:', error);
        return of(this.getMockMetrics());
      })
    );
  }

  // Get workload distribution
  getWorkloadDistribution(): Observable<WorkloadData[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.baseUrl}/assistant/workload/distribution`, { headers }).pipe(
      map(response => this.transformWorkloadData(response)),
      catchError(error => {
        console.error('Error getting workload distribution:', error);
        return of(this.getMockWorkloadData());
      })
    );
  }

  // Get delayed projects
  getDelayedProjects(): Observable<DelayedProject[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.baseUrl}/assistant/delayed-projects`, { headers }).pipe(
      map(response => this.transformDelayedProjects(response)),
      catchError(error => {
        console.error('Error getting delayed projects:', error);
        return of(this.getMockDelayedProjects());
      })
    );
  }

  // Get recommendations
  getRecommendations(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<any>(`${this.baseUrl}/assistant/recommendations`, { headers }).pipe(
      catchError(error => {
        console.error('Error getting recommendations:', error);
        return of(this.getMockRecommendations());
      })
    );
  }

  // Helper methods
  private getCurrentManagerId(): number | null {
    if (isPlatformBrowser(this.platformId)) {
      const userId = localStorage.getItem('userId');
      return userId ? parseInt(userId) : null;
    }
    return null;
  }

  private determineMessageType(type?: string): 'text' | 'insight' | 'chart' | 'suggestion' {
    switch (type) {
      case 'top_performers':
      case 'productivity':
      case 'workload':
        return 'insight';
      case 'completion_time':
      case 'resource_needs':
        return 'chart';
      case 'project_delays':
        return 'suggestion';
      default:
        return 'text';
    }
  }

  private transformEmployeeAnalysis(response: any): AnalysisResponse {
    return {
      topPerformers: (response.topPerformers || []).map((emp: any) => ({
        employeeName: emp.employeeName,
        productivity: emp.score,
        tasksCompleted: emp.metrics?.tasksCompleted || 0,
        hoursWorked: emp.metrics?.totalHours || 0,
        score: emp.score
      })),
      underPerformers: (response.underPerformers || []).map((emp: any) => ({
        employeeName: emp.employeeName,
        productivity: emp.score,
        tasksCompleted: emp.metrics?.tasksCompleted || 0,
        hoursWorked: emp.metrics?.totalHours || 0,
        score: emp.score
      })),
      workloadDistribution: this.transformWorkloadFromScores(response.productivityScores || {}),
      projectInsights: this.transformProjectInsights(response.projectProgress || {}),
      delayedProjects: [],
      metrics: {
        totalEmployees: response.totalEmployees || 0,
        activeProjects: Object.keys(response.projectProgress || {}).length,
        averageProductivity: response.averageProductivity || 0,
        teamProductivity: response.averageProductivity || 0
      }
    };
  }

  private transformWorkloadData(response: any): WorkloadData[] {
    if (!response.workloadByEmployee) return [];
    
    return Object.entries(response.workloadByEmployee).map(([name, hours]: [string, any]) => ({
      employeeName: name,
      hoursThisWeek: hours,
      tasksAssigned: Math.floor(hours / 8),
      status: this.determineWorkloadStatus(hours, response.averageWorkload)
    }));
  }

  private transformWorkloadFromScores(scores: any): WorkloadData[] {
    return Object.entries(scores).map(([name, productivity]: [string, any]) => ({
      employeeName: name,
      hoursThisWeek: productivity * 8, // Estimate hours from productivity
      tasksAssigned: Math.floor(productivity),
      status: this.determineWorkloadStatus(productivity * 8, 40)
    }));
  }

  private determineWorkloadStatus(hours: number, average: number): 'overloaded' | 'balanced' | 'underutilized' {
    if (hours > average * 1.2) return 'overloaded';
    if (hours < average * 0.8) return 'underutilized';
    return 'balanced';
  }

  private transformProjectInsights(projectProgress: any): ProjectInsight[] {
    return Object.entries(projectProgress).map(([name, progress]: [string, any]) => ({
      projectName: name,
      completionPercentage: Math.round(progress * 100),
      status: progress > 0.8 ? 'ON_TRACK' : progress > 0.5 ? 'ACTIVE' : 'DELAYED',
      assignedEmployees: [],
      estimatedCompletion: new Date(Date.now() + (1 - progress) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      riskFactors: progress < 0.5 ? ['Low completion rate'] : [],
      teamSize: Math.floor(Math.random() * 5) + 1
    }));
  }

  private transformDelayedProjects(response: any[]): DelayedProject[] {
    return (response || []).map(project => ({
      projectName: project.projectName,
      completionPercentage: project.completionPercentage,
      assignedTo: project.assignedEmployees?.join(', ') || 'Non assigné',
      daysDelayed: Math.max(0, Math.floor((new Date().getTime() - new Date(project.estimatedCompletion).getTime()) / (1000 * 60 * 60 * 24))),
      status: project.status
    }));
  }

  // Mock data methods for fallback
  private getMockAnalysis(): AnalysisResponse {
    return {
      topPerformers: [
        { employeeName: 'John Doe', productivity: 0.95, tasksCompleted: 15, hoursWorked: 160, score: 0.95 },
        { employeeName: 'Jane Smith', productivity: 0.88, tasksCompleted: 12, hoursWorked: 155, score: 0.88 }
      ],
      underPerformers: [
        { employeeName: 'Bob Johnson', productivity: 0.45, tasksCompleted: 5, hoursWorked: 120, score: 0.45 }
      ],
      workloadDistribution: this.getMockWorkloadData(),
      projectInsights: [
        {
          projectName: 'Projet A',
          completionPercentage: 75,
          status: 'ON_TRACK',
          assignedEmployees: ['John Doe', 'Jane Smith'],
          estimatedCompletion: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          riskFactors: [],
          teamSize: 2
        }
      ],
      delayedProjects: this.getMockDelayedProjects(),
      metrics: {
        totalEmployees: 5,
        activeProjects: 3,
        averageProductivity: 0.72,
        teamProductivity: 0.72
      }
    };
  }

  private getMockWorkloadData(): WorkloadData[] {
    return [
      { employeeName: 'John Doe', hoursThisWeek: 45, tasksAssigned: 6, status: 'overloaded' },
      { employeeName: 'Jane Smith', hoursThisWeek: 40, tasksAssigned: 5, status: 'balanced' },
      { employeeName: 'Bob Johnson', hoursThisWeek: 25, tasksAssigned: 3, status: 'underutilized' }
    ];
  }

  private getMockDelayedProjects(): DelayedProject[] {
    return [
      {
        projectName: 'Projet B',
        completionPercentage: 30,
        assignedTo: 'Bob Johnson',
        daysDelayed: 5,
        status: 'DELAYED'
      }
    ];
  }

  private getMockMetrics(): any {
    return {
      totalHours: 200,
      averageHoursPerDay: 8,
      activeEmployees: 5,
      completedTasks: 25,
      activeProjects: 3,
      productivityTrend: 'IMPROVING',
      topProject: 'Projet A',
      averageTaskDuration: 8
    };
  }

  private getMockRecommendations(): any {
    return {
      recommendations: [
        'Rééquilibrer la charge de travail',
        'Augmenter le suivi des projets retardés',
        'Organiser des formations pour améliorer la productivité'
      ],
      priority: 'MEDIUM',
      estimatedImpact: 0.7
    };
  }
}
