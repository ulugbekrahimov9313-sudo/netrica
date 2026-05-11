(function () {
  "use strict";

  const basePrefix = (() => {
    const base = (window.NETRICA_BASE || "").replace(/\/+$/, "");
    return base ? base + "/" : "";
  })();

  const SUPPORTED = ["uz", "ru", "en"];
  const LANG_STORAGE_KEY = "netrica_lang";
  const STORAGE = {
    lang: LANG_STORAGE_KEY,
    user: "netrica_user",
    users: "netrica_users",
    chats: "netrica_chats",
    messages: "netrica_messages",
    supportChats: "netrica_support_chats",
    tz: "netrica_tz",
    orders: "netrica_orders",
    subs: "netrica_subs",
    dashView: "netrica_dash_view"
  };

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getLang() {
    const stored = String(localStorage.getItem(LANG_STORAGE_KEY) || "uz").toLowerCase();
    return SUPPORTED.includes(stored) ? stored : "uz";
  }

  function setLang(lang) {
    const next = String(lang || "").toLowerCase();
    const finalLang = SUPPORTED.includes(next) ? next : "uz";
    localStorage.setItem(LANG_STORAGE_KEY, finalLang);
    document.documentElement.lang = finalLang;
    return finalLang;
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function renderLanguageButtons() {
    const current = getLang();
    const meta = {
      uz: { label: "O'zbek tili", title: "O'z" },
      ru: { label: "Р СѓСЃСЃРєРёР№ СЏР·С‹Рє", title: "Ru" },
      en: { label: "English", title: "En" }
    };

    const ordered = [current, ...SUPPORTED.filter((code) => code !== current)];

    return ordered
      .map((code) => {
        const item = meta[code];
        const active = code === current;
        return `
          <button class="lang-btn" type="button" data-lang="${code}" aria-pressed="${active ? "true" : "false"}" aria-label="${item.label}" title="${item.title}">
            <span class="lang-flag ${code}" aria-hidden="true"></span>
          </button>
        `;
      })
      .join("");
  }

  function bindLanguageSwitch(root) {
    const langSwitch = qs(".lang-switch", root);
    if (!langSwitch) return;

    langSwitch.addEventListener("click", async (e) => {
      const btn = e.target.closest(".lang-btn[data-lang]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const next = btn.getAttribute("data-lang");
      const current = getLang();

      if (next === current) {
        const opened = langSwitch.classList.toggle("open");
        langSwitch.setAttribute("aria-expanded", opened ? "true" : "false");
        return;
      }

      langSwitch.classList.remove("open");
      langSwitch.setAttribute("aria-expanded", "false");
      await initI18n(next);
      toast(t("i18n.changed"), "ok");
    });

    if (!document.body.dataset.langSwitchOutsideBound) {
      document.addEventListener("click", (e) => {
        const currentSwitch = qs(".lang-switch");
        if (!currentSwitch) return;
        if (currentSwitch.contains(e.target)) return;

        currentSwitch.classList.remove("open");
        currentSwitch.setAttribute("aria-expanded", "false");
      });

      document.body.dataset.langSwitchOutsideBound = "1";
    }
  }

  async function loadI18n(lang) {
    const finalLang = setLang(lang);

    try {
      const res = await fetch(`${basePrefix}assets/js/i18n/${finalLang}.json`, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      window.NETRICA_I18N = data;
      return data;
    } catch {
      const fallback = window.NETRICA_I18N_FALLBACK && window.NETRICA_I18N_FALLBACK[finalLang];
      window.NETRICA_I18N = fallback || {};
      return window.NETRICA_I18N;
    }
  }

  function t(key, vars) {
    const dict = window.NETRICA_I18N || {};
    let val = key.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), dict);
    if (typeof val !== "string") return key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        val = val.replaceAll(`{{${k}}}`, String(vars[k]));
      });
    }
    return val;
  }

  function applyTranslations(root) {
    const r = root || document;
    qsa("[data-i18n]", r).forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    qsa("[data-i18n-html]", r).forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    qsa("[data-i18n-placeholder]", r).forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
  }

  function toast(message, kind) {
    const wrap = qs(".toast-wrap") || (() => {
      const w = document.createElement("div");
      w.className = "toast-wrap";
      document.body.appendChild(w);
      return w;
    })();

    const existing = Array.from(wrap.children).find(
      (n) => n && n.classList && n.classList.contains("toast") && n.textContent === message
    );
    if (existing) return;

    const el = document.createElement("div");
    el.className = `toast ${kind === "ok" ? "ok" : kind === "bad" ? "bad" : ""}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  function getUser() {
    return safeJsonParse(localStorage.getItem(STORAGE.user), null);
  }
  function setUser(user) {
    localStorage.setItem(STORAGE.user, JSON.stringify(user));
  }
  function logout() {
    localStorage.removeItem(STORAGE.user);
    toast(t("auth.loggedOut"), "ok");
    location.href = basePrefix + "index.html";
  }

  function requireAuth() {
    const user = getUser();
    if (!user) {
      const pathname = location.pathname || "";
      const fileName = pathname.split("/").pop() || "index.html";
      const relPath = pathname.includes("/admin/") ? `admin/${fileName}` : fileName;
      const back = encodeURIComponent(relPath + location.search + location.hash);
      location.href = `${basePrefix}login.html?next=${back}`;
      return false;
    }
    return true;
  }

  function requireAdmin() {
    const user = getUser();
    if (!user) return requireAuth();
    if (user.role !== "admin") {
      toast(t("auth.adminOnly"), "bad");
      location.href = basePrefix + "dashboard.html";
      return false;
    }
    return true;
  }

  function enforcePageAccess() {
    if (document.body.getAttribute("data-admin") === "1") {
      return requireAdmin();
    }
    if (document.body.getAttribute("data-protected") === "1") {
      return requireAuth();
    }
    return true;
  }

  function activeLink(href) {
    const curr = location.pathname.split("/").pop() || "index.html";
    return curr === href ? ' aria-current="page"' : "";
  }

  function mountHeaderFooter() {
    const headerHost = qs("#app-header");
    const footerHost = qs("#app-footer");
    const user = getUser();

    function enableBackgroundVideoTheme(enabled) {
      document.body.classList.toggle("has-bg-video", !!enabled);
    }

    function disableBackgroundVideo() {
      qsa(".bg-video, .bg-video-overlay").forEach((el) => el.remove());
      enableBackgroundVideoTheme(false);
    }

    function shouldEnableBackgroundVideo() {
      const isEmbed = getQuery("embed") === "1";
      const isHome = (document.body.getAttribute("data-page") || "") === "home";
      const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const narrowScreen = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
      const saveData = !!(navigator.connection && navigator.connection.saveData);
      return isHome && !isEmbed && !reducedMotion && !narrowScreen && !saveData;
    }

    if (!shouldEnableBackgroundVideo()) {
      disableBackgroundVideo();
    } else if (!qs(".bg-video")) {
      const videoSrc = `${basePrefix}assets/video/planet-network.mp4`;
      const video = document.createElement("video");
      video.className = "bg-video";
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("aria-hidden", "true");
      video.playbackRate = 0.8;

      const source = document.createElement("source");
      source.src = videoSrc;
      source.type = "video/mp4";
      video.appendChild(source);

      const overlay = document.createElement("div");
      overlay.className = "bg-video-overlay";
      overlay.setAttribute("aria-hidden", "true");

      const activateVideoTheme = () => enableBackgroundVideoTheme(true);
      const deactivateVideoTheme = () => disableBackgroundVideo();

      video.addEventListener("loadeddata", activateVideoTheme, { once: true });
      video.addEventListener("canplay", activateVideoTheme, { once: true });
      video.addEventListener("error", deactivateVideoTheme, { once: true });

      enableBackgroundVideoTheme(false);
      document.body.prepend(overlay);
      document.body.prepend(video);
      video.load();
    } else {
      const existingVideo = qs(".bg-video");
      enableBackgroundVideoTheme(!!(existingVideo && existingVideo.readyState >= 2));
    }

    if (getQuery("embed") === "1") {
      if (headerHost) headerHost.innerHTML = "";
      if (footerHost) footerHost.innerHTML = "";
      applyTranslations(document);
      return;
    }

    if (headerHost) {
      headerHost.innerHTML = `
        <a class="skip-link" href="#main">${t("a11y.skip")}</a>
        <header class="site-header">
          <div class="container header-inner">
            <a class="brand brand-home" href="${basePrefix}index.html" aria-label="Netrica home">
              <span class="brand-mark">
                <img src="${basePrefix}assets/img/logo.svg" alt="" />
              </span>
              <span class="brand-text">NETRICA</span>
            </a>
            <nav class="nav" aria-label="Primary">
              <a href="${basePrefix}index.html"${activeLink("index.html")}>${t("nav.home")}</a>
              <a href="${basePrefix}products.html"${activeLink("products.html")}>${t("nav.products")}</a>
              <a href="${basePrefix}chat.html"${activeLink("chat.html")}>${t("nav.chat")}</a>
              <a href="${basePrefix}dashboard.html"${activeLink("dashboard.html")}>${t("nav.dashboard")}</a>
              ${user ? `<a href="${basePrefix}profile.html"${activeLink("profile.html")}>${t("nav.profile")}</a>` : ""}
            </nav>
            <div class="actions">
              ${
                user
                  ? `<button class="btn ghost" id="logout">${t("nav.logout")}</button>`
                  : ``
              }
              <div class="lang-switch" role="group" aria-label="Language" aria-expanded="false">
                ${renderLanguageButtons()}
              </div>
            </div>
          </div>
        </header>
      `;

      bindLanguageSwitch(headerHost);

      const logoutBtn = qs("#logout");
      if (logoutBtn) logoutBtn.addEventListener("click", logout);
    }

    if (footerHost) {
      footerHost.innerHTML = `
        <footer class="site-footer">
          <div class="container footer-grid single center">
            <div>
              <div class="brand" style="gap:8px; margin-bottom:8px">
                <img src="${basePrefix}assets/img/logo.svg" alt="" />
                <span>NETRICA</span>
              </div>
              <div class="small" data-i18n="footer.tagline"></div>
            </div>
          </div>
        </footer>
      `;
    }

    applyTranslations(document);
  }

  async function initI18n(lang) {
    await loadI18n(lang || getLang());
    mountHeaderFooter();
    applyTranslations(document);
    document.dispatchEvent(new CustomEvent("netrica:i18n"));
  }

  function getQuery(name) {
    const url = new URL(location.href);
    return url.searchParams.get(name);
  }

  function listRender(el, items) {
    el.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("div");
      if (typeof it === "string" && it.includes('class="list-empty"')) {
        li.className = "";
      } else {
        li.className = "row";
      }
      li.innerHTML = it;
      el.appendChild(li);
    });
  }

  function listEmptyItem() {
    return `<div class="list-empty"><b>${t("common.empty")}</b></div>`;
  }

  function readStore(key, fallback) {
    return safeJsonParse(localStorage.getItem(key), fallback);
  }
  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureDemoStores() {
    const demo = (window.NETRICA_DEMO && window.NETRICA_DEMO.demoUsers) || [];
    let users = readStore(STORAGE.users, []);
    if (!Array.isArray(users)) users = [];
    users = users
      .map((u) => ({
        email: String(u && u.email ? u.email : "").trim().toLowerCase(),
        password: u && u.password != null ? String(u.password) : "",
        name: (u && u.name) || "User",
        role: (u && u.role) || "user"
      }))
      .filter((u) => !!u.email);

    demo.forEach((u) => {
      const email = String(u && u.email ? u.email : "").trim().toLowerCase();
      if (!email) return;
      const demoUser = {
        email,
        password: u && u.password != null ? String(u.password) : "",
        name: (u && u.name) || "User",
        role: (u && u.role) || "user"
      };

      const idx = users.findIndex((x) => x.email === email);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...demoUser };
        return;
      }

      users.unshift(demoUser);
    });
    writeStore(STORAGE.users, users);

    if (!localStorage.getItem(STORAGE.chats)) writeStore(STORAGE.chats, []);
    if (!localStorage.getItem(STORAGE.messages)) writeStore(STORAGE.messages, [
      { id: "msg_1", userEmail: "user@demo.com", userName: "Demo User", subject: "Yordam kerak", text: "Salom, menga yordam kerak. Mahsulotni qanday buyurtma qilaman? To'lov usullari haqida batafsil ma'lumot bering.", status: "new", createdAt: "2026-03-12T10:30:00.000Z" },
      { id: "msg_2", userEmail: "user@demo.com", userName: "Demo User", subject: "Buyurtma holati", text: "Buyurtma holati qanday? Men 3 kun oldin buyurtma bergandim, hali javob kelmadi. Buyurtma raqamim: ord_demo2.", status: "read", createdAt: "2026-03-11T08:15:00.000Z" },
      { id: "msg_3", userEmail: "client@test.uz", userName: "Test Client", subject: "API integratsiya", text: "API integratsiya bo'yicha savolim bor. Qaysi endpointlar mavjud va autentifikatsiya qanday ishlaydi?", status: "new", createdAt: "2026-03-11T15:45:00.000Z" }
    ]);
    if (!localStorage.getItem(STORAGE.tz)) writeStore(STORAGE.tz, []);
    if (!localStorage.getItem(STORAGE.orders)) writeStore(STORAGE.orders, [
      { id: "ord_demo1", productId: "netrica-tz", project: "Netrica Delpi вЂ” Web App", requirements: "Landing page + dashboard + API integration", status: "Yangi", createdAt: "2026-03-10T14:30:00.000Z" },
      { id: "ord_demo2", productId: "netrica-chat", project: "VISATUR-MAIN chatbot", requirements: "AI chatbot for customer support", status: "Jarayonda", createdAt: "2026-03-08T09:15:00.000Z" },
      { id: "ord_demo3", productId: "netrica-inshoat", project: "Netrica AI Inshoat вЂ” Qurilish CRM", requirements: "Construction project management system", status: "Tayyor", createdAt: "2026-02-25T11:00:00.000Z" }
    ]);
    if (!localStorage.getItem(STORAGE.subs)) writeStore(STORAGE.subs, []);
  }

  function safeNextUrl(nextRaw) {
    if (!nextRaw) return "";
    let next = "";
    try {
      next = decodeURIComponent(String(nextRaw));
    } catch {
      next = String(nextRaw);
    }

    if (/^(https?:|javascript:|data:)/i.test(next)) return "";
    if (next.includes("://") || next.startsWith("//")) return "";
    if (/^[a-zA-Z]:\//.test(next) || /^[a-zA-Z]:\\/.test(next)) return "";

    if (next.startsWith("/")) next = next.replace(/^\//, "");
    return next;
  }

  function handleAuthForms() {
    const loginForm = qs("#login-form");
    const registerForm = qs("#register-form");
    const forgotForm = qs("#forgot-form");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        ensureDemoStores();
        const email = qs("#email").value.trim().toLowerCase();
        const password = String(qs("#password").value || "").trim();

        const users = readStore(STORAGE.users, []);
        const found = (Array.isArray(users) ? users : []).find(
          (u) => String(u && u.email ? u.email : "").trim().toLowerCase() === email
        );

        if (!found) {
          toast(t("auth.notFound"), "bad");
          return;
        }
        if (String(found.password || "").trim() !== password) {
          toast(t("auth.invalid"), "bad");
          return;
        }

        setUser({ email: found.email, name: found.name, role: found.role, lang: getLang() });
        toast(t("auth.welcome", { name: found.name }), "ok");

        const next = safeNextUrl(getQuery("next"));
        location.href = next || basePrefix + "dashboard.html";
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        ensureDemoStores();
        const name = qs("#name").value.trim();
        const email = qs("#email").value.trim().toLowerCase();
        const password = qs("#password").value;
        if (password.length < 4) {
          toast(t("auth.weak"), "bad");
          return;
        }

        const users = readStore(STORAGE.users, []);
        if (users.some((u) => u.email === email)) {
          toast(t("auth.exists"), "bad");
          return;
        }
        users.unshift({ email, password, name: name || "User", role: "user" });
        writeStore(STORAGE.users, users);

        setUser({ email, name: name || "User", role: "user", lang: getLang() });
        toast(t("auth.created"), "ok");
        const next = safeNextUrl(getQuery("next"));
        location.href = next || basePrefix + "profile.html";
      });
    }

    if (forgotForm) {
      forgotForm.addEventListener("submit", (e) => {
        e.preventDefault();
        toast(t("auth.resetSent"), "ok");
        setTimeout(() => (location.href = basePrefix + "login.html"), 800);
      });
    }
  }

  function renderProducts() {
    const host = qs("#products-grid");
    if (!host) return;

    const products = (window.NETRICA_DEMO && window.NETRICA_DEMO.products) || [];
    host.innerHTML = "";

    products.forEach((p) => {
      const el = document.createElement("div");
      el.className = "card pad product-card";
      const features = p.featuresKeys.map((k) => `<li>${t(k)}</li>`).join("");
      el.innerHTML = `
        <div class="product-card-head">
          <div>
            <div class="product-card-kicker">${t("ui.badge.serviceNode")}</div>
            <h3>${t(p.nameKey)}</h3>
          </div>
          <span class="badge product-price-badge">${p.priceText}</span>
        </div>
        <p class="muted product-card-desc">${t(p.descKey)}</p>
        <div class="hr"></div>
        <ul class="muted product-feature-list" style="margin:0; padding-left:18px">${features}</ul>
        <div class="product-card-actions" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px">
          <a class="btn" href="product-detail.html?id=${encodeURIComponent(p.id)}">${t("products.details")}</a>
          <a class="btn primary" href="product-detail.html?id=${encodeURIComponent(p.id)}#order">${t("products.order")}</a>
          <a class="btn" href="payment.html?type=subscription&product=${encodeURIComponent(p.id)}">${t("products.subscribe")}</a>
        </div>
      `;
      host.appendChild(el);
    });
  }

  function renderProductDetail() {
    const host = qs("#product-detail");
    if (!host) return;

    const id = getQuery("id") || "";
    const products = (window.NETRICA_DEMO && window.NETRICA_DEMO.products) || [];
    const p = products.find((x) => x.id === id) || products[0];

    const features = p.featuresKeys.map((k) => `<li>${t(k)}</li>`).join("");
    const useCases = p.useCasesKeys.map((k) => `<li>${t(k)}</li>`).join("");

    // Admin custom data
    const customAll = JSON.parse(localStorage.getItem("netrica_product_custom") || "{}");
    const pc = customAll[p.id] || {};
    const extraFeatures = (pc.extraFeatures || []).map((f) => `<li style="color:var(--accent)">${escapeHtml(f)}</li>`).join("");
    const extraUseCases = (pc.extraUseCases || []).map((u) => `<li style="color:var(--accent)">${escapeHtml(u)}</li>`).join("");
    const displayPrice = pc.price || p.priceText;
    const adminNote = pc.note || "";

    host.innerHTML = `
      <section class="section page-intro page-intro-detail">
        <div class="page-intro-copy">
          <div class="hero-badge">${t("ui.badge.productCore")}</div>
          <h1 class="h1" style="font-size:44px; margin:0">${t(p.nameKey)}</h1>
          <p class="lead" style="margin-top:8px">${t(p.descKey)}</p>
        </div>
        <div class="page-intro-stats single">
          <div class="page-intro-stat"><span>${t("products.price")}</span><strong>${displayPrice}</strong></div>
        </div>
      </section>

      <div class="card pad product-detail-card">
        <div class="product-detail-top">
          <div class="product-detail-copy">
            <h1 class="h1" style="font-size:28px; margin:0">${t(p.nameKey)}</h1>
            <p class="lead" style="margin-top:6px">${t(p.descKey)}</p>
          </div>
          <div class="product-detail-side" style="display:flex; gap:10px; align-items:center">
            <span class="badge">${t("products.price")}: ${displayPrice}</span>
            <a class="btn" href="payment.html?type=subscription&product=${encodeURIComponent(p.id)}">${t("products.subscribe")}</a>
          </div>
        </div>
        ${adminNote ? `<div class="card" style="margin-top:14px;padding:14px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:14px"><b style="color:var(--accent)">Mahsulot haqida:</b><p style="margin:6px 0 0">${escapeHtml(adminNote)}</p></div>` : ""}
        <div class="hr"></div>
        <div class="grid-2 product-detail-grid">
          <div class="product-detail-panel">
            <h3>${t("products.features")}</h3>
            <ul class="muted" style="margin:0; padding-left:18px">${features}${extraFeatures}</ul>
          </div>
          <div class="product-detail-panel">
            <h3>${t("products.useCases")}</h3>
            <ul class="muted" style="margin:0; padding-left:18px">${useCases}${extraUseCases}</ul>
          </div>
        </div>
      </div>

      <div id="order" class="section">
        <div class="section-title">
          <h2>${t("order.title")}</h2>
          <p>${t("order.hint")}</p>
        </div>
        <div class="card pad product-order-card">
          <form class="form" id="order-form">
            <div class="grid-2">
              <div class="field">
                <label for="project">${t("order.project")}</label>
                <input id="project" required />
              </div>
              <div class="field">
                <label for="deadline">${t("order.deadline")}</label>
                <input id="deadline" placeholder="2026-04-30" />
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="budget">${t("order.budget")}</label>
                <input id="budget" placeholder="$" />
                <div class="helper">${t("order.budgetOptional")}</div>
              </div>
              <div class="field">
                <label for="email">${t("order.email")}</label>
                <input id="email" type="email" required />
              </div>
            </div>
            <div class="field">
              <label for="req">${t("order.req")}</label>
              <textarea id="req" required></textarea>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap">
              <button class="btn primary" type="submit">${t("order.submit")}</button>
              <a class="btn" href="dashboard.html">${t("order.toDashboard")}</a>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = qs("#order-form");
    if (form) {
      const user = getUser();
      if (user) {
        qs("#email").value = user.email;
      }
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!requireAuth()) return;
        ensureDemoStores();
        const orders = readStore(STORAGE.orders, []);
        orders.unshift({
          id: "ord_" + Math.random().toString(16).slice(2),
          productId: p.id,
          project: qs("#project").value.trim(),
          requirements: qs("#req").value.trim(),
          status: t("tz.status.new"),
          createdAt: new Date().toISOString()
        });
        writeStore(STORAGE.orders, orders);
        toast(t("order.sent"), "ok");
        setTimeout(() => (location.href = basePrefix + "my-orders.html"), 700);
      });
    }
  }

  function renderDashboard() {
    const host = qs("#dashboard");
    if (!host) return;
    if (!requireAuth()) return;
    ensureDemoStores();

    const user = getUser();
    const chats = readStore(STORAGE.chats, []);
    const tz = readStore(STORAGE.tz, []);
    const orders = readStore(STORAGE.orders, []);
    const subs = readStore(STORAGE.subs, []);

    host.innerHTML = `
      <div class="dash-layout dashboard-shell">
        <aside class="card pad dash-sidebar">
          <a class="dash-brand brand" href="index.html">
            <img src="${basePrefix}assets/img/logo.svg" alt="" />
            <span>NETRICA</span>
          </a>

          <div class="dash-user">
            <div class="dash-avatar" id="sb-avatar">${(user.name || user.email || "U").trim().slice(0, 1).toUpperCase()}</div>
            <div>
              <div class="dash-user-name" id="sb-name">${escapeHtml(user.name || "User")}</div>
              <div class="dash-user-role" id="sb-role">${escapeHtml(user.role || "user")}</div>
            </div>
          </div>

          <div class="dash-group">${t("page.dashboard.groupMain")}</div>
          <nav class="dash-nav" aria-label="Dashboard navigation">
            <a href="dashboard.html" aria-current="page">${t("page.dashboard.linkDashboard")}</a>
            <a href="my-chats.html">${t("page.dashboard.menuChats")}</a>
            <a href="my-tz.html">${t("page.dashboard.menuTz")}</a>
            <a href="my-orders.html">${t("page.dashboard.menuOrders")}</a>
          </nav>

          <div class="dash-group">${t("page.dashboard.groupSystem")}</div>
          <nav class="dash-nav" aria-label="Account navigation">
            <a href="subscriptions.html">${t("page.dashboard.menuSubs")}</a>
            <a href="messages.html">${t("page.dashboard.menuMsg")}</a>
            <a href="profile.html">${t("page.dashboard.menuProfile")}</a>
            <a href="index.html">${t("page.dashboard.linkHome")}</a>
          </nav>

          ${user.role === "admin" ? `
            <div class="dash-group">${t("ui.dash.admin")}</div>
            <nav class="dash-nav" aria-label="Admin navigation">
              <a href="admin/index.html">${t("admin.title")}</a>
            </nav>
          ` : ""}

          <div class="dash-sidebar-footer">
            <button class="btn dash-logout" id="sidebar-logout" type="button">${t("nav.logout")}</button>
          </div>
        </aside>

        <div class="dash-content">
          <div id="dash-view-dashboard">
            <div class="card pad dashboard-overview">
              <div class="dashboard-overview-copy">
                <div class="dashboard-badge">${t("dash.subtitle")}</div>
                <h2 class="dashboard-title">${t("dash.hello", { name: user.name || "User" })}</h2>
                <p class="muted dashboard-lead">${t("dash.activityDesc")}</p>
              </div>
              <div class="dashboard-overview-side">
                <div class="dashboard-overview-actions">
                  <a class="btn primary" href="chat.html">${t("nav.chat")}</a>
                  <a class="btn" href="products.html">${t("nav.products")}</a>
                </div>
                <div class="dashboard-visual-panel">
                  <div class="dashboard-visual-orbit">
                    <span class="dashboard-visual-ring dashboard-visual-ring-a"></span>
                    <span class="dashboard-visual-ring dashboard-visual-ring-b"></span>
                    <span class="dashboard-visual-ring dashboard-visual-ring-c"></span>
                    <div class="dashboard-visual-core">
                      <span>${t("ui.dash.mesh")}</span>
                      <strong>${chats.length + tz.length + orders.length}</strong>
                      <small>${t("ui.dash.liveChannels")}</small>
                    </div>
                    <div class="dashboard-visual-chip dashboard-visual-chip-a">${t("page.dashboard.menuChats")} ${chats.length}</div>
                    <div class="dashboard-visual-chip dashboard-visual-chip-b">${t("page.dashboard.menuOrders")} ${orders.length}</div>
                    <div class="dashboard-visual-chip dashboard-visual-chip-c">${t("page.dashboard.menuSubs")} ${subs.filter((s) => s.active).length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="dashboard-stats-grid section" style="margin-top:14px">
              <div class="card pad dashboard-stat-card">
                <div class="dashboard-stat-top">
                  <div class="small dashboard-stat-label">${t("dash.stats.chats")}</div>
                  <div class="dashboard-stat-orb"></div>
                </div>
                <div class="dashboard-stat-value">${chats.length}</div>
                <div class="small dashboard-stat-meta">${t("ui.dash.dialogStream")}</div>
              </div>
              <div class="card pad dashboard-stat-card">
                <div class="dashboard-stat-top">
                  <div class="small dashboard-stat-label">${t("dash.stats.tz")}</div>
                  <div class="dashboard-stat-orb"></div>
                </div>
                <div class="dashboard-stat-value">${tz.length}</div>
                <div class="small dashboard-stat-meta">${t("ui.dash.activeBriefs")}</div>
              </div>
              <div class="card pad dashboard-stat-card">
                <div class="dashboard-stat-top">
                  <div class="small dashboard-stat-label">${t("dash.stats.orders")}</div>
                  <div class="dashboard-stat-orb"></div>
                </div>
                <div class="dashboard-stat-value">${orders.length}</div>
                <div class="small dashboard-stat-meta">${t("ui.dash.deliveryPipeline")}</div>
              </div>
              <div class="card pad dashboard-stat-card">
                <div class="dashboard-stat-top">
                  <div class="small dashboard-stat-label">${t("dash.stats.subs")}</div>
                  <div class="dashboard-stat-orb"></div>
                </div>
                <div class="dashboard-stat-value">${subs.filter((s) => s.active).length}</div>
                <div class="small dashboard-stat-meta">${t("ui.dash.premiumAccess")}</div>
              </div>
            </div>

            <div class="dashboard-main-grid section" style="margin-top:18px">
              <div class="dashboard-quick-grid">
                <a class="card pad dashboard-card" href="my-chats.html">
                  <div class="dashboard-card-head">
                    <div class="dashboard-card-label">${t("page.dashboard.menuChats")}</div>
                    <div class="dashboard-card-go">${t("ui.dash.go")}</div>
                  </div>
                  <h3>${t("dash.quick.chats")}</h3>
                  <p class="muted">${t("dash.quick.chatsDesc")}</p>
                </a>
                <a class="card pad dashboard-card" href="my-tz.html">
                  <div class="dashboard-card-head">
                    <div class="dashboard-card-label">${t("page.dashboard.menuTz")}</div>
                    <div class="dashboard-card-go">${t("ui.dash.go")}</div>
                  </div>
                  <h3>${t("dash.quick.tz")}</h3>
                  <p class="muted">${t("dash.quick.tzDesc")}</p>
                </a>
                <a class="card pad dashboard-card" href="my-orders.html">
                  <div class="dashboard-card-head">
                    <div class="dashboard-card-label">${t("page.dashboard.menuOrders")}</div>
                    <div class="dashboard-card-go">${t("ui.dash.go")}</div>
                  </div>
                  <h3>${t("dash.quick.orders")}</h3>
                  <p class="muted">${t("dash.quick.ordersDesc")}</p>
                </a>
              </div>

              <div class="card pad dash-activity-card">
                <div class="section-title stack" style="margin:0 0 12px">
                  <h2>${t("dash.activity")}</h2>
                  <p>${t("dash.activityDesc")}</p>
                </div>
                <div class="list" id="activity"></div>
              </div>
            </div>
          </div>

          <div id="dash-view-embed" hidden>
            <div class="dash-embed-bar">
              <button class="btn" type="button" id="dash-embed-back">${t("common.back")}</button>
            </div>
            <iframe class="dash-embed-frame" id="dash-embed-frame" title="Embedded content"></iframe>
          </div>
        </div>
      </div>
    `;

    const activity = qs("#activity");
    const rows = [];
    if (orders[0]) rows.push(`<div><b>${t("dash.act.order")}</b><div class="small">${orders[0].project} вЂў ${orders[0].status}</div></div><div class="small">${new Date(orders[0].createdAt).toLocaleDateString()}</div>`);
    if (tz[0]) rows.push(`<div><b>${t("dash.act.tz")}</b><div class="small">${tz[0].title}</div></div><div class="small">${new Date(tz[0].createdAt).toLocaleDateString()}</div>`);
    if (chats[0]) rows.push(`<div><b>${t("dash.act.chat")}</b><div class="small">${chats[0].title}</div></div><div class="small">${new Date(chats[0].createdAt).toLocaleDateString()}</div>`);
    if (!rows.length) rows.push(`<div class="list-empty"><b>${t("dash.empty")}</b></div>`);
    listRender(activity, rows);

    const sbLogout = qs("#sidebar-logout");
    if (sbLogout) sbLogout.addEventListener("click", logout);
    const sbName = qs("#sb-name");
    const sbRole = qs("#sb-role");
    const sbAvatar = qs("#sb-avatar");
    if (sbName) sbName.textContent = user.name || "User";
    if (sbRole) sbRole.textContent = user.role || "user";
    if (sbAvatar) sbAvatar.textContent = (user.name || user.email || "U").trim().slice(0, 1).toUpperCase();

    const viewDash = qs("#dash-view-dashboard");
    const viewEmbed = qs("#dash-view-embed");
    const frame = qs("#dash-embed-frame");
    const backBtn = qs("#dash-embed-back");
    const navLinks = qsa(".dash-nav a");

    function markCurrent(href) {
      navLinks.forEach((a) => a.removeAttribute("aria-current"));
      const match = navLinks.find((a) => a.getAttribute("href") === href);
      if (match) match.setAttribute("aria-current", "page");
    }

    function openEmbed(href) {
      if (href === "index.html" || href === "profile.html" || href.startsWith("admin/")) {
        localStorage.removeItem(STORAGE.dashView);
        location.href = basePrefix + href;
        return;
      }
      if (!viewDash || !viewEmbed || !frame) {
        location.href = basePrefix + href;
        return;
      }
      const url = new URL(href, location.href);
      url.searchParams.set("embed", "1");
      frame.src = url.toString();
      viewDash.hidden = true;
      viewEmbed.hidden = false;
      localStorage.setItem(STORAGE.dashView, href);
      markCurrent(href);
    }

    function closeEmbed() {
      if (!viewDash || !viewEmbed || !frame) return;
      frame.src = "about:blank";
      viewEmbed.hidden = true;
      viewDash.hidden = false;
      localStorage.removeItem(STORAGE.dashView);
      markCurrent("dashboard.html");
    }

    if (backBtn) backBtn.addEventListener("click", closeEmbed);

    navLinks.forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (href === "index.html" || href === "profile.html" || href.startsWith("admin/")) {
          localStorage.removeItem(STORAGE.dashView);
          location.href = basePrefix + href;
          return;
        }
        if (href === "dashboard.html") closeEmbed();
        else openEmbed(href);
      });
    });

    host.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      if (/^(https?:|mailto:|tel:)/.test(href) || href.startsWith("#")) return;
      e.preventDefault();
      if (href === "index.html" || href === "profile.html" || href.startsWith("admin/")) {
        localStorage.removeItem(STORAGE.dashView);
        location.href = basePrefix + href;
        return;
      }
      openEmbed(href);
    });

    if (getQuery("view") === "home") {
      localStorage.removeItem(STORAGE.dashView);
      closeEmbed();
      return;
    }

    const saved = localStorage.getItem(STORAGE.dashView);
    if (saved === "index.html" || saved === "profile.html" || (saved && saved.startsWith("admin/"))) {
      localStorage.removeItem(STORAGE.dashView);
      closeEmbed();
    } else if (saved) {
      openEmbed(saved);
    } else {
      closeEmbed();
    }
  }

  function renderMyLists() {
    const page = document.body.getAttribute("data-page");
    if (!page) return;
    if (page.startsWith("dash") || page.startsWith("my") || page === "profile") {
      if (!requireAuth()) return;
      ensureDemoStores();
    }

    if (page === "my-chats") {
      const host = qs("#my-chats");
      const chats = readStore(STORAGE.chats, []);
      const aiChats = chats.filter((c) => {
        if (!c) return false;
        if (c.kind === "ai" || c.type === "ai") return true;
        const msgs = Array.isArray(c.messages) ? c.messages : [];
        return msgs.some((m) => m && m.role === "ai");
      });

      const rows = aiChats.map(
        (c) => `<div><b>${c.title}</b><div class="small">${t("chat.session")} вЂў ${new Date(c.createdAt).toLocaleString()}</div></div><a class="btn" href="${basePrefix}chat.html?chat=${encodeURIComponent(c.id)}">${t("common.open")}</a>`
      );
      listRender(host, rows.length ? rows : [listEmptyItem()]);
    }

    if (page === "my-tz") {
      const host = qs("#my-tz");
      const tz = readStore(STORAGE.tz, []);
      const rows = tz.map(
        (d) => `<div><b>${d.title}</b><div class="row-meta"><span class="hud-mini-pill">${d.format}</span><span>${new Date(d.createdAt).toLocaleString()}</span><span>${d.status}</span></div></div><button class="btn" data-dl="${d.id}">${t("tz.download")}</button>`
      );
      listRender(host, rows.length ? rows : [listEmptyItem()]);

      qsa("[data-dl]").forEach((btn) => {
        btn.addEventListener("click", function() {
          var dlId = this.getAttribute('data-dl');
          var tzItem = tz.find(function(d) { return d.id === dlId; });
          if (!tzItem) { toast(t('tz.demoDownload'), 'ok'); return; }
          var content = 'NETRICA - Texnik Topshiriq\n\n';
          content += 'Sarlavha: ' + (tzItem.title || '') + '\n';
          content += 'Format: ' + (tzItem.format || '') + '\n';
          content += 'Holat: ' + (tzItem.status || '') + '\n';
          content += 'Yaratilgan: ' + new Date(tzItem.createdAt).toLocaleString() + '\n';
          if (tzItem.requirements) content += '\nTalablar:\n' + tzItem.requirements + '\n';
          if (tzItem.project) content += 'Loyiha: ' + tzItem.project + '\n';
          var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = (tzItem.title || 'Netrica_TZ') + '.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast(t('tz.demoDownload'), 'ok');
        });
      });
    }

    if (page === "my-orders") {
      const host = qs("#my-orders");
      const orders = readStore(STORAGE.orders, []);

      function statusStyle(s) {
        if (s === "Tayyor" || s === "Qabul qilingan") return "background:rgba(34,197,94,.15);color:#22c55e;border-color:rgba(34,197,94,.3)";
        if (s === "Jarayonda") return "background:rgba(56,189,248,.15);color:#38bdf8;border-color:rgba(56,189,248,.3)";
        if (s === "Bekor qilingan") return "background:rgba(239,68,68,.15);color:#ef4444;border-color:rgba(239,68,68,.3)";
        return "background:rgba(234,179,8,.15);color:#eab308;border-color:rgba(234,179,8,.3)";
      }

      const rows = orders.map(function(o) {
        var project = escapeHtml(o.project || "вЂ”");
        var product = escapeHtml(o.productId || "вЂ”");
        var status = escapeHtml(o.status || "Yangi");
        var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : "вЂ”";
        var req = escapeHtml((o.requirements || "").slice(0, 80));
        return '<div><b>' + project + '</b><div class="small">' + req + '</div><div class="row-meta"><span class="hud-mini-pill">' + product + '</span><span>' + when + '</span></div></div><span class="badge" style="' + statusStyle(o.status) + ';font-weight:700">' + status + '</span>';
      });
      listRender(host, rows.length ? rows : [listEmptyItem()]);

      // Auto-refresh every 5s to show admin status changes
      setInterval(function() {
        var fresh = readStore(STORAGE.orders, []);
        var freshRows = fresh.map(function(o) {
          var project = escapeHtml(o.project || "вЂ”");
          var product = escapeHtml(o.productId || "вЂ”");
          var status = escapeHtml(o.status || "Yangi");
          var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : "вЂ”";
          var req = escapeHtml((o.requirements || "").slice(0, 80));
          return '<div><b>' + project + '</b><div class="small">' + req + '</div><div class="row-meta"><span class="hud-mini-pill">' + product + '</span><span>' + when + '</span></div></div><span class="badge" style="' + statusStyle(o.status) + ';font-weight:700">' + status + '</span>';
        });
        listRender(host, freshRows.length ? freshRows : [listEmptyItem()]);
      }, 5000);
    }

    if (page === "messages") {
      const host = qs("#messages");
      const user = getUser();
      const mineEmail = user && user.email ? user.email : "";

      const tabThreads = qs("#msg-tab-threads");
      const tabCompose = qs("#msg-tab-compose");
      const panelThreads = qs("#messages-panel");
      const panelCompose = qs("#compose-panel");

      function setView(view) {
        if (panelThreads) panelThreads.classList.toggle("hidden", view !== "threads");
        if (panelCompose) panelCompose.classList.toggle("hidden", view !== "compose");
        if (tabThreads) {
          tabThreads.classList.toggle("primary", view === "threads");
          tabThreads.setAttribute("aria-pressed", view === "threads" ? "true" : "false");
        }
        if (tabCompose) {
          tabCompose.classList.toggle("primary", view === "compose");
          tabCompose.setAttribute("aria-pressed", view === "threads" ? "false" : "true");
        }
      }

      if (tabThreads && tabCompose && panelThreads && panelCompose) {
        tabThreads.addEventListener("click", () => setView("threads"));
        tabCompose.addEventListener("click", () => setView("compose"));
        setView("threads");
      }

      async function renderThreads() {
        ensureDemoStores();

        let mine = [];
        if (await apiAvailable()) {
          try {
            mine = await apiGetMessages();
          } catch {
            const all = readStore(STORAGE.messages, []);
            mine = all.filter((m) => !mineEmail || m.userEmail === mineEmail);
          }
        } else {
          const all = readStore(STORAGE.messages, []);
          mine = all.filter((m) => !mineEmail || m.userEmail === mineEmail);
        }

        const rows = mine.map((m) => {
          const when = m.createdAt ? new Date(m.createdAt).toLocaleString() : "вЂ”";
          const text = escapeHtml(m.text || "");
          return `<div><b>${t("msg.thread")}</b><div class="small">${text}</div><div class="row-meta"><span class="hud-mini-pill">${t("ui.stat.support").toLowerCase()}</span><span>${when}</span></div></div><div class="small hud-line-mark">${t("ui.stat.live")}</div>`;
        });

        listRender(host, rows.length ? rows : [listEmptyItem()]);
      }

      renderThreads();

      const send = qs("#msg-form");
      if (send) {
        send.addEventListener("submit", (e) => {
          e.preventDefault();
          const textarea = qs("#msg-text");
          const text = textarea.value.trim();
          if (!text) return;

          (async () => {
            ensureDemoStores();
            if (await apiAvailable()) {
              try {
                await apiPostMessage(text);
                toast(t("msg.sent"), "ok");
                textarea.value = "";
                await renderThreads();
                setView("threads");
                return;
              } catch {
              }
            }

            const all = readStore(STORAGE.messages, []);
            all.unshift({
              id: "msg_" + Math.random().toString(16).slice(2),
              userEmail: mineEmail,
              text,
              createdAt: new Date().toISOString()
            });
            writeStore(STORAGE.messages, all);
            toast(t("msg.sent"), "ok");
            textarea.value = "";
            await renderThreads();
            setView("threads");
          })();
        });
      }
    }

    if (page === "profile") {
      const user = getUser();
      qs("#p-name").value = user.name || "";
      qs("#p-email").value = user.email || "";
      const form = qs("#profile-form");
      if (form) {
        if (form.dataset.bound === "1") return;
        form.dataset.bound = "1";
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const btn = form.querySelector('button[type="submit"]');
          if (btn) {
            if (btn.dataset.busy === "1") return;
            btn.dataset.busy = "1";
            btn.disabled = true;
            setTimeout(() => {
              btn.disabled = false;
              btn.dataset.busy = "0";
            }, 700);
          }
          user.name = qs("#p-name").value.trim() || user.name;
          setUser(user);
          toast(t("profile.saved"), "ok");
        });
      }
    }

    if (page === "subscriptions") {
      const host = qs("#subs");
      const detail = qs("#sub-detail");
      const subs = readStore(STORAGE.subs, []);
      const products = (window.NETRICA_DEMO && window.NETRICA_DEMO.products) || [];
      const custom = safeJsonParse(localStorage.getItem("netrica_product_custom"), {});

      function statusStyle(active) {
        return active
          ? "background:#22c55e;color:#fff;padding:4px 12px;border-radius:8px;font-size:.85rem"
          : "background:#ef4444;color:#fff;padding:4px 12px;border-radius:8px;font-size:.85rem";
      }

      function renderList() {
        host.style.display = "";
        detail.style.display = "none";
        const rows = subs.map((s) => {
          const prod = products.find((p) => p.id === s.productId);
          const name = prod ? t(prod.nameKey) : s.productId;
          return `<div class="row" style="cursor:pointer" data-sub="${s.id}"><div><b>${name}</b><div class="row-meta"><span style="${statusStyle(s.active)}">${s.active ? t("subs.active") : t("subs.inactive")}</span><span>${new Date(s.startAt).toLocaleDateString()} вЂ” ${new Date(s.endAt).toLocaleDateString()}</span></div></div><span style="font-size:1.2rem;opacity:.5">&#8250;</span></div>`;
        });
        host.innerHTML = "";
        if (!rows.length) { host.innerHTML = listEmptyItem(); return; }
        rows.forEach((r) => { host.innerHTML += r; });
        host.querySelectorAll("[data-sub]").forEach((row) => {
          row.addEventListener("click", () => openDetail(row.getAttribute("data-sub")));
        });
      }

      function openDetail(subId) {
        const s = subs.find((x) => x.id === subId);
        if (!s) return;
        const prod = products.find((p) => p.id === s.productId);
        const name = prod ? t(prod.nameKey) : s.productId;
        const desc = prod ? t(prod.descKey) : "";
        const price = (custom[s.productId] && custom[s.productId].price) || (prod ? prod.priceText : "вЂ”");
        const daysLeft = Math.max(0, Math.ceil((new Date(s.endAt) - Date.now()) / 86400000));

        let featuresHtml = "";
        if (prod && prod.featuresKeys) {
          featuresHtml = prod.featuresKeys.map((k) => `<li>${t(k)}</li>`).join("");
        }
        if (custom[s.productId] && custom[s.productId].features) {
          featuresHtml += custom[s.productId].features.map((f) => `<li style="color:var(--accent)">${f}</li>`).join("");
        }

        let useCasesHtml = "";
        if (prod && prod.useCasesKeys) {
          useCasesHtml = prod.useCasesKeys.map((k) => `<li>${t(k)}</li>`).join("");
        }
        if (custom[s.productId] && custom[s.productId].useCases) {
          useCasesHtml += custom[s.productId].useCases.map((u) => `<li style="color:var(--accent)">${u}</li>`).join("");
        }

        host.style.display = "none";
        detail.style.display = "block";
        detail.innerHTML = `
          <button class="btn" id="sub-back" style="margin-bottom:1rem">&#8592; Orqaga</button>
          <h2 style="margin-bottom:.3rem">${name}</h2>
          <p class="muted" style="margin-bottom:1.2rem">${desc}</p>
          <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1.2rem">
            <div class="page-intro-stat"><span>Holat</span><strong style="${statusStyle(s.active)}">${s.active ? t("subs.active") : t("subs.inactive")}</strong></div>
            <div class="page-intro-stat"><span>Narx</span><strong>${price}</strong></div>
            <div class="page-intro-stat"><span>Qolgan kunlar</span><strong>${s.active ? daysLeft + " kun" : "вЂ”"}</strong></div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1.2rem">
            <div class="page-intro-stat"><span>Boshlanish</span><strong>${new Date(s.startAt).toLocaleDateString()}</strong></div>
            <div class="page-intro-stat"><span>Tugash</span><strong>${new Date(s.endAt).toLocaleDateString()}</strong></div>
          </div>
          ${featuresHtml ? `<h3 style="margin-bottom:.5rem">Xususiyatlar</h3><ul style="margin-bottom:1rem;padding-left:1.2rem">${featuresHtml}</ul>` : ""}
          ${useCasesHtml ? `<h3 style="margin-bottom:.5rem">Foydalanish holatlari</h3><ul style="margin-bottom:1rem;padding-left:1.2rem">${useCasesHtml}</ul>` : ""}
          ${s.active ? `<button class="btn danger" id="sub-cancel-btn" style="margin-top:.5rem">Obunani bekor qilish</button>` : `<a class="btn" href="payment.html?type=subscription&product=${encodeURIComponent(s.productId)}" style="margin-top:.5rem">Qayta obuna bo'lish</a>`}
        `;
        qs("#sub-back").addEventListener("click", renderList);
        var cancelBtn = qs("#sub-cancel-btn");
        if (cancelBtn) {
          cancelBtn.addEventListener("click", () => {
            const next = subs.map((x) => (x.id === subId ? { ...x, active: false } : x));
            writeStore(STORAGE.subs, next);
            toast(t("subs.canceled"), "ok");
            renderMyLists();
          });
        }
      }

      renderList();
    }
  }

  function renderPayment() {
    const host = qs("#payment");
    if (!host) return;
    if (!requireAuth()) return;
    ensureDemoStores();

    const type = getQuery("type") || "tz";
    const product = getQuery("product") || "";

    const titleKey = type === "subscription" ? "pay.subTitle" : (type === "tz_order" ? "pay.tzTitle" : "pay.tzTitle");
    const amount = type === "subscription" ? "$29" : "$99";
    const pendingTzOrder = type === "tz_order" ? safeJsonParse(localStorage.getItem("netrica_pending_tz_order"), null) : null;
    const isTzWrite = type === "tz_write";

    host.innerHTML = `
      <div class="section-title">
        <h2>${t(titleKey)}</h2>
        <p>${t("pay.demo")}</p>
      </div>
      ${isTzWrite ? `<div class="card pad" style="margin-bottom:18px;border:1px solid rgba(140,120,255,.2);background:rgba(140,120,255,.06)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><b>✍️ TZ yozish xizmati</b></div>
        <div class="small">AI sizning loyihangiz uchun professional texnik topshiriq (TZ) tayyorlab beradi.</div>
      </div>` : ""}
      ${pendingTzOrder ? `<div class="card pad" style="margin-bottom:18px;border:1px solid rgba(140,120,255,.2);background:rgba(140,120,255,.06)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><b>\ud83d\udcc4 TZ buyurtma</b></div>
        <div class="small" style="margin-bottom:4px"><b>Loyiha:</b> ${escapeHtml(pendingTzOrder.project || "TZ loyiha")}</div>
        <div class="small"><b>Fayl:</b> ${escapeHtml(pendingTzOrder.tzOriginalName || "—")}</div>
      </div>` : ""}
      <div class="card pad">
        <div class="grid-2">
          <div>
            <div class="badge">${t("pay.amount")}: ${amount}</div>
            <div class="pills">
              <span class="pill">${t("pay.testCard")}: 4242 4242 4242 4242</span>
              <span class="pill">${t("pay.wait")}</span>
            </div>
          </div>
          <form class="form" id="pay-form">
            <div class="field">
              <label for="card">${t("pay.card")}</label>
              <input id="card" inputmode="numeric" placeholder="4242 4242 4242 4242" required />
            </div>
            <div class="grid-2">
              <div class="field"><label for="exp">${t("pay.exp")}</label><input id="exp" placeholder="12/30" required /></div>
              <div class="field"><label for="cvc">${t("pay.cvc")}</label><input id="cvc" placeholder="123" required /></div>
            </div>
            <button class="btn primary" type="submit">${t("pay.pay")}</button>
          </form>
        </div>
      </div>
    `;

    const form = qs("#pay-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const card = qs("#card").value.replaceAll(" ", "");
      if (card !== "4242424242424242") {
        toast(t("pay.declined"), "bad");
        return;
      }
      toast(t("pay.processing"), "ok");
      await new Promise((r) => setTimeout(r, 2200));

      if (isTzWrite) {
        localStorage.setItem("netrica_tz_write_paid", "true");
        toast(t("pay.success"), "ok");
        setTimeout(() => (location.href = basePrefix + "chat.html"), 700);
        return;
      }

      if (type === "subscription") {
        const subs = readStore(STORAGE.subs, []);
        subs.unshift({
          id: "sub_" + Math.random().toString(16).slice(2),
          productId: product || "netrica-chat",
          active: true,
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        });
        writeStore(STORAGE.subs, subs);
        toast(t("pay.success"), "ok");
        setTimeout(() => (location.href = basePrefix + "subscriptions.html"), 700);
        return;
      }

      if (type === "tz_order" && pendingTzOrder) {
        const orders = readStore(STORAGE.orders, []);
        orders.unshift({
          id: pendingTzOrder.id,
          productId: pendingTzOrder.productId,
          project: pendingTzOrder.project,
          requirements: pendingTzOrder.requirements,
          tzFile: pendingTzOrder.tzFile,
          tzOriginalName: pendingTzOrder.tzOriginalName,
          status: "Yangi",
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString()
        });
        writeStore(STORAGE.orders, orders);
        localStorage.removeItem("netrica_pending_tz_order");
        toast(t("pay.success"), "ok");
        setTimeout(() => (location.href = basePrefix + "my-orders.html"), 700);
        return;
      }

      const tz = readStore(STORAGE.tz, []);
      tz.unshift({
        id: "tz_" + Math.random().toString(16).slice(2),
        title: t("tz.generatedTitle"),
        format: "PDF",
        status: t("tz.status.new"),
        createdAt: new Date().toISOString()
      });
      writeStore(STORAGE.tz, tz);
      toast(t("pay.success"), "ok");
      setTimeout(() => (location.href = basePrefix + "my-tz.html"), 700);
    });
  }

  function renderChat() {
    const host = qs("#chat");
    if (!host) return;
    if (!requireAuth()) return;
    ensureDemoStores();

    const chatId = getQuery("chat") || null;
    const chats = readStore(STORAGE.chats, []);
    const existing = chatId ? chats.find((c) => c.id === chatId) : null;

    let session = existing || {
      id: "chat_" + Math.random().toString(16).slice(2),
      kind: "ai",
      title: t("chat.newTitle"),
      createdAt: new Date().toISOString(),
      messages: []
    };

    if (!session.kind) session.kind = "ai";

    host.innerHTML = `
      <div class="card chat-frame">
        <div class="chat-topbar">
          <div class="chat-topbar-copy">
            <div class="chat-intro-badge">${t("chat.title")}</div>
            <div class="small">${t("chat.onlyNetrica")}</div>
          </div>
          <div class="chat-topbar-actions">
            <button class="btn" id="open-history">${t("chat.history")}</button>
            <button class="btn" id="new-chat">${t("chat.new")}</button>
            <button class="btn danger" id="clear-chat">${t("chat.clear")}</button>
          </div>
        </div>
        <div class="chat-wrap">
          <div class="chat-log" id="chat-log" aria-live="polite"></div>
          <div class="chat-input">
            <input type="file" id="chat-tz-file" accept=".txt,.md,.pdf,.docx,.doc,.rtf" style="display:none">
            <button class="btn chat-tz-btn" type="button" id="chat-tz-upload" title="TZ fayl yuklash">&#128206;</button>
            <textarea id="chat-text" data-i18n-placeholder="chat.placeholder"></textarea>
            <button class="btn primary chat-send" type="button" id="chat-send" aria-label="${t("chat.send")}" title="${t("chat.send")}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M2.2 11.2 21 3.2c.8-.3 1.6.5 1.3 1.3l-8 18.8c-.3.8-1.5.8-1.8 0l-3.2-7.2-7.2-3.2c-.8-.3-.8-1.5.1-1.7ZM10.7 14.1l2.2 5 5.5-13-13 5.5 5 2.2 5.7-5.7c.3-.3.8-.3 1.1 0s.3.8 0 1.1l-5.5 5.9Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="section" id="tz-offer" style="display:none">
        <div class="card pad chat-offer-card">
          <h3 style="margin-top:0">${t("chat.tzOfferTitle")}</h3>
          <p class="muted">${t("chat.tzOfferDesc")}</p>
          <a class="btn primary" href="payment.html?type=tz">${t("chat.makeTz")}</a>
        </div>
      </div>
    `;

    applyTranslations(document);

    const log = qs("#chat-log");

    function appendMsg(role, text, meta) {
      const el = document.createElement("div");
      el.className = `msg ${role === "me" ? "me" : "ai"}`;
      el.innerHTML = `<div>${escapeHtml(text).replaceAll("\n", "<br/>")}</div><div class="meta">${meta || nowTime()}</div>`;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    function formatTzHtml(text) {
      var tzMatch = text.match(/\[TZ_START\]([\s\S]*?)\[TZ_END\]/);
      if (!tzMatch) return escapeHtml(text).replaceAll("\n", "<br/>");
      var before = text.substring(0, text.indexOf("[TZ_START]"));
      var tzContent = tzMatch[1].trim();
      var after = text.substring(text.indexOf("[TZ_END]") + 8);
      var html = escapeHtml(before).replaceAll("\n", "<br/>");
      html += '<div class="tz-document" style="background:rgba(140,120,255,.06);border:1px solid rgba(140,120,255,.2);border-radius:12px;padding:18px;margin:12px 0;white-space:pre-wrap;font-size:14px;line-height:1.7">';
      var formatted = escapeHtml(tzContent)
        .replace(/^## (.+)$/gm, '<h4 style="color:#a78bfa;margin:14px 0 6px">$1</h4>')
        .replace(/^### (.+)$/gm, '<h5 style="color:#c4b5fd;margin:10px 0 4px">$1</h5>')
        .replace(/^# (.+)$/gm, '<h3 style="color:#a78bfa;margin:16px 0 8px;text-align:center">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/^- (.+)$/gm, '<span style="padding-left:12px">\u2022 $1</span>')
        .replaceAll("\n", "<br/>");
      html += formatted + '</div>';
      html += escapeHtml(after).replaceAll("\n", "<br/>");
      return html;
    }

    function appendTzMsg(text, rtime, msgObj) {
      var el = document.createElement("div");
      el.className = "msg ai";
      var hasTz = text.indexOf("[TZ_START]") >= 0;
      if (hasTz) {
        el.innerHTML = '<div>' + formatTzHtml(text) + '</div><div class="meta">' + rtime + '</div>';
        var dlBtn = document.createElement("button");
        dlBtn.className = "btn primary";
        dlBtn.style.cssText = "margin-top:10px;font-size:14px;";
        dlBtn.textContent = "\ud83d\udce5 TZ yuklab olish";
        dlBtn.addEventListener("click", function() {
          var tzMatch2 = text.match(/\[TZ_START\]([\s\S]*?)\[TZ_END\]/);
          var content = tzMatch2 ? tzMatch2[1].trim() : text;
          var blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = (msgObj.filename || "Texnik_Topshiriq") + ".md";
          a.click();
          URL.revokeObjectURL(url);
        });
        el.appendChild(dlBtn);
      } else {
        el.innerHTML = '<div>' + escapeHtml(text).replaceAll("\n", "<br/>") + '</div><div class="meta">' + rtime + '</div>';
      }
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    function saveSession() {
      if (!session.kind) session.kind = "ai";
      const all = readStore(STORAGE.chats, []);
      const idx = all.findIndex((c) => c.id === session.id);
      if (idx >= 0) all[idx] = session;
      else all.unshift(session);
      writeStore(STORAGE.chats, all);
    }

    function offerTzIfReady() {
      const offer = qs("#tz-offer");
      const count = session.messages.length;
      offer.style.display = count >= 6 ? "block" : "none";
    }

    function aiReply(userText) {
      const lower = userText.toLowerCase();
      const offTopic = /\b(weather|football|recipe|politics|stock|crypto|celebrity)\b/i.test(userText);
      if (offTopic) {
        return t("chat.refuse");
      }

      if (lower.includes("tz") || lower.includes("texnik") || lower.includes("topshiriq")) {
        return t("chat.aboutTz");
      }
      if (lower.includes("mahsulot") || lower.includes("product")) {
        return t("chat.aboutProducts");
      }
      if (lower.includes("obuna") || lower.includes("subscription")) {
        return t("chat.aboutSubs");
      }
      return t("chat.default");
    }

    function showTyping() {
      const el = document.createElement("div");
      el.className = "msg ai";
      el.setAttribute("id", "typing");
      el.innerHTML = `<div class="typing" aria-label="typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div class="meta">${t("chat.typing")}</div>`;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    function hideTyping() {
      const el = qs("#typing");
      if (el) el.remove();
    }

    function renderHistory() {
      log.innerHTML = "";
      if (!session.messages.length) {
        appendMsg("ai", t("chat.welcome"));
      } else {
        session.messages.forEach((m) => {
          if (m.role === "ai" && m.text && m.text.indexOf("[TZ_START]") >= 0) {
            appendTzMsg(m.text, m.time, m);
          } else {
            appendMsg(m.role, m.text, m.time);
          }
        });
      }
      offerTzIfReady();
    }

    function send() {
      const textarea = qs("#chat-text");
      const text = textarea.value.trim();
      if (!text) return;

      textarea.value = "";
      const time = nowTime();
      session.messages.push({ role: "me", text, time });
      appendMsg("me", text, time);
      saveSession();

      // Order creation from TZ analysis — redirect to payment first
      if (text.toLowerCase().indexOf("buyurtma") >= 0) {
        var lastA = null;
        for (var mi = session.messages.length - 1; mi >= 0; mi--) {
          if (session.messages[mi].isTzAnalysis) { lastA = session.messages[mi]; break; }
        }
        if (lastA) {
          // Save pending order to localStorage, payment page will finalize it
          var pendingOrder = {
            id: "ord_" + Math.random().toString(16).slice(2),
            productId: lastA.savedFile ? "tz_upload" : "tz_ai",
            project: lastA.filename || "TZ loyiha",
            requirements: lastA.text.substring(0, 500),
            tzFile: lastA.savedFile || "",
            tzOriginalName: lastA.filename || ""
          };
          localStorage.setItem("netrica_pending_tz_order", JSON.stringify(pendingOrder));
          var ct = nowTime();
          session.messages.push({ role: "ai", text: "\ud83d\udcb3 To'lov sahifasiga yo'naltirilmoqda... To'lovni amalga oshiring va buyurtma avtomatik yaratiladi.", time: ct });
          appendMsg("ai", "\ud83d\udcb3 To'lov sahifasiga yo'naltirilmoqda...", ct);
          saveSession();
          setTimeout(function() { location.href = basePrefix + "payment.html?type=tz_order"; }, 1200);
          return;
        }
      }

      showTyping();
      var sendBtnEl = qs("#chat-send");
      if (sendBtnEl) sendBtnEl.disabled = true;
      var history = session.messages.map(function(m) { return { from: m.role === "me" ? "user" : "ai", text: m.text }; });
      var sendText = text;
      if (localStorage.getItem("netrica_tz_write_paid") === "true") { sendText = "[TZ_PAID] " + text; }
      fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sendText, history: history })
      }).then(function(r) { return r.json(); }).then(function(data) {
        hideTyping();
        var reply = (data.ok && data.reply) ? data.reply : aiReply(text);
        var rtime = nowTime();
        // Detect [NEED_PAYMENT] — redirect to payment
        if (reply.indexOf("[NEED_PAYMENT]") >= 0) {
          var cleanReply = reply.replace("[NEED_PAYMENT]", "").trim();
          var msgObj2 = { role: "ai", text: cleanReply, time: rtime };
          session.messages.push(msgObj2);
          appendMsg("ai", cleanReply, rtime);
          saveSession();
          setTimeout(function() { location.href = basePrefix + "payment.html?type=tz_write"; }, 2000);
          return;
        }
        var msgObj = { role: "ai", text: reply, time: rtime };
        // Detect AI-generated TZ with [TZ_START]...[TZ_END]
        if (reply.indexOf("[TZ_START]") >= 0) {
          msgObj.isTzAnalysis = true;
          var nameMatch = reply.match(/Loyiha nomi[:\s]*\*?\*?([^\n*]+)/);
          msgObj.filename = nameMatch ? nameMatch[1].trim() : "AI TZ";
          localStorage.removeItem("netrica_tz_write_paid");
        }
        session.messages.push(msgObj);
        appendTzMsg(reply, rtime, msgObj);
        if (session.title === t("chat.newTitle") && session.messages.length >= 2) { session.title = text.slice(0, 38); }
        saveSession();
        offerTzIfReady();
      }).catch(function() {
        hideTyping();
        var reply = aiReply(text);
        var rtime = nowTime();
        session.messages.push({ role: "ai", text: reply, time: rtime });
        appendMsg("ai", reply, rtime);
        saveSession();
      }).finally(function() { if (sendBtnEl) sendBtnEl.disabled = false; });
    }

    qs("#chat-send").addEventListener("click", send);
    qs("#chat-text").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    qs("#clear-chat").addEventListener("click", () => {
      session.messages = [];
      saveSession();
      renderHistory();
      toast(t("chat.cleared"), "ok");
    });

    qs("#open-history").addEventListener("click", () => {
      location.href = basePrefix + "my-chats.html";
    });

    qs("#new-chat").addEventListener("click", () => {
      location.href = basePrefix + "chat.html";
    });

    // TZ file upload in AI chat
    var chatTzFile = qs("#chat-tz-file");
    var chatTzBtn = qs("#chat-tz-upload");
    if (chatTzBtn && chatTzFile) {
      chatTzBtn.addEventListener("click", function() { chatTzFile.click(); });
      chatTzFile.addEventListener("change", function() {
        var file = chatTzFile.files[0];
        if (!file) return;
        chatTzFile.value = "";
        var time = nowTime();
        session.messages.push({ role: "me", text: "\ud83d\udcce " + file.name + " (TZ fayl yuklandi)", time: time });
        appendMsg("me", "\ud83d\udcce " + file.name + " (TZ fayl yuklandi)", time);
        saveSession();
        showTyping();
        chatTzBtn.disabled = true;
        chatTzBtn.textContent = "...";
        var fd = new FormData();
        fd.append("file", file);
        fetch("/api/upload-tz", { method: "POST", body: fd })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            hideTyping();
            if (data.ok && data.analysis) {
              var analysisText = data.analysis + "\n\n\u2705 Buyurtma berish uchun 'buyurtma' deb yozing.";
              var rtime = nowTime();
              session.messages.push({ role: "ai", text: analysisText, time: rtime, isTzAnalysis: true, filename: data.filename, savedFile: data.savedFile });
              appendMsg("ai", analysisText, rtime);
              saveSession();
              offerTzIfReady();
            } else {
              toast(data.error === "unsupported_format" ? "Faqat .txt, .md, .pdf, .docx formatlar" : "Fayl tahlil qilib bo\u2018lmadi", "err");
            }
          })
          .catch(function() { hideTyping(); toast("Server xatosi", "err"); })
          .finally(function() { chatTzBtn.disabled = false; chatTzBtn.textContent = "\ud83d\udcce"; });
      });
    }

    renderHistory();
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  let _apiOkPromise = null;
  async function apiAvailable() {
    if (_apiOkPromise) return _apiOkPromise;
    _apiOkPromise = (async () => {
      try {
        const res = await fetch(`${basePrefix}api/health`, { cache: "no-store" });
        return !!(res && res.ok);
      } catch {
        return false;
      }
    })();
    return _apiOkPromise;
  }

  async function apiGetMessages() {
    const user = getUser() || {};
    const headers = {
      "X-User-Email": user.email || "",
      "X-User-Role": user.role || "user"
    };
    const res = await fetch(`${basePrefix}api/messages`, { headers, cache: "no-store" });
    if (!res.ok) throw new Error("api/messages failed");
    const data = await res.json();
    return data && Array.isArray(data.items) ? data.items : [];
  }

  async function apiPostMessage(text) {
    const user = getUser() || {};
    const headers = {
      "Content-Type": "application/json",
      "X-User-Email": user.email || "",
      "X-User-Role": user.role || "user"
    };
    const body = JSON.stringify({ userEmail: user.email || "", text: String(text || "") });
    const res = await fetch(`${basePrefix}api/messages`, { method: "POST", headers, body, cache: "no-store" });
    if (!res.ok) throw new Error("api/messages post failed");
    const data = await res.json();
    return data && data.item ? data.item : null;
  }

  function renderAdmin() {
    const isAdminPage = document.body.getAttribute("data-admin") === "1";
    if (!isAdminPage) return;
    if (!requireAdmin()) return;

    const host = qs("#admin");
    if (!host) return;

    host.innerHTML = `
      <div class="card pad admin-hero-card">
        <div class="admin-hero-copy">
          <div class="dashboard-badge">${t("ui.badge.controlSurface")}</div>
          <h2>${t("admin.title")}</h2>
          <p>${t("admin.subtitle")}</p>
        </div>
        <div class="admin-hero-metrics">
          <div class="admin-hero-metric"><span>${t("ui.auth.access")}</span><strong>${t("ui.dash.admin").toUpperCase()}</strong></div>
          <div class="admin-hero-metric"><span>${t("ui.stat.state")}</span><strong>${t("ui.stat.live")}</strong></div>
        </div>
      </div>
      <div class="grid-3 admin-card-grid">
        <a class="card pad admin-nav-card" href="users.html"><div class="admin-card-kicker">01</div><h3>${t("admin.users")}</h3><p class="muted">${t("admin.usersDesc")}</p></a>
        <a class="card pad admin-nav-card" href="orders.html"><div class="admin-card-kicker">02</div><h3>${t("admin.orders")}</h3><p class="muted">${t("admin.ordersDesc")}</p></a>
        <a class="card pad admin-nav-card" href="products.html"><div class="admin-card-kicker">03</div><h3>${t("admin.products")}</h3><p class="muted">${t("admin.productsDesc")}</p></a>
      </div>
    `;
  }

  function renderPersonalInfo() {
    var form = qs("#personal-info-form");
    if (!form) return;

    var user = getUser();
    if (!user) return;

    var nameEl = qs("#pi-name");
    var emailEl = qs("#pi-email");
    var roleEl = qs("#pi-role");
    if (nameEl) nameEl.value = user.name || "";
    if (emailEl) emailEl.value = user.email || "";
    if (roleEl) roleEl.value = user.role || "user";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var newName = nameEl.value.trim();
      var newEmail = emailEl.value.trim();
      if (!newName || !newEmail) { toast("Barcha maydonlarni to'ldiring", "err"); return; }

      // Update current user object
      user.name = newName;
      var oldEmail = user.email;
      user.email = newEmail;
      localStorage.setItem(STORAGE.user, JSON.stringify(user));

      // Update in users list
      var users = readStore(STORAGE.users, []);
      var idx = users.findIndex(function (u) { return u.email === oldEmail; });
      if (idx !== -1) { users[idx].name = newName; users[idx].email = newEmail; }
      localStorage.setItem(STORAGE.users, JSON.stringify(users));

      toast("Ma'lumotlar saqlandi вњ“", "ok");
    });
  }

  function renderAdminSettings() {
    var form = qs("#admin-settings-form");
    if (!form) return;
    var saved = safeJsonParse(localStorage.getItem("netrica_admin_settings"), null);
    if (saved) {
      var tzInput = qs("#set-tz-price");
      var rlInput = qs("#set-rate-limit");
      if (tzInput && saved.tzPrice) tzInput.value = saved.tzPrice;
      if (rlInput && saved.rateLimit) rlInput.value = saved.rateLimit;
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var tzPrice = qs("#set-tz-price").value.trim();
      var rateLimit = qs("#set-rate-limit").value.trim();
      localStorage.setItem("netrica_admin_settings", JSON.stringify({ tzPrice: tzPrice, rateLimit: rateLimit }));
      toast(t("ui.adminPage.save") + " вњ“", "ok");
    });
  }

  function renderAdminMessages() {
    var listHost = qs("#admin-inbox-list");
    var detailHost = qs("#admin-inbox-detail");
    if (!listHost) return;

    var isAdminPage = document.body.getAttribute("data-admin") === "1";
    if (!isAdminPage) return;
    if (!requireAdmin()) return;

    function getMessages() { return readStore(STORAGE.messages, []); }

    function renderList() {
      var all = getMessages();
      if (!all.length) {
        listHost.innerHTML = '<div class="support-empty">Xabarlar yo\'q</div>';
        detailHost.style.display = "none";
        return;
      }
      var sorted = all.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      var html = '<div class="list">';
      sorted.forEach(function(m) {
        var when = m.createdAt ? new Date(m.createdAt).toLocaleString() : "\u2014";
        var from = escapeHtml(m.userName || m.userEmail || "\u2014");
        var subj = escapeHtml(m.subject || "Xabar");
        var preview = escapeHtml((m.text || "").slice(0, 60)) + (m.text && m.text.length > 60 ? "..." : "");
        var statusClass = m.status === "new" ? "admin-badge-count" : "badge";
        var statusText = m.status === "new" ? "Yangi" : "O'qilgan";
        html += '<div class="row admin-msg-row" data-msg-id="' + escapeHtml(m.id) + '" style="cursor:pointer">';
        html += '<div><b>' + from + ' \u2013 ' + subj + '</b><div class="small">' + preview + '</div></div>';
        html += '<span class="' + statusClass + '">' + statusText + '</span>';
        html += '</div>';
      });
      html += '</div>';
      listHost.innerHTML = html;
      listHost.style.display = "";
      detailHost.style.display = "none";

      listHost.querySelectorAll(".admin-msg-row").forEach(function(el) {
        el.addEventListener("click", function() {
          openDetail(el.getAttribute("data-msg-id"));
        });
      });
    }

    function openDetail(msgId) {
      var all = getMessages();
      var msg = all.find(function(m) { return m.id === msgId; });
      if (!msg) return;

      msg.status = "read";
      writeStore(STORAGE.messages, all);

      var when = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "\u2014";
      var html = '<div style="margin-bottom:14px"><button class="btn" type="button" id="admin-msg-back">\u2190 Ortga</button></div>';
      html += '<div style="margin-bottom:10px"><strong>' + escapeHtml(msg.userName || msg.userEmail) + '</strong>';
      html += ' <span class="small muted">&lt;' + escapeHtml(msg.userEmail) + '&gt;</span></div>';
      html += '<div style="margin-bottom:6px"><span class="small muted">' + when + '</span></div>';
      html += '<div style="margin-bottom:10px"><b>' + escapeHtml(msg.subject || "Xabar") + '</b></div>';
      html += '<div class="card" style="padding:16px;background:rgba(17,31,54,.5);border-radius:14px;border:1px solid var(--line);line-height:1.7">' + escapeHtml(msg.text || "") + '</div>';

      if (msg.replies && msg.replies.length) {
        html += '<div style="margin-top:12px">';
        msg.replies.forEach(function(r) {
          var rTime = r.time ? new Date(r.time).toLocaleString() : "";
          html += '<div class="support-msg admin" style="margin-bottom:6px"><div class="support-msg-sender">Admin</div>' + escapeHtml(r.text) + '<div class="support-msg-time">' + rTime + '</div></div>';
        });
        html += '</div>';
      }

      html += '<div class="support-input-area" style="border:none;padding:10px 0 0">';
      html += '<textarea placeholder="Javob yozing..." id="admin-msg-reply"></textarea>';
      html += '<button class="btn primary" type="button" id="admin-msg-reply-send">Yuborish</button></div>';

      listHost.style.display = "none";
      detailHost.innerHTML = html;
      detailHost.style.display = "";

      qs("#admin-msg-back").addEventListener("click", function() { renderList(); });

      qs("#admin-msg-reply-send").addEventListener("click", function() {
        var text = qs("#admin-msg-reply").value.trim();
        if (!text) return;
        var fresh = getMessages();
        var m2 = fresh.find(function(m) { return m.id === msgId; });
        if (!m2) return;
        if (!m2.replies) m2.replies = [];
        m2.replies.push({ from: "admin", text: text, time: new Date().toISOString() });
        writeStore(STORAGE.messages, fresh);
        qs("#admin-msg-reply").value = "";
        openDetail(msgId);
        toast("Javob yuborildi \u2713", "ok");
      });
    }

    renderList();
  }

  /* в”Ђв”Ђ Admin index page вЂ“ unread badges в”Ђв”Ђ */
  function renderAdminBadges() {
    var msgBadge = qs("#admin-badge-messages");
    var ordBadge = qs("#admin-badge-orders");
    if (!msgBadge && !ordBadge) return;

    function update() {
      // Unread: support chats + inbox messages combined
      if (msgBadge) {
        var unread = 0;
        // Count unread support chat messages
        var threads = JSON.parse(localStorage.getItem(STORAGE.supportChats) || "[]");
        threads.forEach(function(th) {
          th.messages.forEach(function(m) {
            if (m.from !== "admin@netrica.com" && !m.readByAdmin) unread++;
          });
        });
        // Count new inbox messages
        var msgs = JSON.parse(localStorage.getItem(STORAGE.messages) || "[]");
        msgs.forEach(function(m) {
          if (m.status === "new") unread++;
        });
        if (unread > 0) {
          msgBadge.textContent = unread;
          msgBadge.className = "admin-badge-count";
          msgBadge.style.display = "";
        } else {
          msgBadge.style.display = "none";
        }
      }
      // New orders (status === "new")
      if (ordBadge) {
        var orders = JSON.parse(localStorage.getItem(STORAGE.orders) || "[]");
        var newOrd = orders.filter(function(o) { return o.status === "Yangi" || o.status === "new"; }).length;
        if (newOrd > 0) {
          ordBadge.textContent = newOrd;
          ordBadge.className = "admin-badge-count";
          ordBadge.style.display = "";
        } else {
          ordBadge.style.display = "none";
        }
      }
    }
    update();
    setInterval(update, 4000);
  }

  /* в”Ђв”Ђ Admin Users вЂ“ dynamic list + message to user в”Ђв”Ђ */
  function renderAdminUsers() {
    var listHost = qs("#admin-users-list");
    var detailHost = qs("#admin-user-detail");
    if (!listHost) return;
    var isAdminPage = document.body.getAttribute("data-admin") === "1";
    if (!isAdminPage) return;
    if (!requireAdmin()) return;

    function getUsers() { return readStore(STORAGE.users, []); }

    function renderList() {
      ensureDemoStores();
      var users = getUsers();
      if (!users.length) {
        listHost.innerHTML = '<div class="support-empty">Foydalanuvchilar yo\'q</div>';
        if (detailHost) detailHost.style.display = "none";
        return;
      }
      var html = '<div class="list" style="max-width:700px;margin:0 auto">';
      users.forEach(function(u) {
        var role = u.role === "admin" ? "admin" : "foydalanuvchi";
        html += '<div class="row admin-user-row" data-user-email="' + escapeHtml(u.email) + '" style="cursor:pointer;padding:18px 22px;font-size:16px">';
        html += '<div><b>' + escapeHtml(u.name || u.email) + '</b><div class="small">Rol: ' + role + '</div></div>';
        html += '<span class="badge">Faol</span>';
        html += '</div>';
      });
      html += '</div>';
      listHost.innerHTML = html;
      listHost.style.display = "";
      if (detailHost) detailHost.style.display = "none";

      listHost.querySelectorAll(".admin-user-row").forEach(function(el) {
        el.addEventListener("click", function() {
          openUserDetail(el.getAttribute("data-user-email"));
        });
      });
    }

    function openUserDetail(email) {
      var users = getUsers();
      var u = users.find(function(x) { return x.email === email; });
      if (!u || !detailHost) return;

      var role = u.role === "admin" ? "admin" : "foydalanuvchi";
      var regDate = u.registeredAt ? new Date(u.registeredAt).toLocaleString() : "вЂ”";

      // Get messages sent to this user & mark replies as read
      var adminMsgs = JSON.parse(localStorage.getItem("netrica_admin_to_user") || "[]");
      var userMsgs = adminMsgs.filter(function(m) { return m.to === email; });
      var changed = false;
      userMsgs.forEach(function(m) {
        if (m.replies && m.replies.length && !m.repliesReadByAdmin) {
          m.repliesReadByAdmin = true;
          changed = true;
        }
      });
      if (changed) localStorage.setItem("netrica_admin_to_user", JSON.stringify(adminMsgs));

      var html = '<div style="margin-bottom:14px"><button class="btn" type="button" id="admin-user-back">\u2190 Ortga</button></div>';
      html += '<div style="margin-bottom:14px"><h3 style="margin:0">' + escapeHtml(u.name || u.email) + '</h3></div>';
      html += '<div class="kv" style="margin-bottom:14px">';
      html += '<div class="item"><div class="k">Email</div><div class="v">' + escapeHtml(u.email) + '</div></div>';
      html += '<div class="item"><div class="k">Ism</div><div class="v">' + escapeHtml(u.name || "вЂ”") + '</div></div>';
      html += '<div class="item"><div class="k">Rol</div><div class="v">' + role + '</div></div>';
      html += '<div class="item"><div class="k">Ro\'yxatdan o\'tgan</div><div class="v">' + regDate + '</div></div>';
      html += '</div>';

      // Sent messages history with replies
      if (userMsgs.length) {
        html += '<div style="margin-bottom:10px"><b>Xabar tarixi:</b></div>';
        userMsgs.slice().reverse().forEach(function(m) {
          var t = m.time ? new Date(m.time).toLocaleString() : "";
          var hasNewReply = m.replies && m.replies.length && !m.repliesReadByAdmin;
          html += '<div class="card" style="padding:12px;background:rgba(17,31,54,.4);border-radius:14px;border:1px solid var(--line);margin-bottom:8px">';
          html += '<div class="support-msg admin" style="margin:0"><div class="support-msg-sender">Admin</div>' + escapeHtml(m.text) + '<div class="support-msg-time">' + t + '</div></div>';
          if (m.replies && m.replies.length) {
            m.replies.forEach(function(r) {
              var rTime = r.time ? new Date(r.time).toLocaleString() : "";
              var cls = r.from === "admin" ? "admin" : "user";
              var sender = r.from === "admin" ? "Admin" : escapeHtml(email);
              html += '<div class="support-msg ' + cls + '" style="margin-top:6px"><div class="support-msg-sender">' + sender + '</div>' + escapeHtml(r.text) + '<div class="support-msg-time">' + rTime + '</div></div>';
            });
          }
          if (hasNewReply) html += '<span class="admin-badge-count" style="margin-top:6px">Yangi javob</span>';
          html += '</div>';
        });
      }

      // Send message form
      html += '<div style="margin-top:10px"><b>Xabar yuborish:</b></div>';
      html += '<div class="support-input-area" style="border:none;padding:10px 0 0">';
      html += '<textarea placeholder="Xabar matnini yozing..." id="admin-user-msg-input"></textarea>';
      html += '<button class="btn primary" type="button" id="admin-user-msg-send">Yuborish</button>';
      html += '</div>';

      listHost.style.display = "none";
      detailHost.innerHTML = html;
      detailHost.style.display = "";

      qs("#admin-user-back").addEventListener("click", function() { renderList(); });

      qs("#admin-user-msg-send").addEventListener("click", function() {
        var text = qs("#admin-user-msg-input").value.trim();
        if (!text) return;
        var allMsgs = JSON.parse(localStorage.getItem("netrica_admin_to_user") || "[]");
        allMsgs.push({ from: "admin@netrica.com", to: email, text: text, time: new Date().toISOString(), read: false });
        localStorage.setItem("netrica_admin_to_user", JSON.stringify(allMsgs));
        qs("#admin-user-msg-input").value = "";
        openUserDetail(email);
        toast("Xabar yuborildi \u2713", "ok");
      });
    }

    renderList();
  }

  /* в”Ђв”Ђ Admin Products вЂ“ dynamic list + detail + edit в”Ђв”Ђ */
  function renderAdminProducts() {
    var listHost = qs("#admin-products-list");
    var detailHost = qs("#admin-product-detail");
    if (!listHost) return;
    var isAdminPage = document.body.getAttribute("data-admin") === "1";
    if (!isAdminPage) return;
    if (!requireAdmin()) return;

    var CUSTOM_KEY = "netrica_product_custom";

    function getProducts() { return (window.NETRICA_DEMO && window.NETRICA_DEMO.products) || []; }
    function getCustom() { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); }
    function saveCustom(data) { localStorage.setItem(CUSTOM_KEY, JSON.stringify(data)); }

    function renderList() {
      var products = getProducts();
      if (!products.length) {
        listHost.innerHTML = '<div class="support-empty">Mahsulotlar yo\'q</div>';
        if (detailHost) detailHost.style.display = "none";
        return;
      }
      var html = '<div class="list">';
      products.forEach(function(p) {
        var name = t(p.nameKey) || p.id;
        var desc = t(p.descKey) || "";
        html += '<div class="row admin-prod-row" data-prod-id="' + escapeHtml(p.id) + '" style="cursor:pointer">';
        html += '<div><b>' + escapeHtml(name) + '</b><div class="small">' + escapeHtml(desc) + '</div></div>';
        html += '<span class="badge">Faol</span>';
        html += '</div>';
      });
      html += '</div>';
      listHost.innerHTML = html;
      listHost.style.display = "";
      if (detailHost) detailHost.style.display = "none";

      listHost.querySelectorAll(".admin-prod-row").forEach(function(el) {
        el.addEventListener("click", function() {
          openDetail(el.getAttribute("data-prod-id"));
        });
      });
    }

    function openDetail(prodId) {
      var products = getProducts();
      var p = products.find(function(x) { return x.id === prodId; });
      if (!p || !detailHost) return;

      var custom = getCustom();
      var productCustom = custom[prodId] || {};

      var name = t(p.nameKey) || p.id;
      var desc = t(p.descKey) || "";
      var price = productCustom.price || p.priceText || "вЂ”";

      var features = (p.featuresKeys || []).map(function(k) { return t(k); });
      var useCases = (p.useCasesKeys || []).map(function(k) { return t(k); });
      var extraFeatures = productCustom.extraFeatures || [];
      var extraUseCases = productCustom.extraUseCases || [];
      var adminNote = productCustom.note || "";

      var html = '<div style="margin-bottom:14px"><button class="btn" type="button" id="admin-prod-back">\u2190 Ortga</button></div>';
      html += '<div style="margin-bottom:14px"><h3 style="margin:0">' + escapeHtml(name) + '</h3><p class="muted" style="margin:4px 0 0">' + escapeHtml(desc) + '</p></div>';

      // Info grid
      html += '<div class="kv" style="margin-bottom:14px">';
      html += '<div class="item"><div class="k">ID</div><div class="v">' + escapeHtml(p.id) + '</div></div>';
      html += '<div class="item"><div class="k">Narx</div><div class="v">' + escapeHtml(price) + '</div></div>';
      html += '<div class="item"><div class="k">Holat</div><div class="v"><span class="badge hud-status">Faol</span></div></div>';
      html += '</div>';

      // Features
      html += '<div style="margin-bottom:14px"><b>Imkoniyatlari:</b><ul style="margin:6px 0 0 18px;padding:0">';
      features.forEach(function(f) { html += '<li style="margin-bottom:4px">' + escapeHtml(f) + '</li>'; });
      extraFeatures.forEach(function(f) { html += '<li style="margin-bottom:4px;color:var(--accent)">' + escapeHtml(f) + ' <span class="small muted">(qo\'shilgan)</span></li>'; });
      html += '</ul></div>';

      // Use cases
      html += '<div style="margin-bottom:14px"><b>Qo\'llanilishi:</b><ul style="margin:6px 0 0 18px;padding:0">';
      useCases.forEach(function(u) { html += '<li style="margin-bottom:4px">' + escapeHtml(u) + '</li>'; });
      extraUseCases.forEach(function(u) { html += '<li style="margin-bottom:4px;color:var(--accent)">' + escapeHtml(u) + ' <span class="small muted">(qo\'shilgan)</span></li>'; });
      html += '</ul></div>';

      // Admin note
      if (adminNote) {
        html += '<div style="margin-bottom:14px"><b>Admin eslatmasi:</b>';
        html += '<div class="card" style="padding:12px;background:rgba(17,31,54,.5);border-radius:14px;border:1px solid var(--line);margin-top:6px">' + escapeHtml(adminNote) + '</div></div>';
      }

      // Edit section
      html += '<div class="hr" style="margin:14px 0"></div>';
      html += '<div style="margin-bottom:10px"><b>Qo\'shimcha kiritish:</b></div>';
      html += '<form id="admin-prod-edit-form" class="form">';
      html += '<div class="field"><label for="prod-edit-price">Narxni o\'zgartirish</label><input id="prod-edit-price" value="' + escapeHtml(price) + '" /></div>';
      html += '<div class="field"><label for="prod-edit-feature">Yangi imkoniyat qo\'shish</label><input id="prod-edit-feature" placeholder="Masalan: Real-time bildirishnomalar" /></div>';
      html += '<div class="field"><label for="prod-edit-usecase">Yangi qo\'llanilish qo\'shish</label><input id="prod-edit-usecase" placeholder="Masalan: E-commerce platformalar" /></div>';
      html += '<div class="field"><label for="prod-edit-note">Admin eslatmasi</label><textarea id="prod-edit-note" placeholder="Mahsulot haqida eslatma...">' + escapeHtml(adminNote) + '</textarea></div>';
      html += '<button class="btn primary" type="submit">Saqlash</button>';
      html += '</form>';

      listHost.style.display = "none";
      detailHost.innerHTML = html;
      detailHost.style.display = "";

      qs("#admin-prod-back").addEventListener("click", function() { renderList(); });

      qs("#admin-prod-edit-form").addEventListener("submit", function(e) {
        e.preventDefault();
        var allCustom = getCustom();
        if (!allCustom[prodId]) allCustom[prodId] = { extraFeatures: [], extraUseCases: [], note: "", price: "" };
        var pc = allCustom[prodId];

        var newPrice = qs("#prod-edit-price").value.trim();
        if (newPrice) pc.price = newPrice;

        var newFeature = qs("#prod-edit-feature").value.trim();
        if (newFeature) { pc.extraFeatures.push(newFeature); qs("#prod-edit-feature").value = ""; }

        var newUseCase = qs("#prod-edit-usecase").value.trim();
        if (newUseCase) { pc.extraUseCases.push(newUseCase); qs("#prod-edit-usecase").value = ""; }

        pc.note = qs("#prod-edit-note").value.trim();

        saveCustom(allCustom);
        openDetail(prodId);
        toast("Saqlandi \u2713", "ok");
      });
    }

    renderList();
  }

  function renderAdminOrders() {
    var listHost = qs("#admin-orders-list");
    var detailHost = qs("#admin-order-detail");
    if (!listHost) return;
    var isAdminPage = document.body.getAttribute("data-admin") === "1";
    if (!isAdminPage) return;
    if (!requireAdmin()) return;

    function getOrders() { return readStore(STORAGE.orders, []); }

    function renderList() {
      ensureDemoStores();
      var orders = getOrders();
      if (!orders.length) {
        listHost.innerHTML = '<div class="list"></div>';
        listRender(listHost.querySelector(".list"), [listEmptyItem()]);
        if (detailHost) detailHost.style.display = "none";
        return;
      }
      var html = '<div class="list">';
      orders.forEach(function (o) {
        var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : "вЂ”";
        var project = escapeHtml(o.project || "вЂ”");
        var product = escapeHtml(o.productId || "вЂ”");
        var status = escapeHtml(o.status || "вЂ”");
        var req = escapeHtml((o.requirements || "").slice(0, 100));
        html += '<div class="row admin-order-row" data-order-id="' + escapeHtml(o.id) + '" style="cursor:pointer">';
        html += '<div><b>' + project + '</b><div class="small">' + req + '</div><div class="row-meta"><span class="hud-mini-pill">' + product + '</span><span>' + when + '</span></div></div>';
        html += '<span class="badge hud-status">' + status + '</span>';
        html += '</div>';
      });
      html += '</div>';
      listHost.innerHTML = html;
      listHost.style.display = "";
      if (detailHost) detailHost.style.display = "none";

      listHost.querySelectorAll(".admin-order-row").forEach(function(el) {
        el.addEventListener("click", function() {
          openDetail(el.getAttribute("data-order-id"));
        });
      });
    }

    function openDetail(orderId) {
      var orders = getOrders();
      var o = orders.find(function(x) { return x.id === orderId; });
      if (!o || !detailHost) return;

      // Auto-mark as viewed
      if (o.status === "Yangi" || o.status === "new") {
        o.status = "Jarayonda";
        writeStore(STORAGE.orders, orders);
      }

      var when = o.createdAt ? new Date(o.createdAt).toLocaleString() : "вЂ”";
      var html = '<div style="margin-bottom:14px"><button class="btn" type="button" id="admin-order-back">\u2190 Ortga</button></div>';
      html += '<div style="margin-bottom:14px"><h3 style="margin:0">' + escapeHtml(o.project || "вЂ”") + '</h3></div>';
      html += '<div class="kv" style="margin-bottom:14px">';
      html += '<div class="item"><div class="k">Buyurtma ID</div><div class="v">' + escapeHtml(o.id) + '</div></div>';
      html += '<div class="item"><div class="k">Mahsulot</div><div class="v">' + escapeHtml(o.productId || "вЂ”") + '</div></div>';
      html += '<div class="item"><div class="k">Status</div><div class="v"><span class="badge hud-status">' + escapeHtml(o.status || "вЂ”") + '</span></div></div>';
      html += '<div class="item"><div class="k">Sana</div><div class="v">' + when + '</div></div>';
      html += '</div>';
      html += '<div style="margin-bottom:10px"><b>Talablar / Tavsif:</b></div>';
      var reqText = o.requirements || "Ma'lumot yo'q";
      var formattedReq = escapeHtml(reqText).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/##\s?([^\n]+)/g, '<h4 style="margin:8px 0 4px;color:var(--accent)">$1</h4>').replace(/###\s?([^\n]+)/g, '<h5 style="margin:6px 0 2px;color:var(--accent)">$1</h5>').replace(/\n/g, '<br>');
      html += '<div class="card" style="padding:16px;background:rgba(17,31,54,.5);border-radius:14px;border:1px solid var(--line);line-height:1.7">' + formattedReq + '</div>';

      html += '<div class="card" style="margin-top:14px;padding:16px;background:rgba(140,120,255,.06);border:1px solid rgba(140,120,255,.2);border-radius:14px">';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><b style="font-size:15px">\ud83d\udcc1 TZ fayl</b></div>';
      if (o.tzFile) {
        html += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
        html += '<span>' + escapeHtml(o.tzOriginalName || o.tzFile) + '</span>';
        html += '<a class="btn primary" href="/api/tz-download/' + encodeURIComponent(o.tzFile) + '" target="_blank" style="padding:8px 20px;font-size:13px">\u2b07 Yuklab olish</a>';
        html += '<a class="btn" href="/api/tz-download/' + encodeURIComponent(o.tzFile) + '" target="_blank" style="padding:8px 20px;font-size:13px">\ud83d\udc41 Ko\'rish</a>';
        html += '</div>';
      } else {
        html += '<div style="color:var(--muted)">Fayl saqlanmagan. Foydalanuvchi yangi TZ yuklasa, bu yerda ko\'rinadi.</div>';
      }
      html += '</div>';

      html += '<div style="margin-top:14px;display:flex;align-items:center;gap:10px">';
      html += '<label><b>Statusni o\'zgartirish:</b></label>';
      html += '<select id="admin-order-status" class="btn" style="padding:8px 14px">';
      ["Yangi","Jarayonda","Tayyor","Bekor qilingan"].forEach(function(s) {
        html += '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + s + '</option>';
      });
      html += '</select>';
      html += '<button class="btn primary" type="button" id="admin-order-save">Saqlash</button>';
      html += '</div>';

      listHost.style.display = "none";
      detailHost.innerHTML = html;
      detailHost.style.display = "";

      qs("#admin-order-back").addEventListener("click", function() { renderList(); });
      qs("#admin-order-save").addEventListener("click", function() {
        var newStatus = qs("#admin-order-status").value;
        var fresh = getOrders();
        var item = fresh.find(function(x) { return x.id === orderId; });
        if (item) {
          item.status = newStatus;
          writeStore(STORAGE.orders, fresh);
          openDetail(orderId);
          toast("Status yangilandi \u2713", "ok");
        }
      });
    }

    renderList();
  }

  function renderAboutDetail() {
    const host = qs("#about-detail");
    if (!host) return;

    const topic = (getQuery("topic") || "2025").toLowerCase();
    const map = {
      "2025": { titleKey: "home.aboutStat1Title", subtitleKey: "home.aboutStat1Desc" },
      "ai-web": { titleKey: "home.aboutStat2Title", subtitleKey: "home.aboutStat2Desc" },
      "platform": { titleKey: "home.aboutStat3Title", subtitleKey: "home.aboutStat3Desc" }
    };
    const sel = map[topic] || map["2025"];

    var bodyHtml = "";

    if (topic === "platform") {
      bodyHtml = `
        <p style="margin:0 0 12px;line-height:1.7">Bu tushuncha zamonaviy dasturlash o'rganishining eng muhim qoidalaridan birini ifodalaydi: har qanday loyiha <b>g'oyadan</b> boshlanib, <b>texnik topshiriq</b> orqali haqiqiy <b>mahsulotga</b> aylanishi kerak.</p>

        <h3 style="margin:18px 0 8px">G'oya nima?</h3>
        <p style="margin:0 0 8px;line-height:1.7">G'oya вЂ” bu <em>"Men nima qurmoqchiman?"</em> degan savolga berilgan birinchi javob. Ko'pchilik dasturchilar, ayniqsa o'rganuvchilar, g'oyani boshida yetarlicha o'ylamasdan to'g'ridan-to'g'ri kod yozishga kirishib ketadi. Bu esa yo'l o'rtasida chalg'ish, loyihani yarim qoldirish yoki noto'g'ri narsa qurishga olib keladi.</p>
        <p style="margin:0 0 12px;line-height:1.7">Yaxshi g'oya quyidagi savollarga javob berishi kerak: <b>Bu kimga kerak?</b> вЂ” <b>Qanday muammoni hal qiladi?</b> вЂ” <b>Shunga o'xshash narsa allaqachon bormi?</b></p>

        <h3 style="margin:18px 0 8px">TZ (Texnik Topshiriq) nima?</h3>
        <p style="margin:0 0 8px;line-height:1.7">TZ вЂ” bu g'oyani aniq, o'lchanadigan talablarga aylantirish jarayoni. Bu hujjatda loyihaning maqsadi, funksiyalari, foydalanuvchi rollari, interfeys tavsifi va texnologiyalar yoziladi. TZ bo'lmasa, dasturchi nima qilayotganini, buyurtmachi esa nima kutayotganini bilmaydi.</p>
        <p style="margin:0 0 8px;line-height:1.7">Professional dunyoda hech qanday loyiha TZsiz boshlanmaydi, chunki bu ikki tomon o'rtasidagi <b>kelishuv hujjati</b> hisoblanadi.</p>
        <p style="margin:0 0 12px;line-height:1.7">Oddiy TZ tarkibiga kiradi: loyiha nomi va maqsadi, funksional talablar ro'yxati, texnologiyalar tanlovi, sahifalar va ekranlar tavsifi hamda muddatlar.</p>

        <h3 style="margin:18px 0 8px">Loyiha вЂ” G'oyani hayotga tatbiq etish</h3>
        <p style="margin:0 0 8px;line-height:1.7">Loyiha вЂ” bu TZ asosida yozilgan haqiqiy kod, interfeys va ishlaydigan mahsulot. Bu bosqichda g'oya va TZ'dagi har bir punkt amalda sinovdan o'tadi. Ko'pincha shu bosqichda TZ'ga o'zgartirishlar kiritiladi, chunki ba'zi narsalar faqat qurish jarayonida ko'rinadi.</p>
        <p style="margin:0 0 0;line-height:1.7">Bir platforma deganda shuni tushunish kerak: <b>g'oya, TZ va loyiha</b> вЂ” bu uchta alohida narsa emas, balki <b>bitta mahsulotning uch bosqichi</b>. Shu uch bosqichni to'g'ri o'tgan dasturchi nafaqat kod yoza oladi, balki to'liq ishlaydigan va kerakli mahsulot qurishni biladi.</p>
      `;
    } else if (topic === "ai-web") {
      bodyHtml = `
        <p style="margin:0 0 12px;line-height:1.7">Bugungi kunda bitta kuchli g'oya, to'g'ri texnologiyalar va izchil jarayon orqali haqiqiy raqamli mahsulot yaratish mumkin. Bu yo'l uchta asosiy ustun ustida qurilgan: <b>sun'iy intellekt</b>, <b>web texnologiyalari</b> va <b>mahsulotni foydalanuvchiga yetkazish</b> madaniyati.</p>

        <h3 style="margin:18px 0 8px">AI вЂ” Mahsulotning Miyasi</h3>
        <p style="margin:0 0 8px;line-height:1.7">Zamonaviy mahsulotlarda sun'iy intellekt faqat qo'shimcha funksiya emas, balki asosiy qiymat yaratuvchi qismga aylanib bormoqda. Foydalanuvchi savol beradi вЂ” AI javob beradi. Foydalanuvchi hujjat yuklaydi вЂ” AI uni tahlil qiladi. Foydalanuvchi muammo tasvirlaydi вЂ” AI yechim taklif qiladi.</p>
        <p style="margin:0 0 12px;line-height:1.7">Bu imkoniyatlarni amalga oshirish uchun <b>OpenAI, Claude yoki Gemini</b> kabi modellarning API'laridan foydalaniladi. Dasturchi modelni o'zi o'qitmaydi, faqat tayyor modelga o'z ma'lumotlarini va savollarini yuboradi, javobni esa mahsulotiga integratsiya qiladi. Aynan shu yondashuv bugungi kunda eng tez va samarali AI mahsulot yaratish yo'li hisoblanadi.</p>

        <h3 style="margin:18px 0 8px">Web вЂ” Mahsulotning Tanasi</h3>
        <p style="margin:0 0 8px;line-height:1.7">G'oya va AI qanchalik kuchli bo'lmasin, foydalanuvchi u bilan qandaydir interfeys orqali muloqot qilishi kerak. Web вЂ” bu eng qulay va universal interfeys. Brauzer orqali ishlaydi, o'rnatish shart emas, har qanday qurilmadan kirish mumkin.</p>
        <p style="margin:0 0 12px;line-height:1.7">Backend tomonda <b>Python'da FastAPI yoki Flask</b> yordamida AI API'ga so'rovlar yuboruvchi server quriladi. Frontend tomonda esa foydalanuvchi ko'radigan interfeys вЂ” bu oddiy HTML/CSS dan tortib React'gacha bo'lishi mumkin. Ikkisi o'rtasida ma'lumot almashish <b>JSON</b> formatida, HTTP yoki WebSocket orqali amalga oshiriladi. Natijada foydalanuvchi brauzerini ochib, AI bilan gaplasha oladigan, hujjat yuklasa tahlil qiladigan, savol bersa javob oladigan tirik mahsulotga ega bo'ladi.</p>

        <h3 style="margin:18px 0 8px">Mahsulotni Yetkazish вЂ” G'oyaning Yakuniy Sinovi</h3>
        <p style="margin:0 0 8px;line-height:1.7">Kod yozib tugallangan loyiha hali mahsulot emas. Mahsulot вЂ” bu haqiqiy foydalanuvchi ishlatadigan, ishlayotgan, muammoni hal qilayotgan tizim. Ko'pchilik dasturchilar eng qiyin qism kod yozish deb o'ylaydi, aslida eng qiyin qism mahsulotni yetkazish jarayonidir.</p>
        <p style="margin:0 0 8px;line-height:1.7">Yetkazish jarayoni bir necha bosqichdan iborat. Avval mahsulot serverga joylashtiriladi вЂ” bu <b>Railway, Render yoki VPS</b> server bo'lishi mumkin. Keyin domen ulangan, HTTPS sozlangan va tizim 24/7 ishlashga tayyor bo'ladi. Foydalanuvchilar mahsulotni ishlatganida xatolar yuzaga keladi, shuning uchun monitoring va xato kuzatuv tizimi ham o'rnatiladi.</p>
        <p style="margin:0 0 0;line-height:1.7">G'oyadan boshlanib, TZ orqali loyihaga, loyihadan esa haqiqiy foydalanuvchiga yetib borish вЂ” bu bitta platformada o'rganiladigan to'liq dasturchi yo'li. <b>Kod yozish emas, mahsulot yaratish</b> вЂ” bu zamonaviy dasturchining asosiy ko'nikmasidir.</p>
      `;
    } else {
      bodyHtml = `
                <p style="margin:0 0 14px;line-height:1.7">Netrica MCHJ 2025-yilda tashkil topdi va shu vaqtgacha ko'plab natijalarga erishdi. Kompaniya turli xil loyihalarni amalga oshirdi hamda foydalanuvchilar uchun keng yo'nalishdagi yangi loyihalarni tayyorladi. Bundan tashqari, sizlar uchun yaratilgan tayyor loyihalarni bir joyga jamlamoqda. Siz o'zingizga yoqqan loyihani saytimiz orqali buyurtma asosida yoki oylik to'lov shaklida sotib olishingiz mumkin.</p>
        <p style="margin:0 0 14px;line-height:1.7">Netrica platformasi tashkil etilgan 2025-yil biz uchun muhim boshlanish nuqtasi bo'ldi. Aynan shu yilda biz g'oyadan haqiqiy mahsulotga o'tish yo'lini boshladik. Jamoamiz sun'iy intellekt va web texnologiyalarini birlashtirgan holda, har bir foydalanuvchiga professional darajadagi raqamli xizmatlar taqdim etishni o'z oldiga maqsad qilib qo'ydi.</p>
        <p style="margin:0 0 20px;line-height:1.7">Netrica — bu shunchaki kod yozish emas, balki <b>to'liq mahsulot yaratish madaniyatidir</b>. Biz g'oyani shakllantirishdan boshlab, texnik topshiriq tuzish, loyihani ishga tushirish va uni foydalanuvchiga yetkazishgacha bo'lgan barcha jarayonlarni bitta platformada jamlashni ko'zlaymiz.</p>
<p style="margin:0 0 20px;line-height:1.7">Bizning jamoa a'zolari va ularning vazifalari:</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:100px;height:100px;border:1.5px dashed rgba(140,120,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(140,120,255,.04);color:rgba(140,120,255,.35);font-size:.7rem;overflow:hidden"><img src="assets/img/team-1.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:block">Rasm</span></div><b style="margin:0;font-size:.9rem">Xodim 1</b><p style="margin:0;color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center">Asoschi & Bosh direktor вЂ” Loyihalarni boshqarish va strategik rejalashtirish</p></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:100px;height:100px;border:1.5px dashed rgba(140,120,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(140,120,255,.04);color:rgba(140,120,255,.35);font-size:.7rem;overflow:hidden"><img src="assets/img/team-2.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:block">Rasm</span></div><b style="margin:0;font-size:.9rem">Xodim 2</b><p style="margin:0;color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center">Full-Stack dasturchi вЂ” Web va backend tizimlarni ishlab chiqish</p></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:100px;height:100px;border:1.5px dashed rgba(140,120,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(140,120,255,.04);color:rgba(140,120,255,.35);font-size:.7rem;overflow:hidden"><img src="assets/img/team-3.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:block">Rasm</span></div><b style="margin:0;font-size:.9rem">Xodim 3</b><p style="margin:0;color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center">AI muhandis вЂ” Sun'iy intellekt modellari va integratsiya</p></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:100px;height:100px;border:1.5px dashed rgba(140,120,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(140,120,255,.04);color:rgba(140,120,255,.35);font-size:.7rem;overflow:hidden"><img src="assets/img/team-4.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:block">Rasm</span></div><b style="margin:0;font-size:.9rem">Muxtorov Farrux Bahodir o'g'li</b><p style="margin:0;color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center">UI/UX dizayner вЂ” Interfeys dizayni va foydalanuvchi tajribasi</p></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:100px;height:100px;border:1.5px dashed rgba(140,120,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(140,120,255,.04);color:rgba(140,120,255,.35);font-size:.7rem;overflow:hidden"><img src="assets/img/team-5.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:block">Rasm</span></div><b style="margin:0;font-size:.9rem">Turg'unboyev Bobur Nurullo o'g'li</b><p style="margin:0;color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center">DevOps mutaxassis вЂ” Server va infratuzilmani boshqarish</p></div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="width:100px;height:100px;border:1.5px dashed rgba(140,120,255,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(140,120,255,.04);color:rgba(140,120,255,.35);font-size:.7rem;overflow:hidden"><img src="assets/img/team-6.jpg" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;display:none" onload="this.style.display='block';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display=''"><span style="display:block">Rasm</span></div><b style="margin:0;font-size:.9rem">Abdiyev Fayozjon Ikrom o'g'li</b><p style="margin:0;color:var(--muted);font-size:.8rem;line-height:1.4;text-align:center">QA muhandis вЂ” Sifat nazorati va testlash</p></div>
        </div>
      `;
    }

    host.innerHTML = `
      <div class="card pad">
        <h3 style="margin:0 0 6px">${t(sel.titleKey)}</h3>
        <p class="muted" style="margin:0 0 14px">${t(sel.subtitleKey)}</p>
        <div class="hr"></div>
        ${bodyHtml}
      </div>
    `;
  }

  function wireAboutCards() {
    const about = qs("#about");
    if (!about) return;
    about.addEventListener(
      "click",
      (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a.about-card") : null;
        if (!a) return;
        const href = a.getAttribute("href");
        if (!href) return;
        if (href.startsWith("#")) return;
        if (/^(https?:|mailto:|tel:)/.test(href)) return;
        e.preventDefault();
        location.href = href;
      },
      true
    );
  }

  /* в”Ђв”Ђ User: Admin Messages Inbox в”Ђв”Ђ */
  function renderUserAdminMessages() {
    var listHost = qs("#admin-msgs-for-user");
    var detailHost = qs("#admin-msg-detail-user");
    if (!listHost) return;

    var user = getUser();
    if (!user) return;

    var ADMIN_MSG_KEY = "netrica_admin_to_user";

    function getMsgs() {
      var all = JSON.parse(localStorage.getItem(ADMIN_MSG_KEY) || "[]");
      return all.filter(function(m) { return m.to === user.email; });
    }

    function saveAll(allMsgs) {
      localStorage.setItem(ADMIN_MSG_KEY, JSON.stringify(allMsgs));
    }

    function renderList() {
      var msgs = getMsgs();
      if (!msgs.length) {
        listHost.innerHTML = '<div class="support-empty">Admin xabarlari yo\'q</div>';
        if (detailHost) detailHost.style.display = "none";
        listHost.style.display = "";
        return;
      }
      var html = '<div class="list">';
      msgs.slice().reverse().forEach(function(m, i) {
        var when = m.time ? new Date(m.time).toLocaleString() : "вЂ”";
        var preview = escapeHtml((m.text || "").slice(0, 70)) + (m.text && m.text.length > 70 ? "..." : "");
        var unread = !m.read;
        var badgeCls = unread ? "admin-badge-count" : "badge";
        var badgeText = unread ? "Yangi" : "O'qilgan";
        html += '<div class="row admin-inbox-row" data-msg-idx="' + (msgs.length - 1 - i) + '" style="cursor:pointer">';
        html += '<div><b>Admin</b><div class="small">' + preview + '</div><div class="small muted">' + when + '</div></div>';
        html += '<span class="' + badgeCls + '">' + badgeText + '</span>';
        html += '</div>';
      });
      html += '</div>';
      listHost.innerHTML = html;
      listHost.style.display = "";
      if (detailHost) detailHost.style.display = "none";

      listHost.querySelectorAll(".admin-inbox-row").forEach(function(el) {
        el.addEventListener("click", function() {
          openDetail(parseInt(el.getAttribute("data-msg-idx"), 10));
        });
      });
    }

    function openDetail(idx) {
      var allMsgs = JSON.parse(localStorage.getItem(ADMIN_MSG_KEY) || "[]");
      var userMsgs = [];
      var realIdx = -1;
      var count = 0;
      for (var i = 0; i < allMsgs.length; i++) {
        if (allMsgs[i].to === user.email) {
          if (count === idx) { realIdx = i; break; }
          count++;
        }
      }
      if (realIdx === -1 || !detailHost) return;
      var m = allMsgs[realIdx];

      // Mark as read
      m.read = true;
      saveAll(allMsgs);

      var when = m.time ? new Date(m.time).toLocaleString() : "вЂ”";
      var html = '<div style="margin-bottom:14px"><button class="btn" type="button" id="user-admin-msg-back">\u2190 Ortga</button></div>';
      html += '<div style="margin-bottom:6px"><strong>Admin</strong> <span class="small muted">' + when + '</span></div>';
      html += '<div class="card" style="padding:16px;background:rgba(17,31,54,.5);border-radius:14px;border:1px solid var(--line);line-height:1.7;margin-bottom:14px">' + escapeHtml(m.text) + '</div>';

      // Show replies
      if (m.replies && m.replies.length) {
        m.replies.forEach(function(r) {
          var rTime = r.time ? new Date(r.time).toLocaleString() : "";
          var isAdmin = r.from === "admin";
          var cls = isAdmin ? "admin" : "user";
          var sender = isAdmin ? "Admin" : escapeHtml(user.name || "Siz");
          html += '<div class="support-msg ' + cls + '" style="margin-bottom:6px"><div class="support-msg-sender">' + sender + '</div>' + escapeHtml(r.text) + '<div class="support-msg-time">' + rTime + '</div></div>';
        });
      }

      // Reply form
      html += '<div class="support-input-area" style="border:none;padding:10px 0 0">';
      html += '<textarea placeholder="Javob yozing..." id="user-admin-reply-input"></textarea>';
      html += '<button class="btn primary" type="button" id="user-admin-reply-send">Yuborish</button>';
      html += '</div>';

      listHost.style.display = "none";
      detailHost.innerHTML = html;
      detailHost.style.display = "";

      qs("#user-admin-msg-back").addEventListener("click", function() { renderList(); });

      qs("#user-admin-reply-send").addEventListener("click", function() {
        var text = qs("#user-admin-reply-input").value.trim();
        if (!text) return;
        var fresh = JSON.parse(localStorage.getItem(ADMIN_MSG_KEY) || "[]");
        if (!fresh[realIdx]) return;
        if (!fresh[realIdx].replies) fresh[realIdx].replies = [];
        fresh[realIdx].replies.push({ from: "user", text: text, time: new Date().toISOString() });
        saveAll(fresh);
        qs("#user-admin-reply-input").value = "";
        openDetail(idx);
        toast("Javob yuborildi \u2713", "ok");
      });
    }

    renderList();
    setInterval(renderList, 5000);
  }

  /* в”Ђв”Ђ Support Chat Widget в”Ђв”Ђ */
  function mountSupportWidget() {
    // Prevent duplicate widget
    if (document.querySelector(".support-fab")) return;

    var user = getUser();
    var guestEmail = "guest_" + (localStorage.getItem("netrica_guest_id") || (function () { var id = Math.random().toString(36).slice(2, 10); localStorage.setItem("netrica_guest_id", id); return id; })()) + "@guest";
    var userEmail = user ? user.email : guestEmail;
    var userName = user ? (user.name || "User") : "Guest";
    var isAdmin = user && (user.role === "admin" || user.email === "admin@netrica.com");
    const isAdminPage = document.body.getAttribute("data-admin") === "1";
    if (isAdminPage || isAdmin) return;

    function getSupportChats() {
      return readStore(STORAGE.supportChats, []);
    }
    function saveSupportChats(chats) {
      writeStore(STORAGE.supportChats, chats);
    }
    function syncToServer(thread) {
      var user = getUser();
      fetch('/api/support-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': userEmail, 'X-User-Role': (user && user.role === 'admin') ? 'admin' : 'user' },
        body: JSON.stringify({ thread: thread })
      }).catch(function() {});
    }
    function syncFromServer() {
      var user = getUser();
      fetch('/api/support-chats', {
        headers: { 'X-User-Email': userEmail, 'X-User-Role': (user && user.role === 'admin') ? 'admin' : 'user' }
      }).then(function(r) { return r.json(); }).then(function(data) {
        var items = data.items || [];
        if (!items.length) return;
        var all = getSupportChats();
        items.forEach(function(serverThread) {
          var local = all.find(function(c) { return c.email === serverThread.email; });
          if (local) {
            if (new Date(serverThread.updatedAt) > new Date(local.updatedAt)) {
              local.messages = serverThread.messages;
              local.updatedAt = serverThread.updatedAt;
            }
          } else {
            all.push(serverThread);
          }
        });
        writeStore(STORAGE.supportChats, all);
        if (panel.classList.contains('open')) renderMessages();
        checkUnread();
      }).catch(function() {});
    }
    function getMyThread() {
      const all = getSupportChats();
      let thread = all.find((c) => c.email === userEmail);
      if (!thread) {
        thread = { email: userEmail, name: userName, messages: [], updatedAt: new Date().toISOString() };
        all.push(thread);
        saveSupportChats(all);
      }
      return thread;
    }

    const fab = document.createElement("button");
    fab.className = "support-fab";
    fab.setAttribute("type", "button");
    fab.innerHTML = '<span class="support-fab-icon">\u2709</span><span class="support-fab-label">' + t("supportWidget.fab") + '</span><span class="support-fab-dot"></span>';
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.className = "support-panel";
    panel.innerHTML = '<div class="support-panel-head"><h4>' + t("supportWidget.title") + '</h4><div style="display:flex;gap:6px;align-items:center"><button class="support-panel-clear" type="button" title="Tozalash" style="background:none;border:none;color:#f87171;font-size:18px;cursor:pointer;padding:4px">\ud83d\uddd1</button><button class="support-panel-close" type="button">\u00d7</button></div></div><div class="support-messages" id="support-messages"></div><div class="support-input-area"><input type="file" id="support-tz-file" accept=".txt,.md,.pdf,.docx,.doc,.rtf" style="display:none"><button class="btn support-tz-btn" type="button" id="support-tz-upload" title="TZ yuklash">\ud83d\udcce</button><textarea placeholder="' + t("supportWidget.placeholder") + '" id="support-input"></textarea><button class="btn primary" type="button" id="support-send">' + t("supportWidget.send") + '</button></div>';
    document.body.appendChild(panel);

    const msgHost = panel.querySelector("#support-messages");
    const input = panel.querySelector("#support-input");
    const sendBtn = panel.querySelector("#support-send");
    const closeBtn = panel.querySelector(".support-panel-close");
    const dot = fab.querySelector(".support-fab-dot");

    function renderMessages() {
      const thread = getMyThread();
      const msgs = thread.messages || [];
      if (!msgs.length) {
        msgHost.innerHTML = '<div class="support-empty">' + t("supportWidget.empty") + '</div>';
        return;
      }
      msgHost.innerHTML = msgs.map(function (m) {
        var time = m.time ? new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
        var isMe = m.from === userEmail;
        var isAI = m.from === 'netrica-ai';
        var cls = isMe ? "user" : "admin";
        var sender = isMe ? t("supportWidget.you") : (isAI ? 'Netrica AI' : t("supportWidget.admin"));
        return '<div class="support-msg ' + cls + '"><div class="support-msg-sender">' + escapeHtml(sender) + '</div>' + escapeHtml(m.text) + '<div class="support-msg-time">' + time + '</div></div>';
      }).join("");
      msgHost.scrollTop = msgHost.scrollHeight;
    }

    function checkUnread() {
      var thread = getMyThread();
      var msgs = thread.messages || [];
      var hasAdminReply = msgs.some(function (m) { return m.from !== userEmail && !m.readByUser; });
      if (dot) dot.classList.toggle("active", hasAdminReply);
    }

    function sendMessage() {
      var text = input.value.trim();
      if (!text) return;
      var all = getSupportChats();
      var thread = all.find(function (c) { return c.email === userEmail; });
      if (!thread) {
        thread = { email: userEmail, name: userName, messages: [], updatedAt: new Date().toISOString() };
        all.push(thread);
      }
      thread.messages.push({ from: userEmail, text: text, time: new Date().toISOString(), readByAdmin: false, readByUser: true });
      thread.updatedAt = new Date().toISOString();
      saveSupportChats(all);
      syncToServer(thread);
      input.value = "";
      renderMessages();
      toast(t("supportWidget.sent"), "ok");
      var history = thread.messages.map(function(m) { return { from: m.from === userEmail ? 'user' : 'ai', text: m.text }; });
      sendBtn.disabled = true;
      sendBtn.textContent = '...';
      fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, history: history })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.ok && data.reply) {
          var freshAll = getSupportChats();
          var freshThread = freshAll.find(function(c) { return c.email === userEmail; });
          if (freshThread) {
            freshThread.messages.push({ from: 'netrica-ai', text: data.reply, time: new Date().toISOString(), readByAdmin: true, readByUser: true });
            freshThread.updatedAt = new Date().toISOString();
            saveSupportChats(freshAll);
            syncToServer(freshThread);
            renderMessages();
          }
        }
      }).catch(function() {}).finally(function() {
        sendBtn.disabled = false;
        sendBtn.textContent = t('supportWidget.send');
      });
    }

    fab.addEventListener("click", function () {
      panel.classList.toggle("open");
      fab.style.display = panel.classList.contains("open") ? "none" : "";
      if (panel.classList.contains("open")) {
        var all = getSupportChats();
        var thread = all.find(function (c) { return c.email === userEmail; });
        if (thread) {
          thread.messages.forEach(function (m) { if (m.from !== userEmail) m.readByUser = true; });
          saveSupportChats(all);
        }
        renderMessages();
        checkUnread();
        input.focus();
      }
    });

    closeBtn.addEventListener("click", function () {
      panel.classList.remove("open");
      fab.style.display = "";
    });

    var clearBtn = panel.querySelector(".support-panel-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        var all = getSupportChats();
        var thread = all.find(function (c) { return c.email === userEmail; });
        if (thread) {
          thread.messages = [];
          thread.updatedAt = new Date().toISOString();
          saveSupportChats(all);
          syncToServer(thread);
        }
        renderMessages();
        toast("Chat tozalandi", "ok");
      });
    }

    sendBtn.addEventListener("click", sendMessage);

    // TZ file upload logic
    var tzFileInput = panel.querySelector("#support-tz-file");
    var tzUploadBtn = panel.querySelector("#support-tz-upload");
    if (tzUploadBtn && tzFileInput) {
      tzUploadBtn.addEventListener("click", function() { tzFileInput.click(); });
      tzFileInput.addEventListener("change", function() {
        var file = tzFileInput.files[0];
        if (!file) return;
        tzFileInput.value = "";
        // Show uploading message
        var all = getSupportChats();
        var thread = all.find(function(c) { return c.email === userEmail; });
        if (!thread) {
          thread = { email: userEmail, name: userName, messages: [], updatedAt: new Date().toISOString() };
          all.push(thread);
        }
        thread.messages.push({ from: userEmail, text: "\ud83d\udcce " + file.name + " (TZ fayl yuklandi)", time: new Date().toISOString(), readByAdmin: false, readByUser: true });
        thread.updatedAt = new Date().toISOString();
        saveSupportChats(all);
        syncToServer(thread);
        renderMessages();
        // Upload to server
        tzUploadBtn.disabled = true;
        tzUploadBtn.textContent = "...";
        var fd = new FormData();
        fd.append("file", file);
        fetch("/api/upload-tz", { method: "POST", body: fd })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.ok && data.analysis) {
              var freshAll = getSupportChats();
              var freshThread = freshAll.find(function(c) { return c.email === userEmail; });
              if (freshThread) {
                var analysisText = data.analysis + "\n\n\u2705 Buyurtma berish uchun pastdagi xabar maydoniga 'buyurtma' deb yozing.";
                freshThread.messages.push({ from: "netrica-ai", text: analysisText, time: new Date().toISOString(), readByAdmin: true, readByUser: true, isTzAnalysis: true, filename: data.filename, savedFile: data.savedFile });
                freshThread.updatedAt = new Date().toISOString();
                saveSupportChats(freshAll);
                syncToServer(freshThread);
                renderMessages();
              }
            } else {
              toast(data.error === "unsupported_format" ? "Faqat .txt, .md, .pdf, .docx formatlar qo\u2018llab-quvvatlanadi" : "Fayl tahlil qilib bo\u2018lmadi", "err");
            }
          })
          .catch(function() { toast("Server xatosi", "err"); })
          .finally(function() {
            tzUploadBtn.disabled = false;
            tzUploadBtn.textContent = "\ud83d\udcce";
          });
      });
    }
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    setInterval(function () {
      checkUnread();
      if (panel.classList.contains("open")) renderMessages();
    }, 3000);

    setInterval(function () { syncFromServer(); }, 600000);
    syncFromServer();
    renderMessages();
    checkUnread();
  }

  /* в”Ђв”Ђ Admin Support Chat в”Ђв”Ђ */
  function renderAdminSupportChat() {
    var host = qs("#admin-support-chat");
    if (!host) return;
    var adminUser = getUser();
    if (!adminUser || adminUser.role !== "admin") return;

    function getSupportChats() { return readStore(STORAGE.supportChats, []); }
    function saveSupportChats(chats) { writeStore(STORAGE.supportChats, chats); }
    function adminSyncToServer(thread) {
      fetch('/api/support-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Email': 'admin@netrica.com', 'X-User-Role': 'admin' },
        body: JSON.stringify({ thread: thread })
      }).catch(function() {});
    }
    function adminSyncFromServer() {
      fetch('/api/support-chats', {
        headers: { 'X-User-Email': 'admin@netrica.com', 'X-User-Role': 'admin' }
      }).then(function(r) { return r.json(); }).then(function(data) {
        var items = data.items || [];
        if (!items.length) return;
        var all = getSupportChats();
        items.forEach(function(serverThread) {
          var local = all.find(function(c) { return c.email === serverThread.email; });
          if (local) {
            if (new Date(serverThread.updatedAt) > new Date(local.updatedAt)) {
              local.messages = serverThread.messages;
              local.updatedAt = serverThread.updatedAt;
              local.name = serverThread.name;
            }
          } else {
            all.push(serverThread);
          }
        });
        writeStore(STORAGE.supportChats, all);
        if (!currentThread) renderThreadList();
        else renderChatView();
      }).catch(function() {});
    }

    var currentThread = null;

    function renderThreadList() {
      var chats = getSupportChats();
      if (!chats.length) {
        host.innerHTML = '<div class="support-empty">' + t("supportWidget.noThreads") + '</div>';
        return;
      }
      var sorted = chats.slice().sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
      var html = '<div class="admin-support-threads">';
      sorted.forEach(function (c) {
        var msgs = c.messages || [];
        var last = msgs[msgs.length - 1];
        var preview = last ? last.text.slice(0, 80) : "\u2014";
        var time = last ? new Date(last.time).toLocaleString() : "\u2014";
        var unread = msgs.filter(function (m) { return m.from !== "admin@netrica.com" && !m.readByAdmin; }).length;
        html += '<div class="admin-support-thread" data-email="' + escapeHtml(c.email) + '">';
        html += '<div class="admin-support-thread-head"><span class="admin-support-thread-email">' + escapeHtml(c.email) + '</span><span class="admin-support-thread-time">' + time + '</span></div>';
        html += '<div class="admin-support-thread-preview">' + escapeHtml(preview) + '</div>';
        if (unread > 0) html += '<span class="admin-support-thread-count" style="margin-top:6px">' + unread + ' ' + t("supportWidget.threadCount") + '</span>';
        html += '</div>';
      });
      html += '</div>';
      host.innerHTML = html;

      host.querySelectorAll(".admin-support-thread").forEach(function (el) {
        el.addEventListener("click", function () {
          currentThread = el.getAttribute("data-email");
          renderChatView();
        });
      });
    }

    function renderChatView() {
      var all = getSupportChats();
      var thread = all.find(function (c) { return c.email === currentThread; });
      if (!thread) { currentThread = null; renderThreadList(); return; }

      thread.messages.forEach(function (m) { if (m.from !== "admin@netrica.com") m.readByAdmin = true; });
      saveSupportChats(all);

      var msgs = thread.messages || [];
      var msgsHtml = '';
      if (msgs.length) {
        msgs.forEach(function (m) {
          var time = m.time ? new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
          var isAdmin = m.from === "admin@netrica.com";
          var cls = isAdmin ? "admin" : "user";
          var sender = isAdmin ? t("supportWidget.admin") : escapeHtml(thread.name || thread.email);
          msgsHtml += '<div class="support-msg ' + cls + '"><div class="support-msg-sender">' + sender + '</div>' + escapeHtml(m.text) + '<div class="support-msg-time">' + time + '</div></div>';
        });
      } else {
        msgsHtml = '<div class="support-empty">' + t("supportWidget.empty") + '</div>';
      }

      host.innerHTML = '<button class="admin-chat-back" type="button">' + t("supportWidget.back") + '</button>'
        + '<div style="margin-bottom:10px"><strong>' + escapeHtml(thread.email) + '</strong> <span class="small">(' + escapeHtml(thread.name || "") + ')</span></div>'
        + '<div class="support-messages" id="admin-chat-msgs" style="max-height:300px;min-height:200px;border:1px solid var(--line);border-radius:14px">' + msgsHtml + '</div>'
        + '<div class="support-input-area" style="border:none;padding:10px 0 0"><textarea placeholder="' + t("supportWidget.reply") + '" id="admin-reply-input"></textarea><button class="btn primary" type="button" id="admin-reply-send">' + t("supportWidget.send") + '</button></div>';

      var msgsEl = host.querySelector("#admin-chat-msgs");
      if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

      host.querySelector(".admin-chat-back").addEventListener("click", function () {
        currentThread = null;
        renderThreadList();
      });

      var replyInput = host.querySelector("#admin-reply-input");
      var replyBtn = host.querySelector("#admin-reply-send");

      function sendReply() {
        var text = replyInput.value.trim();
        if (!text) return;
        var fresh = getSupportChats();
        var thr = fresh.find(function (c) { return c.email === currentThread; });
        if (!thr) return;
        thr.messages.push({ from: "admin@netrica.com", text: text, time: new Date().toISOString(), readByAdmin: true, readByUser: false });
        thr.updatedAt = new Date().toISOString();
        saveSupportChats(fresh);
        adminSyncToServer(thr);
        replyInput.value = "";
        renderChatView();
        toast(t("supportWidget.replied"), "ok");
      }

      replyBtn.addEventListener("click", sendReply);
      replyInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
      });
    }

    adminSyncFromServer();
    renderThreadList();
    setInterval(function () {
      adminSyncFromServer();
      if (!currentThread) renderThreadList();
    }, 600000);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await initI18n(getLang());

    if (!enforcePageAccess()) return;

    handleAuthForms();

    renderProducts();
    renderProductDetail();
    renderDashboard();
    renderMyLists();
    renderPayment();
    renderChat();
    renderAdmin();
    renderPersonalInfo();
    renderAdminSettings();
    renderAdminMessages();
    renderAdminOrders();
    renderAdminProducts();
    renderAdminUsers();
    renderAdminBadges();
    renderAdminSupportChat();
    renderUserAdminMessages();
    renderAboutDetail();
    wireAboutCards();
    mountSupportWidget();
    if (getUser()) {
      var heroAuth = qs('.hero-auth-actions');
      if (heroAuth) heroAuth.style.display = 'none';
      
    }
  });

  window.Netrica = {
    t,
    toast,
    getUser,
    requireAuth,
    requireAdmin
  };
})();
