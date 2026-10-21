/** Only the IT recipient address is ever persisted. Device data is never stored. */

const KEY = "autopilotsnap.recipient";
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function loadRecipient(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveRecipient(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(KEY, value.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable (private mode etc.) – the app works without it */
  }
}
