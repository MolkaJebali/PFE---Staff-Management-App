export interface Notification {
  id: number;
  userId: number;
  message: string;
  type: string;
  data?: {
    projectName?: string;
    managerName?: string;
    taskName?: string;
    assignmentDate?: string;
    deadlineDate?: string;
    priority?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: string;
}

export enum NotificationType {
  PROJECT_ASSIGNMENT = 'PROJECT_ASSIGNMENT',
  TIMESHEET_SUBMISSION = 'TIMESHEET_SUBMISSION',
  GENERAL = 'GENERAL',
  REMINDER = 'REMINDER',
  APPROVAL = 'APPROVAL',
  REJECTION = 'REJECTION'
}
