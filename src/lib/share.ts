/**
 * Hand a generated file to the user's own mail client. There is no backend and no mail API.
 * A mailto: link cannot attach files, so the flow is:
 *   1. Web Share API with the file (share sheet, may include the mail app), else
 *   2. download the file + open mailto: and tell the user to attach it manually.
 */

export interface MailContent {
  to: string;
  subject: string;
  body: string;
}

export type SendOutcome = "shared" | "cancelled" | "fallback";

type ShareNavigator = Pick<Navigator, "canShare" | "share">;

export function canShareFile(file: File, nav: Partial<ShareNavigator> | undefined = globalThis.navigator): boolean {
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function buildMailto({ to, subject, body }: MailContent): string {
  // encodeURIComponent (not URLSearchParams) so spaces become %20, which mail clients expect.
  const recipient = to.trim().split(",").map(encodeURIComponent).join(",");
  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function openMailClient(mail: MailContent): void {
  window.location.href = buildMailto(mail);
}

/**
 * Preferred path: share sheet with the file attached.
 * Fallback: download the file and open the default mail client (user attaches manually).
 */
export async function sendFile(file: File, mail: MailContent): Promise<SendOutcome> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: mail.subject, text: mail.body });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Any other share failure: fall through to the download + mailto path.
    }
  }
  downloadFile(file);
  openMailClient(mail);
  return "fallback";
}
