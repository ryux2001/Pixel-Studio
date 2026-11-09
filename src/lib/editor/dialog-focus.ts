import type { KeyboardEvent } from "react";

// Native modal dialogs make the page inert, but Tab may still reach browser chrome.
export function keepDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    "button, input, textarea, select, summary, a[href], [tabindex]",
  )).filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
  const first = controls[0], last = controls.at(-1);
  if (!first || !last) { event.preventDefault(); event.currentTarget.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
}
