import { StudyData } from '../types';
import { COOKIE_NAME, GOAL_MINUTES } from '../constants';

// Helper to get ISO week string (YYYY-Wxx)
export const getCurrentWeekId = (): string => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

const DEFAULT_DATA: StudyData = {
  weeklyMinutes: 0,
  debtMinutes: 0,
  streak: 0,
  lastWeekId: getCurrentWeekId(),
  isSessionActive: false,
  sessionStartTime: null,
  totalSessions: 0,
};

export const saveToCookie = (data: StudyData) => {
  const json = JSON.stringify(data);
  // Cookie expires in 1 year
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(json)}; expires=${expiry.toUTCString()}; path=/; SameSite=Strict`;
};

export const loadFromCookie = (): StudyData => {
  const match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch (e) {
      console.error("Failed to parse cookie", e);
      return DEFAULT_DATA;
    }
  }
  return DEFAULT_DATA;
};

export const processWeekRollover = (data: StudyData): { data: StudyData, weekFailed: boolean, weekPassed: boolean } => {
  const currentWeek = getCurrentWeekId();
  
  if (data.lastWeekId !== currentWeek) {
    // It's a new week. Calculate debt from the last tracked week.
    // If the user hasn't logged in for 3 weeks, we theoretically only count the last active week's failure.
    // Simpler logic: Rollover happens once per week boundary crossing.
    
    const shortfall = Math.max(0, GOAL_MINUTES - data.weeklyMinutes);
    const passed = data.weeklyMinutes >= GOAL_MINUTES;
    
    let newDebt = data.debtMinutes;
    if (shortfall > 0) {
      newDebt += shortfall;
    }
    
    // Cap debt at reasonable madness (e.g., 50 hours) to prevent total rage-quit
    if (newDebt > 3000) newDebt = 3000;

    let newStreak = data.streak;
    if (passed) {
      newStreak += 1;
    } else {
      newStreak = 0;
    }

    const newData: StudyData = {
      ...data,
      weeklyMinutes: 0,
      debtMinutes: newDebt,
      streak: newStreak,
      lastWeekId: currentWeek,
      // If a session was running across the week boundary, we keep it active, 
      // but the time counts towards the new week when stopped.
    };

    return { data: newData, weekFailed: !passed, weekPassed: passed };
  }

  return { data, weekFailed: false, weekPassed: false };
};