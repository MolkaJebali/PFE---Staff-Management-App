import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface PredictionRequestDTO {
  project: string;
  task: string;
  typeTask: string;
  priority: string;
  delayDays: number;
  comment: string;
}

export interface PredictionResponseDTO {
  status: string;
  predictedHours: number;
  confidence?: string;
  metadata?: { [key: string]: any };
  modelUsed?: string;
  rmse?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MlPredictionService {
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

  predictPlannedHours(request: PredictionRequestDTO): Observable<PredictionResponseDTO> {
    const headers = this.getAuthHeaders();

    return this.http.post<PredictionResponseDTO>(`${this.baseUrl}/ml/predict-hours`, request, { 
      headers 
    }).pipe(
      catchError(error => {
        console.error('Error predicting planned hours:', error);
        return throwError(() => error);
      })
    );
  }

  getModelPerformance(): Observable<any> {
    const headers = this.getAuthHeaders();

    return this.http.get<any>(`${this.baseUrl}/ml/model-performance`, { 
      headers 
    }).pipe(
      catchError(error => {
        console.error('Error getting model performance:', error);
        return throwError(() => error);
      })
    );
  }

  isMLServiceAvailable(): Observable<boolean> {
    const headers = this.getAuthHeaders();

    return this.http.get<boolean>(`${this.baseUrl}/ml/health`, { 
      headers 
    }).pipe(
      catchError(error => {
        console.error('ML service not available:', error);
        return throwError(() => false);
      })
    );
  }
}
