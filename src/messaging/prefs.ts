/** What each person can switch on or off in the app's Notifications screen. */
export const DEFAULT_PREFS = { weeklyReport: true, examResults: true, whatsAppReports: false, lessonReminders: true, payments: true, productNews: false };
export type NotificationPrefs = typeof DEFAULT_PREFS;
