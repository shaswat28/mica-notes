// Mica Notes website: scroll reveals, header shadow and the interactive demo.
// First-party only, no network requests, nothing stored. The page works without it.
(() => {
  document.documentElement.classList.add("js");

  // Header shadow once the page scrolls.
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Reveal sections as they come into view. Children of [data-reveal-group] stagger.
  document.querySelectorAll("[data-reveal-group]").forEach(group => {
    [...group.children].forEach((child, i) => { child.setAttribute("data-reveal", ""); child.style.setProperty("--i", i); });
  });
  const revealables = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealables.forEach(el => io.observe(el));
  } else {
    revealables.forEach(el => el.classList.add("is-in"));
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Run fn(true/false) as an element enters or leaves the viewport.
  const whenVisible = (el, fn, threshold = 0.35) => {
    if (!("IntersectionObserver" in window)) { fn(true); return; }
    new IntersectionObserver(es => es.forEach(e => fn(e.isIntersecting)), { threshold }).observe(el);
  };

  let demoApi = null; // set below; quick capture adds threads to the hero demo through it
  const story = document.querySelector(".story");
  if (story) setUpStory(story);
  document.querySelectorAll("[data-try]").forEach(el => {
    const kind = el.getAttribute("data-try");
    ({ markdown: setUpMarkdown, reminder: setUpReminder, search: setUpSearch, capture: setUpCapture })[kind](el);
  });
  setUpGlow();

  const demo = document.querySelector(".demo");
  demoApi = demo ? setUpDemo(demo) : null;

  function setUpDemo(root) {
    const TAGS = {
      personal: { name: "Personal", color: "var(--tag-1)" },
      ideas: { name: "Ideas", color: "var(--tag-2)" },
      reading: { name: "Reading", color: "var(--tag-3)" }
    };
    // Times use the app's timeline format (CardDateFormatter.timelineString).
    const threads = [
      { id: "morning", title: "A quieter morning", tag: "personal", pinned: true, notes: [
        { time: "Tuesday at 7:10 AM", text: "Walk by the river before breakfast." },
        { time: "Tuesday at 7:42 AM", text: "Left the phone in my bag. The first hour felt **longer**, in a good way." },
        { time: "Today at 8:03 AM", text: "Bring a notebook next time." }
      ] },
      { id: "studio", title: "Ideas for the studio", tag: "ideas", reminder: true, notes: [
        { time: "Monday at 9:20 PM", text: "A long table by the window." },
        { time: "Today at 7:15 AM", text: "Warm light for evening work. Maybe two lamps instead of the ceiling light." }
      ] },
      { id: "books", title: "Books to come back to", tag: "reading", notes: [
        { time: "Sunday at 10:02 PM", text: "Read a few pages after dinner instead of scrolling." },
        { time: "Yesterday at 9:48 PM", text: "Keep a line worth reading twice." }
      ] },
      { id: "bag", title: "Weekend bag", tag: null, checklist: true, notes: [
        { time: "Friday at 6:30 PM", text: "Notebook", done: false },
        { time: "Friday at 6:30 PM", text: "Water bottle", done: true },
        { time: "Friday at 6:31 PM", text: "Light jacket", done: false }
      ] }
    ];
    const state = { scope: "all", query: "", selected: "morning" };

    const $ = sel => root.querySelector(sel);
    const win = $(".window");
    const list = $(".js-thread-list");
    const body = $(".detail-body");
    const titleEl = $(".detail-title");
    const chipsEl = $(".chips");
    const timeline = $(".timeline");
    const scroller = $(".timeline-scroll");
    const pinBtn = $(".pin-btn");
    const mobile = $(".mobile-threads");
    const form = $(".composer");
    const input = form.querySelector("input");
    const send = form.querySelector(".send");

    const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const plain = s => s.replace(/\*+/g, "");
    const current = () => threads.find(t => t.id === state.selected);
    const isToday = n => n.time.startsWith("Today") || n.time === "Just now";

    const SCOPES = {
      all: () => true,
      inbox: t => !t.tag,
      today: t => t.notes.some(isToday),
      pinned: t => !!t.pinned,
      reminders: t => !!t.reminder
    };
    const inScope = (t, scope = state.scope) => scope.startsWith("tag:") ? t.tag === scope.slice(4) : SCOPES[scope](t);
    function visible() {
      const q = state.query.trim().toLowerCase();
      return threads.filter(t => inScope(t) && (!q || t.title.toLowerCase().includes(q) || t.notes.some(n => plain(n.text).toLowerCase().includes(q))));
    }
    function meta(t) {
      const last = t.notes[t.notes.length - 1].time.replace(/ at .*/, "");
      if (t.checklist) return `${last} · ${t.notes.filter(n => n.done).length} of ${t.notes.length} done`;
      return `${last} · ${t.notes.length} ${t.notes.length === 1 ? "note" : "notes"}`;
    }

    function renderSidebar() {
      root.querySelectorAll("[data-count]").forEach(el => {
        const n = threads.filter(t => inScope(t, el.getAttribute("data-count"))).length;
        el.textContent = n || "";
      });
      root.querySelectorAll("[data-scope]").forEach(b => {
        const on = b.getAttribute("data-scope") === state.scope;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on);
      });
    }

    function renderList() {
      const items = visible();
      list.innerHTML = items.length ? items.map(t => `
        <button class="thread-card${t.id === state.selected ? " is-on" : ""}${t.fresh ? " is-fresh" : ""}" data-thread="${t.id}" aria-pressed="${t.id === state.selected}">
          <b>${esc(t.title)}</b><span>${esc(plain(t.notes[t.notes.length - 1].text))}</span>
          <span class="meta">${t.tag ? `<span class="dot" style="background:${TAGS[t.tag].color}"></span>` : ""}<span>${meta(t)}</span></span>
        </button>`).join("") : `<p class="list-empty">${state.query ? `No threads match “${esc(state.query)}”.` : "Nothing here yet."}</p>`;
      threads.forEach(t => delete t.fresh);
      mobile.innerHTML = threads.map(t =>
        `<button data-thread="${t.id}" aria-pressed="${t.id === state.selected}">${esc(t.title)}</button>`).join("");
    }

    const CHECK_SVG = '<svg viewBox="0 0 22 22" aria-hidden="true"><circle class="ring" cx="11" cy="11" r="9.5"/><circle class="fill" cx="11" cy="11" r="10.3"/><path class="tick" d="M6.8 11.3l2.8 2.8 5.6-6"/></svg>';
    function noteHTML(t, n, i) {
      const cls = [t.checklist && "is-check", t.checklist && n.done && "is-done", n.isNew && "is-new"].filter(Boolean).join(" ");
      const box = t.checklist
        ? `<button class="check" role="checkbox" aria-checked="${!!n.done}" aria-label="Done: ${esc(plain(n.text))}" data-check="${i}">${CHECK_SVG}</button>` : "";
      return `<li${cls ? ` class="${cls}"` : ""}>${box}<p class="note-text">${md(n.text)}</p><time>${esc(n.time)}</time></li>`;
    }

    function renderChips(t) {
      chipsEl.innerHTML = (t.tag ? `<span class="chip"><span class="dot" style="background:${TAGS[t.tag].color}"></span>${TAGS[t.tag].name}</span>` : "")
        + (t.pinned ? `<span class="chip">Pinned</span>` : "")
        + (t.reminder ? `<span class="chip">Tomorrow 9:00 AM</span>` : "");
      pinBtn.setAttribute("aria-pressed", !!t.pinned);
      pinBtn.setAttribute("aria-label", t.pinned ? "Unpin thread" : "Pin thread");
    }

    function renderDetail(animate) {
      const t = current();
      titleEl.textContent = t.title;
      renderChips(t);
      timeline.innerHTML = t.notes.map((n, i) => noteHTML(t, n, i)).join("");
      t.notes.forEach(n => delete n.isNew);
      input.placeholder = t.checklist ? "Add an item…" : "Add to thread…";
      if (animate) [body, scroller].forEach(el => { el.classList.remove("is-switching"); void el.offsetWidth; el.classList.add("is-switching"); });
    }

    function select(id) {
      if (id === state.selected) return;
      state.selected = id;
      renderList();
      renderDetail(true);
      scroller.scrollTop = 0;
    }

    root.addEventListener("click", e => {
      const scope = e.target.closest("[data-scope]");
      if (scope) {
        state.scope = scope.getAttribute("data-scope");
        const items = visible();
        const switching = items.length && !items.some(t => t.id === state.selected);
        if (switching) state.selected = items[0].id;
        renderSidebar(); renderList();
        if (switching) renderDetail(true);
        return;
      }
      const thread = e.target.closest("[data-thread]");
      if (thread) { select(thread.getAttribute("data-thread")); return; }
      const check = e.target.closest("[data-check]");
      if (check) {
        // Toggle in place: re-rendering here restarts the animation and looks glitchy.
        const n = current().notes[+check.getAttribute("data-check")];
        n.done = !n.done;
        check.setAttribute("aria-checked", n.done);
        check.parentElement.classList.toggle("is-done", n.done);
        renderList();
        return;
      }
      if (e.target.closest(".pin-btn")) {
        const t = current();
        t.pinned = !t.pinned;
        renderChips(t); renderSidebar(); renderList();
      }
    });

    root.querySelector(".list-search").addEventListener("input", e => {
      state.query = e.target.value;
      const items = visible();
      if (items.length && !items.some(t => t.id === state.selected)) { state.selected = items[0].id; renderDetail(true); }
      renderList();
    });

    input.addEventListener("input", () => { send.disabled = !input.value.trim(); });
    form.addEventListener("submit", e => {
      e.preventDefault();
      const text = input.value.trim().slice(0, 280);
      if (!text) return;
      const t = current();
      const note = { time: "Just now", text, isNew: true, done: t.checklist ? false : undefined };
      t.notes.push(note);
      input.value = "";
      send.disabled = true;
      const prevLast = timeline.lastElementChild;
      if (prevLast) prevLast.classList.remove("is-new");
      timeline.insertAdjacentHTML("beforeend", noteHTML(t, note, t.notes.length - 1));
      delete note.isNew;
      renderSidebar(); renderList();
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    });

    // Theme picker: swaps the demo to the app's real palettes.
    let themingTimer;
    root.querySelectorAll(".swatch").forEach(sw => sw.addEventListener("click", () => {
      win.classList.add("is-theming");
      clearTimeout(themingTimer);
      themingTimer = setTimeout(() => win.classList.remove("is-theming"), 500);
      root.setAttribute("data-theme", sw.getAttribute("data-theme"));
      root.querySelectorAll(".swatch").forEach(s => s.setAttribute("aria-pressed", s === sw));
    }));

    send.disabled = true;
    renderSidebar(); renderList(); renderDetail(false);

    let captured = 0;
    return {
      // A quick capture becomes a new untagged thread in the Inbox, titled by its first line like the app.
      capture(text) {
        const first = text.split("\n").find(l => l.trim()) || "Untitled thread";
        const title = plain(first.replace(/^(#{1,3}|[-*]|- \[[ xX]\])\s+/, "")).trim().slice(0, 60);
        const id = "capture-" + ++captured;
        threads.unshift({ id, title: title || "Untitled thread", tag: null, fresh: true, notes: [{ time: "Just now", text }] });
        state.scope = "inbox"; state.query = ""; state.selected = id;
        root.querySelector(".list-search").value = "";
        renderSidebar(); renderList(); renderDetail(true);
        scroller.scrollTop = 0;
      },
      show(id) { root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); }
    };
  }

  // How threads work: three steps that build one thread. Plays on its own while
  // visible; any click takes over and stops the autoplay for good.
  function setUpStory(root) {
    const steps = [...root.querySelectorAll(".story-step")];
    const stage = root.querySelector(".story-stage");
    const query = stage.querySelector(".stage-query");
    const STEP_MS = 5200;
    let current = 0, timer = null, typing = null, auto = !reduceMotion, visible = false;
    root.style.setProperty("--story-ms", STEP_MS + "ms");

    function typeQuery() {
      clearInterval(typing);
      stage.classList.remove("is-found");
      if (reduceMotion) { query.textContent = "lamp"; stage.classList.add("is-found"); return; }
      query.textContent = "";
      let i = 0;
      typing = setInterval(() => {
        query.textContent = "lamp".slice(0, ++i);
        if (i === 4) { clearInterval(typing); stage.classList.add("is-found"); }
      }, 130);
    }
    function show(n) {
      current = n;
      stage.setAttribute("data-step", n);
      steps.forEach((s, i) => {
        const on = i + 1 === n;
        s.classList.toggle("is-on", on);
        s.classList.remove("is-timing");
        s.querySelector(".story-btn").setAttribute("aria-pressed", on);
      });
      if (n === 3) typeQuery(); else { clearInterval(typing); stage.classList.remove("is-found"); }
      if (auto && visible) {
        const s = steps[n - 1];
        void s.offsetWidth;
        s.classList.add("is-timing");
        clearTimeout(timer);
        timer = setTimeout(() => show(n % 3 + 1), STEP_MS);
      }
    }
    function stop() { auto = false; clearTimeout(timer); steps.forEach(s => s.classList.remove("is-timing")); }
    // The whole step card is clickable (the button inside keeps keyboard access),
    // and tapping the preview skips ahead to the next step.
    steps.forEach((s, i) => s.addEventListener("click", () => { stop(); show(i + 1); }));
    stage.addEventListener("click", () => { stop(); show(current % 3 + 1); });
    whenVisible(stage, v => {
      visible = v;
      if (!auto) return;
      if (v) show(current || 1); else { clearTimeout(timer); steps.forEach(s => s.classList.remove("is-timing")); }
    });
    show(1);
  }

  // Live Markdown: the same marks the app styles, with the markers left in place and dimmed.
  function setUpMarkdown(root) {
    const input = root.querySelector("input"), out = root.querySelector(".md-out");
    const mk = m => `<span class="mk">${esc(m)}</span>`;
    // One pass so a mark never matches inside another mark's output.
    const INLINE = /(\*\*|__)(?!\s)(.+?)\1|(~~)(.+?)~~|(`)([^`]+)`|(^|[^*\w])([*_])(?![\s*_])(.+?)\8(?!\w)|\bhttps?:\/\/[^\s<]+/g;
    function inline(t) {
      return esc(t).replace(INLINE, (all, b1, b2, s1, s2, c1, c2, ip, i1, i2) => {
        if (b1) return mk(b1) + `<b>${b2}</b>` + mk(b1);
        if (s1) return mk("~~") + `<s>${s2}</s>` + mk("~~");
        if (c1) return mk("`") + `<code>${c2}</code>` + mk("`");
        if (i1) return ip + mk(i1) + `<i>${i2}</i>` + mk(i1);
        return `<a href="${all}" rel="noopener nofollow" tabindex="-1">${all}</a>`;
      });
    }
    function render() {
      const t = input.value;
      let m;
      if ((m = t.match(/^(#{1,3}) (.*)$/))) out.innerHTML = mk(m[1] + " ") + `<span class="h${m[1].length}">${inline(m[2])}</span>`;
      else if ((m = t.match(/^- \[( |x|X)\] ?(.*)$/))) out.innerHTML = mk("- [" + m[1] + "] ").replace("mk", "mk visually-hidden") + `<span class="box${m[1] === " " ? "" : " done"}"></span>` + inline(m[2]);
      else if ((m = t.match(/^([-*]|\d+\.) (.*)$/))) out.innerHTML = mk(m[1] === "*" || m[1] === "-" ? "• " : m[1] + " ") + inline(m[2]);
      else out.innerHTML = inline(t) || `<span class="mk">Start typing…</span>`;
    }
    input.addEventListener("input", render);
    root.querySelectorAll("[data-fill]").forEach(b => b.addEventListener("click", () => { input.value = b.getAttribute("data-fill"); render(); }));
    render();
  }

  // Typed reminders: a small parser for the phrases people actually write, shown
  // in the app's reminder label format ("Tomorrow 9:00 AM", "Nov 28 6:30 PM").
  function setUpReminder(root) {
    const input = root.querySelector("input"), out = root.querySelector(".rem-out"), label = out.querySelector(".rem-label");
    const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function parse(text, now) {
      const t = text.toLowerCase().trim();
      if (!t) return null;
      let m = t.match(/\bin (\d{1,3}|an?|one|two|three) (min|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks)\b/);
      if (m) {
        const n = { a: 1, an: 1, one: 1, two: 2, three: 3 }[m[1]] || +m[1];
        const unit = m[2][0] === "m" ? 6e4 : m[2][0] === "h" ? 36e5 : m[2][0] === "d" ? 864e5 : 6048e5;
        return new Date(now.getTime() + n * unit);
      }
      const day = new Date(now); day.setSeconds(0, 0);
      let dayGiven = false, hour = null, minute = 0;
      if (/\btomorrow\b/.test(t)) { day.setDate(day.getDate() + 1); dayGiven = true; }
      else if (/\b(today|tonight|this evening)\b/.test(t)) dayGiven = true;
      else {
        const d = DAYS.findIndex(n => new RegExp(`\\b${n.slice(0, 3)}(${n.slice(3)})?\\b`).test(t));
        if (d >= 0) { let add = (d - day.getDay() + 7) % 7 || 7; day.setDate(day.getDate() + add); dayGiven = true; }
      }
      if ((m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/))) {
        hour = +m[1] % 12 + (m[3][0] === "p" ? 12 : 0); minute = +(m[2] || 0);
        if (+m[1] > 12) return null;
      } else if ((m = t.match(/\b([01]?\d|2[0-3]):(\d{2})\b/))) { hour = +m[1]; minute = +m[2]; }
      else if (/\bnoon\b/.test(t)) hour = 12;
      else if (/\bmidnight\b/.test(t)) hour = 0;
      else if ((m = t.match(/\bat (\d{1,2})\b/))) { hour = +m[1]; if (hour < 8) hour += 12; }
      else if (/\btonight\b|\bthis evening\b/.test(t)) hour = 20;
      else if (/\bmorning\b/.test(t)) hour = 9;
      else if (/\bafternoon\b/.test(t)) hour = 15;
      else if (dayGiven) hour = 9;
      if (hour === null) return null;
      day.setHours(hour, minute);
      if (!dayGiven && day < now) day.setDate(day.getDate() + 1);
      if (day < new Date(now.getTime() - 6e4)) return null;
      return day;
    }
    function format(d, now) {
      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const sameDay = (a, b) => a.toDateString() === b.toDateString();
      const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
      if (sameDay(d, now)) return `Today ${time}`;
      if (sameDay(d, tomorrow)) return `Tomorrow ${time}`;
      return `${MONTHS[d.getMonth()]} ${d.getDate()} ${time}`;
    }
    let last = "";
    function update() {
      const now = new Date(), d = parse(input.value, now);
      const text = d ? format(d, now) : "Try “friday 6pm” or “in 20 minutes”";
      out.classList.toggle("is-miss", !d);
      if (text !== last) { label.textContent = text; label.classList.remove("pop"); void label.offsetWidth; label.classList.add("pop"); last = text; }
    }
    input.addEventListener("input", update);
    root.querySelectorAll("[data-fill]").forEach(b => b.addEventListener("click", () => { input.value = b.getAttribute("data-fill"); update(); }));
    update();
  }

  // Search filters: the tokens the app understands, applied to a few sample threads.
  function setUpSearch(root) {
    const input = root.querySelector("input"), count = root.querySelector(".search-count");
    const items = [...root.querySelectorAll(".search-results li")];
    const chips = [...root.querySelectorAll("[data-token]")];
    function update() {
      const tokens = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      const filters = tokens.filter(t => /^(tag|has|is):\S+$/.test(t));
      const words = tokens.filter(t => !filters.includes(t));
      let shown = 0;
      items.forEach(li => {
        const ok = filters.every(f => {
          const [k, v] = f.split(":");
          if (k === "tag") return li.getAttribute("data-tags").split(" ").includes(v);
          if (k === "has") return li.getAttribute("data-has").split(" ").includes(v);
          return v === "pinned" ? li.hasAttribute("data-pinned") : true;
        }) && words.every(w => (li.getAttribute("data-text") + " " + li.textContent).toLowerCase().includes(w));
        li.classList.toggle("is-out", !ok);
        if (ok) shown++;
      });
      count.textContent = shown ? `${shown} of ${items.length} threads` : "No threads match. Try removing a filter.";
      chips.forEach(c => c.setAttribute("aria-pressed", tokens.includes(c.getAttribute("data-token"))));
    }
    chips.forEach(c => c.addEventListener("click", () => {
      const tok = c.getAttribute("data-token");
      const tokens = input.value.split(/\s+/).filter(Boolean);
      const i = tokens.findIndex(t => t.toLowerCase() === tok);
      if (i >= 0) tokens.splice(i, 1); else tokens.unshift(tok);
      input.value = tokens.join(" ");
      update();
    }));
    input.addEventListener("input", update);
    update();
  }

  // Quick capture, after MacCapturePanelView: ⌃⌥N or the menu bar gem opens it,
  // Return saves (Shift-Return for a new line), Esc closes. A saved note joins the hero demo.
  function setUpCapture(root) {
    const gem = root.querySelector(".mb-gem"), panel = root.querySelector(".qc");
    const input = panel.querySelector("textarea"), hint = panel.querySelector(".qc-hint-text"), hintKey = panel.querySelector(".qc-hint .keycap");
    const toast = root.querySelector(".capture-toast");
    let toastTimer;
    const isMac = /Mac/.test(navigator.platform || navigator.userAgent);
    function sync() {
      const has = !!input.value.trim();
      panel.classList.toggle("has-text", has);
      hintKey.textContent = has ? (isMac ? "⌘↩" : "Ctrl↩") : "↩";
      hint.textContent = has ? "Thread" : "to search";
    }
    function show() { toast.classList.remove("is-on"); panel.hidden = false; gem.setAttribute("aria-expanded", "true"); input.focus({ preventScroll: true }); }
    function hide() { panel.hidden = true; gem.setAttribute("aria-expanded", "false"); input.value = ""; sync(); }
    function save() {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      hide();
      if (demoApi) demoApi.capture(text);
      toast.innerHTML = `Saved to Inbox${demoApi ? ' <button type="button">See it</button>' : ""}`;
      const see = toast.querySelector("button");
      if (see) see.addEventListener("click", () => { toast.classList.remove("is-on"); demoApi.show(); });
      toast.classList.add("is-on");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-on"), 5000);
    }
    gem.addEventListener("click", () => panel.hidden ? show() : hide());
    panel.querySelector(".qc-new").addEventListener("click", () => { input.value = ""; sync(); input.focus(); });
    panel.addEventListener("submit", e => { e.preventDefault(); save(); });
    input.addEventListener("input", sync);
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); hide(); gem.focus(); }
      else if (e.key === "Enter" && !e.shiftKey && !e.altKey) { e.preventDefault(); save(); }
    });
    let inView = false;
    whenVisible(root, v => { inView = v; }, 0.2);
    document.addEventListener("keydown", e => {
      if (inView && e.ctrlKey && e.altKey && e.code === "KeyN") { e.preventDefault(); show(); }
    });
    sync();
  }

  // A soft glow that follows the pointer across cards. One rAF per frame at most.
  function setUpGlow() {
    if (reduceMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.querySelectorAll(".feature-group, .devices .card, .faq-grid .card, .plan").forEach(c => c.classList.add("glow-card"));
    let pending = null;
    document.addEventListener("pointermove", e => {
      const card = e.target.closest && e.target.closest(".glow-card");
      if (!card) return;
      if (pending) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
        pending = null;
      });
    }, { passive: true });
  }

})();
