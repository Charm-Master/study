export interface StudyData {
  weeklyMinutes: number;
  debtMinutes: number;
  streak: number;
  lastWeekId: string;
  isSessionActive: boolean;
  sessionStartTime: number | null; // Timestamp
  totalSessions: number;
}

export interface WeekStatus {
  hasFailed: boolean;
  hasPassed: boolean;
  minutesOwed: number;
}