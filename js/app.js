/* ============ ЛОГИКА САЙТА ============
   Тексты тестов — в папке data/, внешний вид — css/style.css.
   Здесь обычно ничего менять не нужно. */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.TESTS = {};
  window.registerTest = (id, t) => { TESTS[id] = t; };

  let user = null, quiz = null, charts = [], adminRows = [], toastT;
  const ids = () => (window.TEST_FILES || []).filter(id => TESTS[id]);
  const levelFor = (t, total) => {
    const r = total / t.questions.length, L = t.levels || SITE.levels;
    return L.find(l => r <= l.upTo + 1e-9) || L[L.length - 1];
  };
  const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
  const wrap = (s, n = 14) => { const L = []; let c = ""; s.split(" ").forEach(w => { if ((c + " " + w).trim().length > n && c) { L.push(c); c = w; } else c = (c + " " + w).trim(); }); L.push(c); return L; };
  const when = d => d.timestamp ? d.timestamp.toDate().toLocaleString("ru-RU") : "только что";
  const toast = m => { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4500); };

  /* ---------- загрузка тестов ---------- */
  function loadTests() {
    return Promise.all((window.TEST_FILES || []).map(id => new Promise(res => {
      const s = document.createElement("script");
      s.src = `data/tests/${id}.js`; s.onload = s.onerror = res;
      s.onerror = () => { console.warn("Не найден файл теста:", id); res(); };
      document.head.appendChild(s);
    })));
  }

  /* ---------- экраны ---------- */
  function show(v) {
    $$(".view").forEach(e => e.hidden = e.id !== "v-" + v);
    $$(".tab").forEach(b => b.classList.toggle("on", b.dataset.go === v));
    document.body.dataset.mood = "neutral";
    $("footer").hidden = v === "result";
    charts.forEach(c => c.destroy()); charts = [];
    scrollTo({ top: 0, behavior: "auto" });
  }
  function go(v) {
    Sound.click();
    if (!user && v !== "login") v = "login";
    show(v);
    if (v === "home") renderHome();
    if (v === "mine") loadMine();
    if (v === "admin") loadAdmin();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) { e.preventDefault(); go(b.dataset.go); }
  });

  function renderHome() {
    $("#test-grid").innerHTML = ids().map(id => {
      const t = TESTS[id];
      return `<button class="card" data-start="${id}"><span class="ico">${esc(t.icon)}</span><b>${esc(t.title)}</b><span>${esc(t.subtitle || "")}</span><em>${t.questions.length} вопросов — начать</em></button>`;
    }).join("") || '<p class="empty">Тесты не найдены. Проверьте файл data/tests-list.js.</p>';
  }
  $("#test-grid").addEventListener("click", e => { const c = e.target.closest("[data-start]"); if (c) startQuiz(c.dataset.start); });

  /* ---------- прохождение ---------- */
  function startQuiz(id) { quiz = { id, i: 0, a: [], lock: false }; show("quiz"); Sound.click(); renderQ(); }
  function renderQ() {
    const t = TESTS[quiz.id], q = t.questions[quiz.i], n = t.questions.length;
    $("#quiz-title").textContent = `${t.icon} ${t.title}`;
    $("#q-count").textContent = `Вопрос ${quiz.i + 1} из ${n}`;
    $("#bar").style.width = (quiz.i / n * 100) + "%";
    $(".progress").setAttribute("aria-valuenow", Math.round(quiz.i / n * 100));
    $("#q-text").textContent = q.q;
    $("#opts").innerHTML = q.options.map((o, k) => `<button class="opt ${quiz.a[quiz.i] === k ? "on" : ""}" role="radio" aria-checked="${quiz.a[quiz.i] === k}" data-k="${k}">${esc(o.text)}</button>`).join("");
    $("#q-back").hidden = quiz.i === 0;
    quiz.lock = false;
  }
  $("#opts").addEventListener("click", e => {
    const b = e.target.closest(".opt"); if (!b || quiz.lock) return;
    quiz.lock = true; quiz.a[quiz.i] = +b.dataset.k;
    $$(".opt").forEach(x => x.classList.toggle("on", x === b));
    Sound.select();
    setTimeout(() => {
      if (quiz.i + 1 < TESTS[quiz.id].questions.length) { quiz.i++; Sound.next(); renderQ(); } else finish();
    }, reduce ? 0 : 320);
  });
  $("#q-back").onclick = () => { if (quiz.i > 0) { quiz.i--; Sound.click(); renderQ(); } };
  $("#q-exit").onclick = () => go("home");

  function compute(t, a) {
    const scores = {}; Object.keys(t.types).forEach(k => scores[k] = 0);
    let total = 0;
    t.questions.forEach((q, i) => {
      const o = q.options[a[i]]; if (!o) return;
      total += o.score; if (o.type in scores) scores[o.type] += o.score;
    });
    return { total, scores };
  }

  async function finish() {
    const t = TESTS[quiz.id], { total, scores } = compute(t, quiz.a);
    const id = quiz.id;
    try {
      await db.collection("test_results").add({
        userId: user.uid, userName: user.displayName || "Аноним", userEmail: user.email,
        testId: id, totalScore: total, scores, timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { toast("Результат не сохранился: " + e.message); }
    showResult({ id, total, scores, back: null, who: "" });
  }

  /* ---------- страница результата ---------- */
  function showResult({ id, total, scores, who, back }) {
    const t = TESTS[id];
    if (!t) { toast("Этого теста больше нет на сайте."); return; }
    const lv = levelFor(t, total), n = t.questions.length;
    show("result"); document.body.dataset.mood = lv.mood;
    Sound.result(lv.mood);
    $("#r-who").textContent = who || "";
    const bb = $("#r-back"); bb.hidden = !back; bb.onclick = back || null;
    $("#r-title").textContent = `${t.icon} ${t.title}`;
    $("#r-level").textContent = lv.title; $("#r-text").textContent = lv.text;
    $("#r-score").textContent = `${total} / ${n}`;
    $("#r-disc").textContent = SITE.disclaimer + " " + SITE.sources;

    const ink = css("--ink"), line = css("--line"), accent = css("--accent"), track = css("--track");
    const anim = reduce ? false : { duration: 1100 };

    charts.push(new Chart($("#gauge"), {
      type: "doughnut",
      data: { datasets: [{ data: [total, Math.max(n - total, 0)], backgroundColor: [accent, track], borderWidth: 0 }] },
      options: { rotation: -90, circumference: 180, cutout: "76%", animation: anim, plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }
    }));

    const possible = {};
    t.questions.forEach(q => { const seen = new Set(); q.options.forEach(o => { if (o.score > 0 && !seen.has(o.type)) { seen.add(o.type); possible[o.type] = (possible[o.type] || 0) + 1; } }); });
    const all = Object.entries(t.types).map(([k, d]) => ({ k, d, s: scores[k] || 0, max: possible[k] || 1 }));
    const vis = all.filter(e => !e.d.hidden).sort((a, b) => b.s - a.s);
    const nothing = vis.every(e => e.s === 0);
    const cards = nothing ? all.filter(e => e.d.hidden).concat(vis) : vis;

    /* радар — только если типов 3 и больше */
    const radar = vis.length >= 3;
    $("#radar-box").hidden = !radar;
    $("#radar-hint").hidden = !radar;
    if (radar) {
      const order = Object.keys(t.types).filter(k => !t.types[k].hidden);
      const data = order.map(k => scores[k] || 0);
      charts.push(new Chart($("#radar"), {
        type: "radar",
        data: { labels: order.map(k => wrap(`${t.types[k].icon} ${t.types[k].title}`)), datasets: [{ data, backgroundColor: accent + "40", borderColor: accent, borderWidth: 2.5, pointBackgroundColor: css("--accent2"), pointBorderColor: accent, pointRadius: 5, pointHoverRadius: 8 }] },
        options: {
          maintainAspectRatio: false, animation: anim,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.raw} из ${possible[order[c.dataIndex]] || "?"}` } } },
          scales: { r: { beginAtZero: true, suggestedMax: Math.max(4, ...data), ticks: { display: false, stepSize: 1 }, grid: { color: line }, angleLines: { color: line }, pointLabels: { color: ink, font: { family: "Nunito", size: 12, weight: "800" } } } },
          onClick: (e, els) => { if (els.length) openCard(order[els[0].index]); }
        }
      }));
    }

    /* полоски */
    const colors = [accent, css("--accent2")];
    $("#meters").innerHTML = vis.map((e, i) => `
      <button class="meter" data-k="${esc(e.k)}"><div class="meter-top"><span>${esc(e.d.icon)} ${esc(e.d.title)}</span><span>${e.s} из ${e.max}</span></div>
      <div class="meter-bar"><i data-w="${Math.round(e.s / e.max * 100)}" style="background:${i === 0 ? colors[0] : `color-mix(in srgb,${colors[0]} 55%,${colors[1]})`}"></i></div></button>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => $$(".meter-bar i").forEach(i => i.style.width = i.dataset.w + "%")));

    /* карточки с описаниями */
    $("#cards").innerHTML = cards.map((e, i) => `
      <details class="type" id="card-${esc(e.k)}" ${i === 0 ? "open" : ""}>
        <summary><span>${esc(e.d.icon)} ${esc(e.d.title)}</span>${e.d.hidden ? "" : `<span class="pill plain">${e.s} из ${e.max}</span>`}</summary>
        <div class="body">
          <p class="short">${esc(e.d.short || "")}</p>
          ${e.d.about ? `<p>${esc(e.d.about)}</p>` : ""}
          ${e.d.tips ? `<div class="tip"><b>Что с этим делать.</b> ${esc(e.d.tips)}</div>` : ""}
        </div>
      </details>`).join("");

    const fig = $("#r-figure"); fig.hidden = !t.image; if (t.image) $("#r-img").src = t.image;
  }
  function openCard(k) {
    const d = document.getElementById("card-" + k); if (!d) return;
    d.open = true; Sound.click();
    d.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }
  $("#meters").addEventListener("click", e => { const m = e.target.closest(".meter"); if (m) openCard(m.dataset.k); });

  /* ---------- мои результаты и админка ---------- */
  const rowHTML = (d, admin) => {
    const t = TESTS[d.testId || "test1"], mood = t ? levelFor(t, d.totalScore).mood : "mid", n = t ? t.questions.length : 15;
    return `<span><b>${t ? esc(t.icon + " " + t.title) : "Тест удалён с сайта"}</b>${admin ? `<br>${esc(d.userName)} · ${esc(d.userEmail)}` : ""}</span>
      <span class="pill ${mood === "good" ? "" : mood}">${d.totalScore} / ${n}</span><small>${when(d)}</small>`;
  };
  const dbError = (el, e) => {
    el.innerHTML = `<p class="empty">${e.code === "failed-precondition" ? "Firestore просит создать индекс: откройте консоль браузера (F12) и перейдите по ссылке из ошибки, затем подождите пару минут." : "Не удалось загрузить: " + esc(e.message)}</p>`;
  };

  async function loadMine() {
    const el = $("#mine-list"); el.innerHTML = '<p class="empty">Загружаем…</p>';
    try {
      const s = await db.collection("test_results").where("userId", "==", user.uid).orderBy("timestamp", "desc").get();
      if (s.empty) { el.innerHTML = '<p class="empty">Вы ещё не прошли ни одного теста.</p>'; return; }
      el.innerHTML = ""; 
      s.forEach(doc => {
        const d = doc.data(), b = document.createElement("button");
        b.className = "row"; b.innerHTML = rowHTML(d, false);
        b.onclick = () => showResult({ id: d.testId || "test1", total: d.totalScore, scores: d.scores || {}, who: `Ваш результат от ${when(d)}`, back: () => go("mine") });
        el.appendChild(b);
      });
    } catch (e) { dbError(el, e); }
  }

  async function loadAdmin() {
    const el = $("#admin-list"); el.innerHTML = '<p class="empty">Загружаем…</p>';
    const sel = $("#a-test");
    if (!sel.options.length) sel.innerHTML = '<option value="">Все тесты</option>' + ids().map(id => `<option value="${id}">${esc(TESTS[id].title)}</option>`).join("");
    try {
      const s = await db.collection("test_results").orderBy("timestamp", "desc").get();
      adminRows = s.docs.map(d => d.data()); drawAdmin();
    } catch (e) { dbError(el, e); }
  }
  function drawAdmin() {
    const el = $("#admin-list"), q = $("#a-search").value.toLowerCase(), tid = $("#a-test").value;
    const rows = adminRows.filter(d => (!tid || (d.testId || "test1") === tid) && (`${d.userName} ${d.userEmail}`).toLowerCase().includes(q));
    el.innerHTML = rows.length ? "" : '<p class="empty">Ничего не найдено.</p>';
    rows.forEach(d => {
      const b = document.createElement("button"); b.className = "row"; b.innerHTML = rowHTML(d, true);
      b.onclick = () => showResult({ id: d.testId || "test1", total: d.totalScore, scores: d.scores || {}, who: `Результат пользователя: ${d.userName}`, back: () => go("admin") });
      el.appendChild(b);
    });
  }
  $("#a-search").oninput = drawAdmin; $("#a-test").onchange = drawAdmin;

  /* ---------- вход / выход ---------- */
  $("#login").onclick = () => {
    if (!auth) return toast("Firebase не загрузился. Проверьте интернет.");
    const p = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(p).catch(err => {
      if (err.code === "auth/popup-blocked") auth.signInWithRedirect(p);
      else if (err.code !== "auth/popup-closed-by-user") toast("Ошибка входа: " + err.message);
    });
  };
  $("#logout").onclick = () => auth.signOut();
  $("#snd").onclick = () => { $("#snd").textContent = Sound.toggle() ? "🔊" : "🔇"; };
  $("#snd").textContent = Sound.on ? "🔊" : "🔇";

  function onUser(u) {
    user = u;
    const admin = !!u && u.email === ADMIN_EMAIL;
    $("#user").hidden = $("#tabs").hidden = !u;
    $("#badge").hidden = $("#tab-admin").hidden = !admin;
    if (u) {
      $("#avatar").src = u.photoURL || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'><circle cx='15' cy='15' r='15' fill='%2312a08f'/></svg>";
      $("#uname").textContent = u.displayName || u.email;
      Sound.login(); show("home"); renderHome();
    } else show("login");
  }

  /* ---------- старт ---------- */
  $("#tagline").textContent = SITE.tagline;
  $("#foot-disc").textContent = SITE.disclaimer;
  show("login");
  loadTests().then(() => { if (auth) auth.onAuthStateChanged(onUser); });
})();
