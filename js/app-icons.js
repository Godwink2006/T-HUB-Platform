const appActionIconRules = [
  [/\b(add|new|create)\b/i, "fa-plus"],
  [/\b(save|submit)\b/i, "fa-floppy-disk"],
  [/\b(edit|update)\b/i, "fa-pen-to-square"],
  [/\b(delete|remove|unlink)\b/i, "fa-trash-can"],
  [/\b(view|details|preview)\b/i, "fa-eye"],
  [/\b(search)\b/i, "fa-magnifying-glass"],
  [/\b(filter)\b/i, "fa-filter"],
  [/\b(cancel|close)\b/i, "fa-xmark"],
  [/\b(download|export)\b/i, "fa-download"],
  [/\b(upload|import|choose file)\b/i, "fa-upload"],
  [/\b(print)\b/i, "fa-print"],
  [/\b(refresh|reload)\b/i, "fa-rotate"],
  [/\b(invite|send)\b/i, "fa-paper-plane"],
  [/\b(back|previous)\b/i, "fa-arrow-left"],
  [/\b(sign out|log out)\b/i, "fa-right-from-bracket"],
  [/\b(sign in|log in|login)\b/i, "fa-right-to-bracket"],
  [/\b(approve|confirm|activate)\b/i, "fa-check"],
  [/\b(reject|deactivate|disable)\b/i, "fa-ban"],
  [/\b(pay|payment)\b/i, "fa-credit-card"],
  [/\b(attendance)\b/i, "fa-calendar-check"],
  [/\b(report)\b/i, "fa-chart-column"],
  [/\b(settings|configure)\b/i, "fa-gear"],
  [/\b(manage)\b/i, "fa-sliders"],
];
const appActionSelector =
  'button, [role="button"], a[class*="btn"], a[class*="button"], a[class*="action"], a[class*="back"]';

function addAppActionIcons(root = document) {
  const buttons = [
    ...(root.matches?.(appActionSelector) ? [root] : []),
    ...root.querySelectorAll(appActionSelector),
  ];

  buttons.forEach((button) => {
    if (
      button.querySelector("i, svg") ||
      button.hasAttribute("data-no-auto-icon")
    ) {
      return;
    }

    const label = button.getAttribute("aria-label") || button.textContent || "";
    const match = appActionIconRules.find(([pattern]) => pattern.test(label));
    if (!match) return;

    const icon = document.createElement("i");
    icon.className = `fa-solid ${match[1]} app-action-icon`;
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon, " ");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  addAppActionIcons();

  const iconObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const containingAction = mutation.target.closest?.(appActionSelector);
      if (containingAction) {
        addAppActionIcons(containingAction);
      }

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          addAppActionIcons(node);
        }
      });
    });
  });

  iconObserver.observe(document.body, { childList: true, subtree: true });
});
