(function () {
  "use strict";

  const HTML_TTL = 60_000;
  const htmlCache = new Map();
  const pageInflight = new Map();
  const assetCache = new Map();
  const loadedExternalScripts = new Map();
  const managedStyles = new Map();
  const inlineStyles = new Map();
  const SHARED_SCRIPTS = new Set([
    "supabase.js",
    "utils.js",
    "app-icons.js",
    "query-cache.js",
    "spa-router.js",
  ]);
  const SHARED_CSS = new Set(["utils.css", "app-visuals.css"]);
  const routerScript = document.currentScript;
  const nativeDocumentRemove = document.removeEventListener.bind(document);
  const nativeWindowRemove = window.removeEventListener.bind(window);

  let activeView = null;
  let activeScope = null;
  let navigating = false;
  let queuedNavigation = null;

  function canonical(url) {
    const value = new URL(url, location.href);
    value.hash = "";
    return value.href;
  }

  function pageFamily(doc) {
    if (!doc.querySelector("main")) return null;
    if (doc.querySelector("aside.sidebar")) return "staff";
    if (doc.querySelector(".parent-topbar")) return "parent";
    return null;
  }

  function canSwap(targetDoc, url) {
    const target = new URL(url);
    if (target.origin !== location.origin || !/\.html$/i.test(target.pathname)) return false;
    const sourceFamily = pageFamily(document);
    return sourceFamily !== null && pageFamily(targetDoc) === sourceFamily;
  }

  function pageScripts(doc) {
    return Array.from(doc.scripts).filter((script) => {
      if (script.type && !/^(text|application)\/(javascript|ecmascript)$/i.test(script.type)) return false;
      if (!script.src) return script.textContent.trim().length > 0;
      const url = new URL(script.src, doc.baseURI);
      return !SHARED_SCRIPTS.has(url.pathname.split("/").pop());
    });
  }

  function pageStyles(doc) {
    return Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))
      .map((link) => new URL(link.href, doc.baseURI).href)
      .filter((href) => {
        const url = new URL(href);
        return url.origin === location.origin &&
          url.pathname.startsWith("/css/") &&
          !SHARED_CSS.has(url.pathname.split("/").pop());
      });
  }

  async function fetchText(url) {
    const cached = assetCache.get(url);
    if (cached) return cached;
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
    const text = await response.text();
    assetCache.set(url, text);
    return text;
  }

  async function fetchPage(url) {
    const key = canonical(url);
    const cached = htmlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.doc.cloneNode(true);
    let pending = pageInflight.get(key);
    if (!pending) {
      pending = (async () => {
        const response = await fetch(key, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`Could not load page: ${response.status}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const base = doc.createElement("base");
        base.href = key;
        doc.head.prepend(base);
        htmlCache.set(key, { doc, expiresAt: Date.now() + HTML_TTL });
        return doc;
      })().finally(() => {
        if (pageInflight.get(key) === pending) pageInflight.delete(key);
      });
      pageInflight.set(key, pending);
    }
    return (await pending).cloneNode(true);
  }

  function prefetchImage(url) {
    if (!url || url.startsWith("data:")) return;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }

  function prefetch(url) {
    let key;
    try {
      key = canonical(url);
    } catch {
      return;
    }
    if (new URL(key).origin !== location.origin || htmlCache.get(key)?.expiresAt > Date.now()) return;
    fetchPage(key).then((doc) => {
      if (!canSwap(doc, key)) return;
      pageStyles(doc).forEach((href) => fetch(href, { credentials: "same-origin" })
        .then((response) => response.ok && response.arrayBuffer())
        .catch(() => {}));
      pageScripts(doc).forEach((script) => {
        if (script.src) {
          const src = new URL(script.src, doc.baseURI).href;
          if (new URL(src).origin === location.origin) fetchText(src).catch(() => {});
        }
      });
      doc.querySelectorAll("img[src], source[srcset]").forEach((el) => {
        if (el.hasAttribute("src")) prefetchImage(new URL(el.getAttribute("src"), key).href);
        (el.getAttribute("srcset") || "").split(",").forEach((candidate) => {
          const imageURL = candidate.trim().split(/\s+/)[0];
          if (imageURL) prefetchImage(new URL(imageURL, key).href);
        });
      });
    }).catch(() => {});
  }

  function createScope() {
    return { listeners: [], ready: [], exports: new Map(), previousGlobals: new Map() };
  }

  function invokeListener(listener, event, target) {
    if (typeof listener === "function") return listener.call(target, event);
    if (listener && typeof listener.handleEvent === "function") return listener.handleEvent(event);
  }

  function installListenerTracking() {
    const docAdd = document.addEventListener.bind(document);
    const docRemove = document.removeEventListener.bind(document);
    const winAdd = window.addEventListener.bind(window);
    const winRemove = window.removeEventListener.bind(window);

    document.addEventListener = function (type, listener, options) {
      if (!activeScope || typeof listener !== "function" && !listener?.handleEvent) {
        return docAdd(type, listener, options);
      }
      if (type === "DOMContentLoaded" && document.readyState !== "loading") {
        activeScope.ready.push(listener);
        return;
      }
      activeScope.listeners.push({ target: document, type, listener, options });
      return docAdd(type, listener, options);
    };
    document.removeEventListener = function (type, listener, options) {
      if (activeScope) {
        activeScope.listeners = activeScope.listeners.filter((entry) =>
          !(entry.target === document && entry.type === type && entry.listener === listener));
      }
      return docRemove(type, listener, options);
    };
    window.addEventListener = function (type, listener, options) {
      if (!activeScope || typeof listener !== "function" && !listener?.handleEvent) {
        return winAdd(type, listener, options);
      }
      if (type === "DOMContentLoaded" && document.readyState !== "loading") {
        activeScope.ready.push(listener);
        return;
      }
      activeScope.listeners.push({ target: window, type, listener, options });
      return winAdd(type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      if (activeScope) {
        activeScope.listeners = activeScope.listeners.filter((entry) =>
          !(entry.target === window && entry.type === type && entry.listener === listener));
      }
      return winRemove(type, listener, options);
    };
  }

  function pauseScope(scope) {
    if (!scope) return;
    scope.listeners.forEach(({ target, type, listener, options }) => {
      (target === document ? nativeDocumentRemove : nativeWindowRemove)(type, listener, options);
    });
    scope.listeners.length = 0;
    scope.exports.forEach((fn, name) => {
      if (window[name] === fn) {
        if (scope.previousGlobals.has(name)) window[name] = scope.previousGlobals.get(name);
        else delete window[name];
      }
    });
  }

  function discoverFunctions(source) {
    return Array.from(source.matchAll(/^[ \t]*(?:async\s+)?function\b\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/gm), (match) => match[1]);
  }

  function executeCode(source, scope) {
    const functionNames = discoverFunctions(source);
    functionNames.forEach((name) => {
      if (!scope.previousGlobals.has(name)) scope.previousGlobals.set(name, window[name]);
    });
    const exports = functionNames.map((name) =>
      `if (typeof ${name} === "function") { window[${JSON.stringify(name)}] = ${name}; __spaExports.set(${JSON.stringify(name)}, ${name}); }`,
    ).join("\n");
    const run = new Function("__spaExports", `${source}\n${exports}`);
    run(scope.exports);
  }

  async function loadExternalScript(src) {
    if (Array.from(document.scripts).some((script) => script.src === src)) return;
    if (loadedExternalScripts.has(src)) return loadedExternalScripts.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load script ${src}`));
      document.head.appendChild(script);
    });
    loadedExternalScripts.set(src, promise);
    try {
      await promise;
    } catch (error) {
      loadedExternalScripts.delete(src);
      throw error;
    }
  }

  async function runPageScripts(doc, scope) {
    for (const script of pageScripts(doc)) {
      if (script.src) {
        const src = new URL(script.src, doc.baseURI).href;
        if (new URL(src).origin !== location.origin) {
          await loadExternalScript(src);
        } else {
          executeCode(await fetchText(src), scope);
        }
      } else {
        executeCode(script.textContent, scope);
      }
    }
    while (scope.ready.length) {
      const readyListeners = scope.ready.splice(0);
      for (const listener of readyListeners) {
        const event = new Event("DOMContentLoaded");
        Object.defineProperty(event, "target", { value: document });
        Object.defineProperty(event, "currentTarget", { value: document });
        await invokeListener(listener, event, document);
      }
    }
  }

  function loadRouteStyles(doc) {
    const targetHrefs = new Set(pageStyles(doc));
    const pending = [];
    targetHrefs.forEach((href) => {
      if (managedStyles.has(href)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.media = "not all";
      managedStyles.set(href, link);
      pending.push(new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Stylesheet timed out: ${href}`)), 8000);
        link.onload = () => { clearTimeout(timeout); resolve(); };
        link.onerror = () => { clearTimeout(timeout); reject(new Error(`Stylesheet failed: ${href}`)); };
        document.head.appendChild(link);
      }));
    });
    return Promise.all(pending).then(() => targetHrefs);
  }

  function activateStyles(doc, targetHrefs) {
    managedStyles.forEach((link, href) => { link.media = targetHrefs.has(href) ? "all" : "not all"; });
    let cached = inlineStyles.get(activeView.url);
    if (!cached) {
      cached = Array.from(doc.querySelectorAll("head style"), (style) => {
        const copy = document.createElement("style");
        copy.textContent = style.textContent;
        copy.media = "not all";
        document.head.appendChild(copy);
        return copy;
      });
      inlineStyles.set(activeView.url, cached);
    }
    inlineStyles.forEach((nodes, url) => nodes.forEach((style) => {
      style.media = url === activeView.url ? "all" : "not all";
    }));
  }

  function swapPageBody(targetDoc) {
    const nextBody = targetDoc.body.cloneNode(true);
    nextBody.querySelectorAll("script").forEach((script) => script.remove());

    if (pageFamily(targetDoc) === "staff") {
      ["#menuToggle", "#sidebarOverlay", "aside.sidebar"].forEach((selector) => {
        const currentElement = document.querySelector(selector);
        const nextElement = nextBody.querySelector(selector);
        if (currentElement && nextElement) nextElement.replaceWith(currentElement);
      });
    }

    document.body.replaceChildren(...Array.from(nextBody.childNodes));
  }

  function updateActiveLink(url) {
    const targetName = new URL(url).pathname.split("/").pop();
    document.querySelectorAll(".menu li").forEach((item) => {
      const link = item.querySelector("a[href]");
      const name = link && new URL(link.href, location.href).pathname.split("/").pop();
      item.classList.toggle("active", name === targetName);
    });
  }

  async function navigate(url, push = true) {
    const targetURL = canonical(url);
    if (navigating) {
      queuedNavigation = { url: targetURL, push };
      return;
    }
    if (!activeView?.safe || targetURL === activeView.url) {
      location.href = url;
      return;
    }
    navigating = true;
    try {
      const targetDoc = await fetchPage(targetURL);
      if (!canSwap(targetDoc, targetURL)) {
        location.href = url;
        return;
      }
      const targetStyles = await loadRouteStyles(targetDoc);
      pauseScope(activeScope);
      swapPageBody(targetDoc);
      document.body.className = targetDoc.body.className;
      document.title = targetDoc.title;
      activeView = { url: targetURL, safe: true };
      activeScope = createScope();
      activateStyles(targetDoc, targetStyles);
      if (push) history.pushState({ spa: true, url: targetURL }, document.title, targetURL);
      await runPageScripts(targetDoc, activeScope);
      updateActiveLink(targetURL);
      window.scrollTo(0, 0);
      document.getElementById("sidebarOverlay")?.classList.remove("active");
      document.querySelector("aside.sidebar")?.classList.remove("active");
    } catch (error) {
      queuedNavigation = null;
      console.error("[SPA Router] Using regular page navigation after route setup failed:", error);
      location.href = url;
    } finally {
      navigating = false;
      const nextNavigation = queuedNavigation;
      queuedNavigation = null;
      if (nextNavigation && canonical(nextNavigation.url) !== activeView?.url) {
        navigate(nextNavigation.url, nextNavigation.push);
      }
    }
  }

  function initialScriptOrderIsSafe() {
    const scripts = Array.from(document.scripts);
    const routerIndex = scripts.indexOf(routerScript);
    if (routerIndex < 0) return false;
    return !scripts.slice(0, routerIndex).some((script) => {
      if (!script.src) {
        return script.textContent.trim().length > 0 &&
          (!script.type || /^(text|application)\/(javascript|ecmascript)$/i.test(script.type));
      }
      const scriptURL = new URL(script.src, location.href);
      const name = scriptURL.pathname.split("/").pop();
      return scriptURL.origin === location.origin &&
        scriptURL.pathname.startsWith("/js/") &&
        !SHARED_SCRIPTS.has(name);
    });
  }

  function init() {
    const safe = initialScriptOrderIsSafe();
    const routerClick = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const link = target?.closest("a[href]");
      if (!link || link.dataset.spa === "false" || link.target === "_blank" || link.hasAttribute("download")) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/\.html$/i.test(url.pathname)) return;
      if (canonical(url.href) === activeView.url) {
        if (navigating) event.preventDefault();
        return;
      }
      if (link.target && link.target !== "_self") return;
      if (!safe) return;
      event.preventDefault();
      navigate(url.href);
    };
    const hoverPrefetch = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const link = target?.closest("a[href]");
      if (link && link.dataset.spa !== "false") prefetch(link.href);
    };
    const popState = (event) => {
      if (event.state?.spa && safe) navigate(event.state.url || location.href, false);
      else location.reload();
    };
    document.addEventListener("click", routerClick, true);
    document.addEventListener("pointerover", hoverPrefetch, { passive: true });
    window.addEventListener("popstate", popState);

    activeView = { url: canonical(location.href), safe };
    activeScope = createScope();
    pageStyles(document).forEach((href) => {
      const link = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
        .find((node) => new URL(node.href, location.href).href === href);
      if (link) managedStyles.set(href, link);
    });
    inlineStyles.set(activeView.url, Array.from(document.head.querySelectorAll("style")));
    installListenerTracking();
    history.replaceState({ spa: true, url: activeView.url }, document.title, location.href);
    window.SPARouter = { navigate, prefetch };
  }

  init();
})();
