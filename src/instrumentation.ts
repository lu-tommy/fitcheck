/**
 * Server start-up.
 *
 * Next calls this once when the server boots, which is the right place to start
 * the reminder loop: it lives in the one long-running process, needs no cron on
 * the host, and stops when the container stops.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startReminderLoop } = await import('./server/reminderLoop');
  startReminderLoop();
}
