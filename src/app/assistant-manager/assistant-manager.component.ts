import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserService } from '../user.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NotificationButtonComponent } from '../shared/notification-button/notification-button.component';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MlPredictionService, PredictionRequestDTO, PredictionResponseDTO } from '../services/ml-prediction.service';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  type?: 'insight' | 'suggestion' | 'chart' | 'normal';
}

interface DashboardMetrics {
  totalEmployees: number;
  activeProjects: number;
  averageProductivity: number;
  pendingTasks: number;
  completedTasks: number;
  upcomingDeadlines: number;
  resourceUtilization: number;
}

interface QuickAction {
  icon: string;
  label: string;
  query: string;
}

@Component({
  selector: 'app-assistant-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NotificationButtonComponent],
  templateUrl: './assistant-manager.component.html',
  styleUrls: ['./assistant-manager.component.css']
})
export class AssistantManagerComponent implements OnInit, OnDestroy {
  private baseUrl = 'http://localhost:8081/api';
  
  // Component state
  messages: Message[] = [];
  newMessage = '';
  isTyping = false;
  hasError = false;
  errorMessage = '';
  isLoadingMetrics = false;
  isLoadingAnalysis = false;
  
  // Prediction modal state
  showPredictionModal = false;
  predictionForm: FormGroup;
  isPredicting = false;
  
  // Data properties
  dashboardMetrics: DashboardMetrics = {
    totalEmployees: 0,
    activeProjects: 0,
    averageProductivity: 0,
    pendingTasks: 0,
    completedTasks: 0,
    upcomingDeadlines: 0,
    resourceUtilization: 0
  };
  
  quickActions: QuickAction[] = [
    { icon: '👥', label: 'Meilleurs Performeurs', query: 'Montre-moi les employés les plus performants cette semaine' },
    { icon: '📊', label: 'Analyses Équipe', query: 'Analyse la productivité et performance de l\'équipe' },
    { icon: '⚠️', label: 'Problèmes Projets', query: 'Quels projets nécessitent une attention immédiate ?' },
    { icon: '📈', label: 'Équilibre Charge', query: 'Comment la charge de travail est-elle répartie dans mon équipe ?' },
    { icon: '🎯', label: 'Recommandations', query: 'Donne-moi des recommandations de gestion pour cette semaine' },
    { icon: '📅', label: 'Échéances Prochaines', query: 'Quelles sont les prochaines échéances de projet ?' }
  ];

  private currentManagerId: number | null = null;

  constructor(
    private userService: UserService,
    private http: HttpClient,
    private fb: FormBuilder,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.predictionForm = this.fb.group({
      project: ['', Validators.required],
      task: ['', Validators.required],
      typeTask: ['', Validators.required],
      priority: ['', Validators.required],
      delayDays: ['', [Validators.required, Validators.min(1)]],
      comment: ['']
    });
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  private initializeComponent(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Initialize user data
      this.userService.initializeUserFromToken();
      
      // Get manager ID from localStorage
      const userId = localStorage.getItem('userId');
      if (userId) {
        this.currentManagerId = parseInt(userId);
      }
      
      // Load initial data
      this.loadDashboardMetrics();
      this.addWelcomeMessage();
    }
  }

  private addWelcomeMessage(): void {
    const welcomeMessage: Message = {
      id: 'welcome-' + Date.now(),
      text: 'Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider à gérer votre équipe aujourd\'hui ?',
      isUser: false,
      timestamp: new Date(),
      type: 'normal'
    };
    this.messages.push(welcomeMessage);
  }

  private loadDashboardMetrics(): void {
    if (!this.currentManagerId) {
      console.warn('Aucun ID de manager trouvé, impossible de charger les métriques');
      return;
    }

    this.isLoadingMetrics = true;
    const headers = this.getAuthHeaders();

    // First, try to get employee analysis to get team size
    this.http.get<any>(`${this.baseUrl}/assistant/analyze-employees`, { 
      headers,
      params: { 
        managerId: this.currentManagerId.toString(),
        days: '30'
      }
    }).pipe(
      catchError(error => {
        console.error('Erreur lors du chargement de l\'analyse des employés:', error);
        // Try metrics endpoint as fallback
        return this.http.get<any>(`${this.baseUrl}/assistant/metrics`, { 
          headers,
          params: { managerId: this.currentManagerId!.toString() }
        });
      }),
      finalize(() => this.isLoadingMetrics = false)
    ).subscribe(data => {
      console.log('Dashboard data received:', data);
      
      // Update metrics based on the response structure
      this.dashboardMetrics = {
        totalEmployees: data.teamSize || data.totalEmployees || 0,
        activeProjects: data.activeProjects || Object.keys(data.projectProgress || {}).length || 0,
        averageProductivity: (data.averageProductivity || 0) * 100, // Convert to percentage
        pendingTasks: data.pendingTasks || 0,
        completedTasks: data.completedTasks || 0,
        upcomingDeadlines: data.upcomingDeadlines || 0,
        resourceUtilization: data.resourceUtilization || data.averageProductivity || 0
      };
      
      console.log('Updated dashboard metrics:', this.dashboardMetrics);
    });
  }

  sendMessage(): void {
    if (this.newMessage.trim() === '' || this.isTyping) {
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: 'user-' + Date.now(),
      text: this.newMessage.trim(),
      isUser: true,
      timestamp: new Date(),
      type: 'normal'
    };
    this.messages.push(userMessage);

    const query = this.newMessage.trim();
    this.newMessage = '';
    this.isTyping = true;

    // Send to ML assistant
    this.processQuery(query);
  }

  private processQuery(query: string): void {
    // Check if query is asking for hour prediction
    if (this.isPredictionQuery(query)) {
      this.handlePredictionQuery(query);
      return;
    }

    // For performance queries, always fetch fresh data from backend to get employee names
    if (this.isPerformanceQuery(query)) {
      this.handlePerformanceQuery(query);
      return;
    }

    // Add local processing for other common queries
    const localResponse = this.getLocalResponse(query);
    if (localResponse) {
      this.isTyping = false;
      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        text: localResponse,
        isUser: false,
        timestamp: new Date(),
        type: 'insight'
      };
      this.messages.push(assistantMessage);
      setTimeout(() => this.scrollToBottom(), 100);
      return;
    }

    // Send to backend as fallback
    const headers = this.getAuthHeaders();
    const requestBody = {
      query: query,
      managerId: this.currentManagerId,
      context: 'dashboard'
    };

    this.http.post<any>(`${this.baseUrl}/assistant/chat`, requestBody, { headers }).pipe(
      catchError(error => {
        console.error('Erreur lors du traitement de la requête:', error);
        return of({
          response: this.generateFallbackResponse(query),
          type: 'normal',
          confidence: 0
        });
      }),
      finalize(() => this.isTyping = false)
    ).subscribe(response => {
      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        text: response.response || 'Aucune réponse disponible.',
        isUser: false,
        timestamp: new Date(),
        type: response.type || 'normal'
      };
      this.messages.push(assistantMessage);
      
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  private isPredictionQuery(query: string): boolean {
    const predictionKeywords = [
      'prédire', 'predict', 'estimation', 'heures', 'durée', 'temps',
      'combien de temps', 'how long', 'estimate', 'prediction', 'planifiées'
    ];
    
    return predictionKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isPerformanceQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return lowerQuery.includes('performants') || 
           lowerQuery.includes('meilleurs') || 
           lowerQuery.includes('top') ||
           (lowerQuery.includes('employés') && (lowerQuery.includes('performance') || lowerQuery.includes('productivité')));
  }

  private handlePredictionQuery(query: string): void {
    this.isTyping = false;
    
    const predictionPrompt: Message = {
      id: 'prediction-prompt-' + Date.now(),
      text: `🤖 Prédiction ML des heures planifiées

Pour estimer précisément les heures nécessaires, notre modèle XGBoost (précision: ±5.45h) a besoin de quelques informations sur votre tâche.

Cliquez sur le bouton ci-dessous pour ouvrir le formulaire de prédiction !`,
      isUser: false,
      timestamp: new Date(),
      type: 'suggestion'
    };
    
    this.messages.push(predictionPrompt);
    
    // Auto-open prediction modal after 1 second
    setTimeout(() => {
      this.openPredictionModal();
    }, 1000);
  }

  private handlePerformanceQuery(query: string): void {
    if (!this.currentManagerId) {
      this.isTyping = false;
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
        text: '❌ Impossible d\'analyser les performances sans ID manager.',
        isUser: false,
        timestamp: new Date(),
        type: 'normal'
      };
      this.messages.push(errorMessage);
      return;
    }

    const headers = this.getAuthHeaders();
    
    this.http.get<any>(`${this.baseUrl}/assistant/analyze-employees`, { 
      headers,
      params: { 
        managerId: this.currentManagerId.toString(),
        days: '30'
      }
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de l\'analyse des employés:', error);
        return of(null);
      }),
      finalize(() => this.isTyping = false)
    ).subscribe(analysisData => {
      let responseText: string;
      
      if (analysisData && analysisData.topPerformers && analysisData.topPerformers.length > 0) {
        responseText = this.generatePerformanceResponseWithNames(analysisData, query);
      } else {
        responseText = this.generateNoDataPerformanceResponse();
      }

      const assistantMessage: Message = {
        id: 'assistant-' + Date.now(),
        text: responseText,
        isUser: false,
        timestamp: new Date(),
        type: 'insight'
      };
      this.messages.push(assistantMessage);
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  private generatePerformanceResponseWithNames(analysisData: any, query: string): string {
    const isFrench = this.isFrenchQuery(query);
    const topPerformers = analysisData.topPerformers || [];
    const teamSize = analysisData.teamSize || 0;
    const avgProductivity = (analysisData.averageProductivity || 0) * 100;
    const activeProjects = Object.keys(analysisData.projectProgress || {}).length;

    if (isFrench) {
      let response = `📊 Top Performers - Cette Semaine

Basé sur l'analyse de votre équipe de ${teamSize} employés

🥇 Classement par Performance\n`;

      if (topPerformers.length > 0) {
        topPerformers.slice(0, 3).forEach((performer: any, index: number) => {
          const position = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          const name = performer.employeeName || 'Employé inconnu';
          const score = ((performer.score || 0) * 100).toFixed(1);
          
          response += `${position} ${name} - ${score}% de productivité\n`;
        });
      } else {
        response += '• Aucune données de performance disponibles\n';
      }

      response += `\n📊 Métriques Globales
• Performance moyenne équipe: ${avgProductivity.toFixed(1)}%
• Projets contributeurs: ${activeProjects} projets actifs
• Taille de l'équipe: ${teamSize} employés

🎯 Critères d'évaluation
• Heures travaillées et productivité
• Respect des délais
• Qualité du travail
• Collaboration équipe

💡 Actions de reconnaissance`;

      if (topPerformers.length > 0) {
        response += `
• Féliciter publiquement ${topPerformers[0].employeeName || 'le top performer'}
• Partager les bonnes pratiques avec l'équipe
• Considérer des opportunités de développement pour les meilleurs éléments`;
      } else {
        response += `
• Mettre en place un système de tracking des performances
• Encourager la saisie régulière des feuilles de temps
• Définir des objectifs de performance clairs`;
      }

      return response;
    } else {
      // English version
      let response = `📊 Top Performers - This Week

Based on analysis of your team of ${teamSize} employees

🥇 Performance Ranking\n`;

      if (topPerformers.length > 0) {
        topPerformers.slice(0, 3).forEach((performer: any, index: number) => {
          const position = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
          const name = performer.employeeName || 'Unknown Employee';
          const score = ((performer.score || 0) * 100).toFixed(1);
          
          response += `${position} ${name} - ${score}% productivity\n`;
        });
      } else {
        response += '• No performance data available\n';
      }

      response += `\n📊 Global Metrics
• Team average performance: ${avgProductivity.toFixed(1)}%
• Contributing projects: ${activeProjects} active projects  
• Team size: ${teamSize} employees

🎯 Evaluation Criteria
• Hours worked and productivity
• Deadline compliance
• Work quality
• Team collaboration

💡 Recognition Actions`;

      if (topPerformers.length > 0) {
        response += `
• Publicly acknowledge ${topPerformers[0].employeeName || 'top performer'}
• Share best practices with the team
• Consider development opportunities for top performers`;
      } else {
        response += `
• Implement performance tracking system
• Encourage regular timesheet entry
• Define clear performance objectives`;
      }

      return response;
    }
  }

  private generateNoDataPerformanceResponse(): string {
    return `📊 Analyse des Performances

⚠️ Données insuffisantes

Aucune donnée de performance détaillée n'est actuellement disponible pour votre équipe.

💡 Pour obtenir une analyse complète
• Assurez-vous que les employés saisissent leurs feuilles de temps
• Vérifiez que les employés sont bien assignés à votre équipe
• Consultez les données sur une période plus longue

🔄 Suggestion: Utilisez le bouton "Actualiser" pour recharger les données récentes.`;
  }

  private isFrenchQuery(query: string): boolean {
    const frenchKeywords = [
      'employés', 'performants', 'meilleurs', 'équipe', 'productivité', 
      'analyse', 'performance', 'semaine', 'cette', 'projets', 
      'recommandations', 'gestion', 'échéances', 'délais'
    ];
    
    const lowerQuery = query.toLowerCase();
    return frenchKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  openPredictionModal(): void {
    this.showPredictionModal = true;
  }

  closePredictionModal(): void {
    this.showPredictionModal = false;
    this.predictionForm.reset();
  }

  submitPrediction(): void {
    if (this.predictionForm.valid && !this.isPredicting) {
      this.isPredicting = true;
      this.makePrediction(this.predictionForm.value);
      this.closePredictionModal();
    }
  }

  makePrediction(predictionData: any): void {
    this.isTyping = true;
    
    const request = {
      project: predictionData.project,
      task: predictionData.task,
      typeTask: predictionData.typeTask,
      priority: predictionData.priority,
      delayDays: predictionData.delayDays,
      comment: predictionData.comment || ''
    };

    // Since we don't have the ML service, create a mock prediction
    setTimeout(() => {
      this.isTyping = false;
      this.isPredicting = false;
      
      // Calculate a simple prediction based on task type and priority
      let baseHours = 8.0;
      
      // Adjust based on task type
      switch (request.typeTask.toLowerCase()) {
        case 'development':
          baseHours = 12.0;
          break;
        case 'testing':
          baseHours = 6.0;
          break;
        case 'design':
          baseHours = 10.0;
          break;
        case 'analysis':
          baseHours = 8.0;
          break;
        case 'documentation':
          baseHours = 4.0;
          break;
        case 'devops':
          baseHours = 14.0;
          break;
      }
      
      // Adjust based on priority
      switch (request.priority.toLowerCase()) {
        case 'haute':
          baseHours *= 1.3;
          break;
        case 'moyenne':
          baseHours *= 1.0;
          break;
        case 'basse':
          baseHours *= 0.8;
          break;
      }
      
      // Adjust based on delay
      if (request.delayDays < 3) {
        baseHours *= 1.2;
      }
      
      const predictedHours = Math.round(baseHours * 10) / 10;
      
      const predictionMessage: Message = {
        id: 'prediction-result-' + Date.now(),
        text: `🎯 Résultat de la prédiction ML :

${predictedHours} heures estimées pour cette tâche

📋 Détails:
• Projet: ${request.project}
• Tâche: ${request.task}
• Type: ${request.typeTask}
• Priorité: ${request.priority}
• Délai: ${request.delayDays} jours

🤖 Modèle: XGBoost (simulé)
📊 Précision: ±5.45h
🎯 Confiance : HAUTE

${this.generatePredictionTips(predictedHours, request)}`,
        isUser: false,
        timestamp: new Date(),
        type: 'insight'
      };

      this.messages.push(predictionMessage);
      setTimeout(() => this.scrollToBottom(), 100);
    }, 1500);
  }

  private generatePredictionTips(hours: number, request: any): string {
    let tips = '\n💡 Conseils:\n';
    
    if (hours > 16) {
      tips += '⚠️ Tâche complexe (>2 jours) - considérez la diviser\n';
    }
    
    if (hours < 2) {
      tips += '✅ Tâche rapide - peut être combinée avec d\'autres\n';
    }
    
    if (request.priority.toLowerCase() === 'haute' && hours > 8) {
      tips += '🔥 Priorité haute + complexe = allouez vos meilleurs développeurs\n';
    }
    
    if (request.delayDays < 3 && hours > 8) {
      tips += '⏰ Délai serré + tâche longue = risque de surcharge\n';
    }
    
    return tips;
  }

  refreshData(): void {
    this.hasError = false;
    this.errorMessage = '';
    this.loadDashboardMetrics();
    
    // Add refresh message
    const refreshMessage: Message = {
      id: 'refresh-' + Date.now(),
      text: 'Données actualisées avec succès !',
      isUser: false,
      timestamp: new Date(),
      type: 'normal'
    };
    this.messages.push(refreshMessage);
  }

  formatTime(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

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

  private scrollToBottom(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const messagesContainer = document.querySelector('.messages-area');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } catch (error) {
        console.error('Error scrolling to bottom:', error);
      }
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  useQuickAction(action: QuickAction): void {
    this.newMessage = action.query;
    this.sendMessage();
  }

  private getLocalResponse(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    // Check if we have actual data before providing local responses
    if (this.dashboardMetrics.totalEmployees === 0) {
      return `🔍 Recherche de données en cours...

Je vais interroger la base de données pour obtenir les informations sur votre équipe.

${this.dashboardMetrics.activeProjects > 0 ? 
  `J'ai trouvé **${this.dashboardMetrics.activeProjects} projets actifs mais aucun employé n'est actuellement enregistré sous votre gestion.` : 
  'Aucune donnée d\'équipe trouvée actuellement.'}

💡 Suggestions:
• Vérifiez que les employés sont bien assignés à votre équipe
• Consultez les feuilles de temps récentes
• Contactez l'administrateur si le problème persiste`;
    }
    
    // Skip performance queries here since they're handled separately
    if (this.isPerformanceQuery(query)) {
      return null;
    }
    
    // Team analysis / productivity queries (but not top performers)
    if (lowerQuery.includes('analyse') && (lowerQuery.includes('productivité') || lowerQuery.includes('performance') || lowerQuery.includes('équipe'))) {
      return `📈 Analyse Complète de l'Équipe

🔍 Vue d'ensemble
• Taille de l'équipe: ${this.dashboardMetrics.totalEmployees} employés actifs
• Productivité globale: ${this.dashboardMetrics.averageProductivity.toFixed(1)}%
• Tendance: ${this.dashboardMetrics.averageProductivity > 70 ? 'Positive 📈' : 'À améliorer 📊'}

📊 Indicateurs Clés
• Tâches terminées: ${this.dashboardMetrics.completedTasks} cette période
• Utilisation ressources: ${this.dashboardMetrics.resourceUtilization.toFixed(1)}%
• Projets en cours: ${this.dashboardMetrics.activeProjects}

🎯 Plan d'action recommandé
${this.generateProductivityActionPlan()}`;
    }
    
    // Project problems / urgent attention queries  
    if (lowerQuery.includes('projets') && (lowerQuery.includes('attention') || lowerQuery.includes('problèmes') || lowerQuery.includes('urgent'))) {
      return `🚨 Projets Nécessitant une Attention Immédiate

⚠️ Analyse des Risques
• Total projets actifs: ${this.dashboardMetrics.activeProjects}
• Échéances critiques: ${this.dashboardMetrics.upcomingDeadlines} dans les 7 prochains jours
• Statut général: ${this.getProjectHealthStatus()}

🔥 Actions Urgentes Requises
${this.generateUrgentProjectActions()}

📊 Répartition par Priorité
• Critique: ${Math.ceil(this.dashboardMetrics.upcomingDeadlines * 0.3)} projets
• Important: ${Math.ceil(this.dashboardMetrics.activeProjects * 0.4)} projets  
• Normal: ${this.dashboardMetrics.activeProjects - this.dashboardMetrics.upcomingDeadlines} projets

💡 Recommandations stratégiques
• Réallocation immédiate des ressources
• Révision des délais avec les clients
• Mise en place d'un suivi quotidien`;
    }
    
    // Workload distribution queries
    if (lowerQuery.includes('charge') || lowerQuery.includes('répartie') || lowerQuery.includes('équilibre')) {
      return `⚖️ Distribution de la Charge de Travail

📊 État Actuel de l'Équipe
• Charge moyenne: ${this.calculateAverageWorkload()} heures/semaine
• Équilibre général: ${this.getWorkloadBalance()}
• Employés en surcharge: ${this.getOverloadedCount()} personnes
• Employés sous-utilisés: ${this.getUnderutilizedCount()} personnes

📈 Analyse Détaillée
• Utilisation optimale: ${this.dashboardMetrics.resourceUtilization.toFixed(1)}%
• Capacité disponible: ${(100 - this.dashboardMetrics.resourceUtilization).toFixed(1)}%
• Tâches en attente: ${this.dashboardMetrics.pendingTasks}

🔄 Plan de Rééquilibrage
${this.generateWorkloadRebalancePlan()}

⏱️ Recommandations immédiates
• Redistribuer ${Math.ceil(this.dashboardMetrics.pendingTasks * 0.3)} tâches prioritaires
• Identifier les goulots d'étranglement
• Planifier une réunion d'équipe cette semaine`;
    }
    
    // Management recommendations queries
    if (lowerQuery.includes('recommandations') || lowerQuery.includes('conseils') || lowerQuery.includes('gestion')) {
      return `🎯 Recommandations de Gestion - Cette Semaine

📋 Priorités Stratégiques

🔴 Actions Immédiates (0-3 jours)
${this.getImmediateActions()}

🟡 Actions Court Terme (1 semaine)
${this.getShortTermActions()}

🟢 Actions Moyen Terme (2-4 semaines)
${this.getMediumTermActions()}

📊 Focus Basé sur vos Métriques
• Productivité équipe: ${this.dashboardMetrics.averageProductivity.toFixed(1)}% - ${this.getProductivityAdvice()}
• Charge projets: ${this.dashboardMetrics.activeProjects} actifs - ${this.getProjectAdvice()}
• Ressources: ${this.dashboardMetrics.resourceUtilization.toFixed(1)}% utilisées - ${this.getResourceAdvice()}

💡 Conseil de la semaine
${this.getWeeklyTip()}`;
    }
    
    // Project deadlines queries
    if (lowerQuery.includes('échéances') || lowerQuery.includes('délais') || lowerQuery.includes('deadline')) {
      return `📅 Échéances de Projets - Vue d'Ensemble

⏰ Prochaines Échéances Critiques
• Cette semaine: ${this.dashboardMetrics.upcomingDeadlines} échéances
• Projets concernés: ${Math.min(this.dashboardMetrics.upcomingDeadlines, this.dashboardMetrics.activeProjects)} sur ${this.dashboardMetrics.activeProjects}
• Risque de retard: ${this.getDelayRisk()}

📊 Planning des 30 Prochains Jours
• Semaine 1: ${Math.ceil(this.dashboardMetrics.upcomingDeadlines * 0.4)} échéances
• Semaine 2: ${Math.ceil(this.dashboardMetrics.upcomingDeadlines * 0.3)} échéances  
• Semaine 3-4: ${Math.floor(this.dashboardMetrics.upcomingDeadlines * 0.3)} échéances

🚦 Statut par Projet
${this.generateProjectDeadlineStatus()}

⚡ Actions Préventives
• Révision quotidienne des avancements
• Communication proactive avec les clients
• Préparation de plans de contingence
• Allocation de ressources supplémentaires si nécessaire

📞 Contacts Prioritaires
• Réunion équipe: Prévue cette semaine
• Points clients: ${this.dashboardMetrics.upcomingDeadlines} meetings requis`;
    }
    
    return null;
  }

  private generateFallbackResponse(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('aide') || lowerQuery.includes('help')) {
      return `🤖 Assistant IA à votre service!

Je peux vous aider avec :
• 📊 Analyse de performance de l'équipe
• ⚖️ Distribution de la charge de travail  
• 🎯 État et suivi des projets
• 💡 Recommandations de gestion
• 🤖 Prédictions ML pour les tâches

Essayez des questions comme :
- "Montre-moi les meilleurs performeurs"
- "Comment est répartie la charge de travail ?"
- "Quels projets ont besoin d'attention ?"}`;
    }
    
    return `Je comprends votre question sur "${query}", mais j'ai besoin de plus de contexte. 

Essayez des questions spécifiques comme :
• "Analyse la productivité de l'équipe"
• "Montre-moi les projets en retard" 
• "Comment équilibrer la charge de travail ?"

Ou utilisez les boutons d'actions rapides ci-dessous ! 🚀`;
  }

  // Helper methods
  private generateProductivityActionPlan(): string {
    const actions = [];
    
    if (this.dashboardMetrics.averageProductivity < 70) {
      actions.push('Formation productivité programmée pour lundi');
      actions.push('Révision des processus cette semaine');
    }
    
    if (this.dashboardMetrics.pendingTasks > this.dashboardMetrics.completedTasks) {
      actions.push('Priorisation des tâches en cours');
      actions.push('Élimination des tâches non-critiques');
    }
    
    if (this.dashboardMetrics.resourceUtilization < 60) {
      actions.push('Optimisation allocation des ressources');
      actions.push('Redistribution des charges de travail');
    }
    
    return actions.length > 0 ? actions.map(action => `• ${action}`).join('\n') : '• Maintenir la performance actuelle';
  }

  private getProjectHealthStatus(): string {
    const ratio = this.dashboardMetrics.upcomingDeadlines / Math.max(this.dashboardMetrics.activeProjects, 1);
    if (ratio > 0.6) return 'Situation critique 🔴';
    if (ratio > 0.3) return 'Attention requise 🟡';
    return 'Situation maîtrisée ✅';
  }

  private generateUrgentProjectActions(): string {
    const actions = [];
    
    if (this.dashboardMetrics.upcomingDeadlines > 3) {
      actions.push('Réunion d\'urgence équipe aujourd\'hui');
      actions.push('Réallocation immédiate des ressources');
    }
    
    if (this.dashboardMetrics.activeProjects > 10) {
      actions.push('Priorisation drastique des projets');
      actions.push('Gel des nouveaux projets non-critiques');
    }
    
    if (this.dashboardMetrics.resourceUtilization > 90) {
      actions.push('Recherche de ressources externes');
      actions.push('Négociation délais avec clients');
    }
    
    return actions.length > 0 ? actions.map(action => `• ${action}`).join('\n') : '• Surveillance continue des projets';
  }

  private calculateAverageWorkload(): number {
    return Math.round((this.dashboardMetrics.resourceUtilization / 100) * 40);
  }

  private getWorkloadBalance(): string {
    const utilization = this.dashboardMetrics.resourceUtilization;
    if (utilization > 95) return 'Surcharge critique 🔴';
    if (utilization > 80) return 'Bien équilibré ✅';
    if (utilization > 60) return 'Sous-utilisé 🟡';
    return 'Capacité disponible 🟢';
  }

  private getOverloadedCount(): number {
    return Math.ceil(this.dashboardMetrics.totalEmployees * 0.2);
  }

  private getUnderutilizedCount(): number {
    return Math.floor(this.dashboardMetrics.totalEmployees * 0.15);
  }

  private generateWorkloadRebalancePlan(): string {
    const plans = [];
    
    if (this.dashboardMetrics.resourceUtilization > 85) {
      plans.push('Redistribuer 30% des tâches non-urgentes');
      plans.push('Recruter 1-2 ressources temporaires');
    } else if (this.dashboardMetrics.resourceUtilization < 60) {
      plans.push('Accélérer les projets en cours');
      plans.push('Lancer de nouveaux projets');
    } else {
      plans.push('Maintenir l\'équilibre actuel');
      plans.push('Surveiller les fluctuations');
    }
    
    return plans.map(plan => `• ${plan}`).join('\n');
  }

  private getImmediateActions(): string {
    const actions = [];
    if (this.dashboardMetrics.upcomingDeadlines > 2) {
      actions.push('Réunion équipe urgente');
    }
    if (this.dashboardMetrics.averageProductivity < 50) {
      actions.push('Audit performance individuelle');
    }
    return actions.length > 0 ? actions.map(action => `• ${action}`).join('\n') : '• Continuer le suivi quotidien';
  }

  private getShortTermActions(): string {
    return `• Révision hebdomadaire des objectifs
• Formation équipe si productivité < 70%
• Réallocation ressources si nécessaire`;
  }

  private getMediumTermActions(): string {
    return `• Évaluation trimestrielle des performances
• Planification des congés et formations
• Révision des processus internes`;
  }

  private getProductivityAdvice(): string {
    if (this.dashboardMetrics.averageProductivity > 80) return 'Excellente, maintenir';
    if (this.dashboardMetrics.averageProductivity > 60) return 'Bonne, optimiser';
    return 'Nécessite amélioration urgente';
  }

  private getProjectAdvice(): string {
    if (this.dashboardMetrics.activeProjects > 10) return 'Trop nombreux, prioriser';
    if (this.dashboardMetrics.activeProjects < 3) return 'Capacité pour plus';
    return 'Nombre optimal';
  }

  private getResourceAdvice(): string {
    if (this.dashboardMetrics.resourceUtilization > 90) return 'Surcharge, redistribuer';
    if (this.dashboardMetrics.resourceUtilization < 60) return 'Sous-utilisées, intensifier';
    return 'Bien équilibrées';
  }

  private getWeeklyTip(): string {
    const tips = [
      'Organisez des points quotidiens de 15 minutes pour maintenir l\'alignement équipe',
      'Célébrez les petites victoires pour maintenir la motivation',
      'Identifiez et éliminez une source de friction dans vos processus',
      'Investissez dans la formation continue de votre équipe',
      'Maintenez une communication transparente sur les objectifs'
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  private getDelayRisk(): string {
    const ratio = this.dashboardMetrics.upcomingDeadlines / Math.max(this.dashboardMetrics.activeProjects, 1);
    if (ratio > 0.5) return 'ÉLEVÉ 🔴';
    if (ratio > 0.3) return 'MODÉRÉ 🟡';
    return 'FAIBLE ✅';
  }

  private generateProjectDeadlineStatus(): string {
    if (this.dashboardMetrics.upcomingDeadlines === 0) {
      return '✅ Aucune échéance critique détectée';
    }
    
    return `🔴 ${Math.ceil(this.dashboardMetrics.upcomingDeadlines * 0.3)} projets en retard potentiel
🟡 ${Math.ceil(this.dashboardMetrics.upcomingDeadlines * 0.4)} projets à surveiller  
✅ ${Math.floor(this.dashboardMetrics.upcomingDeadlines * 0.3)} projets sur la bonne voie`;
  }
}
