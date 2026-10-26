/* Gains Tracker – Bewegung der Webseite. Ohne fremde Bibliotheken, damit keine Daten an Dritte gehen.
   Leitlinien: Animationen starten in der Mitte des Bildschirms (nicht schon am unteren Rand), und alles,
   was am Scrollen hängt, rechnet nur mit gemerkten Massen und einer geglätteten Scroll-Position. */
(() => {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  /* the middle band of the screen: things reveal when they reach it */
  const CENTER = { rootMargin: "-28% 0px -28% 0px", threshold: 0 };

  /* Split headings into letters so each one can rise out of its mask */
  const splitText = (el, baseMs) => {
    const words = el.textContent.trim().split(/\s+/);
    let n = 0;
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map((word) => {
      const letters = [...word].map((ch) => `<span class="l" style="--d:${n++}">${ch}</span>`).join("");
      return `<span class="w" aria-hidden="true">${letters}</span>`;
    }).join(" ");
    el.style.setProperty("--base", `${baseMs}ms`);
  };
  document.querySelectorAll(".hero .split").forEach((el, i) => splitText(el, i * 260));
  document.querySelectorAll(".mega .split").forEach((el, i) => splitText(el, i * 200));

  /* Start the hero animation right away */
  document.body.classList.add("ready");
  document.querySelectorAll(".hero .split").forEach((el) => el.classList.add("on"));

  /* One observer for everything that appears once: blocks, wipe lists, split headings, counters, clips */
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (calm || target === 0) { el.textContent = target; return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / 1600, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const show = (el) => {
    if (el.dataset.count !== undefined) countUp(el);
    else if (el.matches("[data-wipe-list]")) el.querySelectorAll(":scope > [data-wipe]").forEach((w) => w.classList.add("on"));
    else el.classList.add("on");
  };
  const pending = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      pending.delete(entry.target);
      io.unobserve(entry.target);
    });
  }, CENTER);
  const watch = (el) => { pending.add(el); io.observe(el); };
  document.querySelectorAll("section, footer").forEach((section) => {
    section.querySelectorAll("[data-reveal], [data-wipe]").forEach((el, i) => {
      el.style.setProperty("--rd", `${Math.min(i, 6) * 90}ms`);
      if (el.hasAttribute("data-reveal")) watch(el);
    });
  });
  /* a fully clipped element never counts as visible, so wipes watch their list instead */
  new Set([...document.querySelectorAll("[data-wipe]")].map((el) => el.parentElement)).forEach((list) => { list.setAttribute("data-wipe-list", ""); watch(list); });
  document.querySelectorAll(".mega .split, [data-count], .barbell").forEach(watch);
  const clips = [...document.querySelectorAll(".clip")];
  clips.forEach((c, i) => { c.querySelector(".screen").style.transitionDelay = `${(i % 4) * 120}ms`; watch(c); });
  /* the last blocks of the page never reach the middle: show them once the end is reached */
  const flushAtEnd = (y) => {
    if (!pending.size || y < root.scrollHeight - innerHeight - 4) return;
    pending.forEach((el) => { show(el); io.unobserve(el); });
    pending.clear();
  };

  /* ---------- Scroll-linked motion ---------- */
  const bar = document.querySelector(".progress");
  const nav = document.querySelector(".nav");
  const drifters = [...document.querySelectorAll("[data-drift]")];
  const gallery = document.querySelector(".gallery");
  const rail = document.querySelector(".rail");
  const meter = document.querySelector(".meter span");
  const slides = [...document.querySelectorAll(".slide")].map((fig) => ({ fig, img: fig.querySelector("img") }));
  const custom = document.querySelector(".custom");
  const typeName = custom?.querySelector("[data-type='name']");
  const typeDesc = custom?.querySelector("[data-type='desc']");
  const steps = custom ? [...custom.querySelectorAll(".step")] : [];
  const live = document.querySelector(".live");

  /* Measured once (and on resize), so a frame never asks the browser for layout */
  let M = {};
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  const measure = () => {
    M = {
      vh: innerHeight, vw: innerWidth, max: root.scrollHeight - innerHeight,
      drift: drifters.map((el) => ({ el, mid: docTop(el) + el.offsetHeight / 2, k: Number(el.dataset.drift) })),
      gTop: docTop(gallery), gH: gallery.offsetHeight, railW: rail.scrollWidth,
      slideMid: slides.map(({ fig }) => fig.offsetLeft + fig.offsetWidth / 2),
      cTop: custom ? docTop(custom) : 0, cH: custom ? custom.offsetHeight : 1,
      lMid: live ? docTop(live) + live.offsetHeight / 2 : 0,
    };
  };

  let solid = null, lastStage = -1, lastName = -1, lastDesc = -1;
  const render = (y) => {
    const isSolid = y > 40;
    if (isSolid !== solid) { solid = isSolid; nav.classList.toggle("solid", isSolid); }
    if (calm) return;

    M.drift.forEach(({ el, mid, k }) => {
      /* slides in from the side and comes to rest once it reaches the middle, so it stays readable */
      const p = clamp((mid - y - M.vh / 2) / M.vh, 0, 1);
      el.style.transform = `translate3d(${(p * 40 * k).toFixed(2)}vw,0,0)`;
      el.style.opacity = (1 - p * 0.9).toFixed(2);
    });

    /* the rail always enters from the right, even on wide screens where all six cards fit */
    const gp = clamp((y - M.gTop) / (M.gH - M.vh));
    const distance = M.railW - M.vw;
    const from = M.vw * 0.75, to = distance > 0 ? -distance : -distance / 2;
    const x = from + (to - from) * ease(gp);
    rail.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    meter.style.transform = `scaleX(${gp.toFixed(4)})`;
    if (y > M.gTop - M.vh && y < M.gTop + M.gH) {
      slides.forEach(({ img }, i) => {
        const side = (M.slideMid[i] + x - M.vw / 2) / M.vw;
        const off = Math.min(Math.abs(side), 0.6);
        img.style.transform = `translate3d(0,0,0) rotateY(${(-side * 26).toFixed(1)}deg) scale(${(1.05 - off * 0.2).toFixed(3)})`;
        img.style.opacity = (1 - off * 0.9).toFixed(2);
      });
    }

    if (custom && y > M.cTop - M.vh && y < M.cTop + M.cH) {
      const q = clamp((y - M.cTop) / (M.cH - M.vh));
      const n = Math.round(typeName.dataset.text.length * clamp(q / 0.08));
      const d = Math.round(typeDesc.dataset.text.length * clamp((q - 0.08) / 0.2));
      if (n !== lastName) { lastName = n; typeName.textContent = typeName.dataset.text.slice(0, n); }
      if (d !== lastDesc) { lastDesc = d; typeDesc.textContent = typeDesc.dataset.text.slice(0, d); }
      const stage = q < 0.3 ? 0 : q < 0.55 ? 1 : q < 0.8 ? 2 : 3;
      if (stage !== lastStage) { lastStage = stage; custom.dataset.stage = stage; steps.forEach((s, i) => s.classList.toggle("on", i === stage)); }
      custom.style.setProperty("--scan", clamp((q - 0.3) / 0.25).toFixed(3));
    }

    /* desktop: the clips float at different speeds */
    if (live && M.vw > 900) {
      const p = (M.lMid - y - M.vh / 2) / M.vh;
      clips.forEach((c) => { c.style.transform = `translate3d(0,${(p * 90 * Number(c.dataset.depth)).toFixed(1)}px,0)`; });
    }
  };

  /* Smoothed scroll: the motion follows the finger with a short glide instead of jumping frame to frame */
  let target = scrollY, current = scrollY, running = false;
  const frame = () => {
    current += (target - current) * 0.2;
    if (Math.abs(target - current) < 0.5) current = target;
    render(current);
    if (current !== target) requestAnimationFrame(frame);
    else running = false;
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", () => {
    target = scrollY;
    bar.style.transform = `scaleX(${M.max > 0 ? (target / M.max).toFixed(4) : 0})`;
    flushAtEnd(target);
    kick();
  }, { passive: true });
  let resizeTimer;
  const remeasure = () => { measure(); target = current = scrollY; render(current); };
  addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(remeasure, 120); });
  addEventListener("load", remeasure);
  document.fonts?.ready.then(remeasure);
  measure();
  render(current);

  if (custom && calm) {
    typeName.textContent = typeName.dataset.text;
    typeDesc.textContent = typeDesc.dataset.text;
    custom.dataset.stage = 3;
  }

  /* ---------- Menu on phones: a circle opens from the button ---------- */
  const menuBtn = document.querySelector(".menu-btn");
  const menu = document.getElementById("menu");
  const setMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Menü schliessen" : "Menü öffnen");
    if (open) menu.hidden = false;
  };
  menuBtn.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  menu.addEventListener("transitionend", () => { if (!document.body.classList.contains("menu-open")) menu.hidden = true; });

  /* ---------- Videos load when they come close and only play while visible ---------- */
  const videoIo = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (!v.src && v.dataset.src) v.src = v.dataset.src;
        if (!calm) v.play().catch(() => {});
      } else v.pause();
    });
  }, { threshold: 0.35 });
  document.querySelectorAll("video").forEach((v) => { if (calm) v.removeAttribute("autoplay"); videoIo.observe(v); });

  /* ---------- Phone carousel: dots follow the swipe ---------- */
  const strip = document.querySelector(".clips");
  const dots = [...document.querySelectorAll(".dots span")];
  let dotQueued = false;
  strip?.addEventListener("scroll", () => {
    if (dotQueued) return;
    dotQueued = true;
    requestAnimationFrame(() => {
      dotQueued = false;
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let best = 0, bestD = Infinity;
      clips.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
      dots.forEach((d, i) => d.classList.toggle("on", i === best));
    });
  }, { passive: true });

  if (calm || !matchMedia("(pointer: fine)").matches) return;

  /* ---------- Pointer extras (desktop only) ---------- */
  const tilt = document.querySelector("[data-tilt]");
  const phone = tilt.querySelector(".phone");
  const chips = [...tilt.querySelectorAll("[data-float]")];
  document.querySelector(".hero").addEventListener("pointermove", (e) => {
    const x = e.clientX / innerWidth - 0.5;
    const yy = e.clientY / innerHeight - 0.5;
    phone.style.setProperty("--ry", `${-8 + x * 14}deg`);
    phone.style.setProperty("--rx", `${4 - yy * 10}deg`);
    chips.forEach((c, i) => { c.style.translate = `${x * (i ? -22 : 22)}px ${yy * 18}px`; });
  });
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
})();
