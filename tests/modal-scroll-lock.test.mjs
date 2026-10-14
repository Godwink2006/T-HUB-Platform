import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const utilsSource = await readFile(
  path.join(projectRoot, "js", "utils.js"),
  "utf8",
);

function createModalScrollContext() {
  const modals = [];
  let observerCallback;
  const body = {
    classList: { contains: () => false },
    style: { overflow: "auto" },
    querySelectorAll: () => modals,
  };
  const context = {
    document: {
      body,
      readyState: "complete",
    },
    window: {
      getComputedStyle: (element) => element.style,
    },
    MutationObserver: class {
      constructor(callback) {
        observerCallback = callback;
      }

      observe() {}
    },
  };
  const lockCode = utilsSource.slice(
    utilsSource.indexOf("let bodyScrollLockedByModal = false;"),
    utilsSource.indexOf("function showToast("),
  );
  vm.runInNewContext(lockCode, context);

  const createModal = () => {
    const modal = {
      hidden: false,
      parentElement: body,
      style: { display: "none", visibility: "visible" },
      getAttribute: () => null,
    };
    modals.push(modal);
    return modal;
  };

  return {
    body,
    createModal,
    lock: () => context.lockBodyScroll(),
    unlock: () => context.unLockBodyScroll(),
    notifyMutation: () => observerCallback(),
  };
}

test("modal observer locks scroll on direct opens and restores the original overflow on close", () => {
  const { body, createModal, notifyMutation, unlock } =
    createModalScrollContext();
  const modal = createModal();

  modal.style.display = "flex";
  notifyMutation();
  assert.equal(body.style.overflow, "hidden");

  modal.style.display = "none";
  unlock();
  assert.equal(body.style.overflow, "auto");
});

test("closing one modal keeps body scroll locked while another modal remains open", () => {
  const { body, createModal, lock, notifyMutation, unlock } =
    createModalScrollContext();
  const firstModal = createModal();
  const secondModal = createModal();

  firstModal.style.display = "flex";
  secondModal.style.display = "flex";
  lock();

  firstModal.style.display = "none";
  unlock();
  assert.equal(body.style.overflow, "hidden");

  secondModal.style.display = "none";
  notifyMutation();
  assert.equal(body.style.overflow, "auto");
});

test("every page containing modal markup loads the shared scroll-lock utility", async () => {
  const htmlDirectory = path.join(projectRoot, "html");
  const pageNames = await readdir(htmlDirectory);
  const missingUtilityPages = [];

  for (const pageName of pageNames.filter((name) => name.endsWith(".html"))) {
    const page = await readFile(path.join(htmlDirectory, pageName), "utf8");
    if (!/(?:class|id)="[^"]*(?:modal|Modal|dialog)/i.test(page)) continue;
    if (!page.includes("/js/utils.js")) missingUtilityPages.push(pageName);
  }

  assert.deepEqual(missingUtilityPages, []);
});
