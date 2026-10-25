/* Gains Tracker – Bewegung der Webseite. Ohne fremde Bibliotheken, damit keine Daten an Dritte gehen. */
(() => {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;

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

  /* Intro cards, shown once per visit */
  const intro = document.querySelector(".intro");
  const startPage = () => {
    document.body.classList.add("ready");
    document.querySelectorAll(".hero .split").forEach((el) => el.classList.add("on"));
  };
  let seen = false;
  try { seen = sessionStorage.getItem("gt-intro") === "1"; } catch (e) {}
  if (calm || seen) {
    intro.classList.add("gone");
    startPage();
  } else {
    try { sessionStorage.setItem("gt-intro", "1"); } catch (e) {}
    setTimeout(() => {
      intro.classList.add("out");
      setTimeout(startPage, 250);
      setTimeout(() => intro.classList.add("gone"), 1000);
    }, 1500);
  }

  /* Reveal blocks as they enter the screen, staggered inside each section */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("on");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll("section, footer").forEach((section) => {
    section.querySelectorAll("[data-reveal], [data-wipe]").forEach((el, i) => {
      el.style.setProperty("--rd", `${Math.min(i, 6) * 90}ms`);
      if (el.hasAttribute("data-reveal")) io.observe(el);
    });
  });

  /* A fully clipped element never counts as visible, so wipes watch their list instead */
  const wipeIo = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll(":scope > [data-wipe]").forEach((el) => el.classList.add("on"));
      wipeIo.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  new Set([...document.querySelectorAll("[data-wipe]")].map((el) => el.parentElement)).forEach((list) => wipeIo.observe(list));
  document.querySelectorAll(".mega .split").forEach((el) => io.observe(el));

  /* Counters run up once they are visible */
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
  const countIo = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      countIo.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("[data-count]").forEach((el) => countIo.observe(el));

  /* Scroll-linked motion: progress bar, nav, drifting statement, pinned gallery */
  const bar = document.querySelector(".progress");
  const nav = document.querySelector(".nav");
  const drifters = [...document.querySelectorAll("[data-drift]")];
  const gallery = document.querySelector(".gallery");
  const rail = document.querySelector(".rail");
  const meter = document.querySelector(".meter span");
  const slides = [...document.querySelectorAll(".slide img")];

  const onScroll = () => {
    const y = scrollY;
    const max = root.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("solid", y > 40);
    if (calm) return;

    drifters.forEach((el) => {
      const r = el.getBoundingClientRect();
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = `translateX(${p * 30 * Number(el.dataset.drift)}vw)`;
    });

    const g = gallery.getBoundingClientRect();
    const travel = gallery.offsetHeight - innerHeight;
    const p = Math.min(Math.max(-g.top / travel, 0), 1);
    const distance = rail.scrollWidth - innerWidth;
    rail.style.transform = `translateX(${-p * Math.max(distance, 0)}px)`;
    meter.style.transform = `scaleX(${p})`;
    const mid = innerWidth / 2;
    slides.forEach((img) => {
      const b = img.getBoundingClientRect();
      const off = Math.abs(b.left + b.width / 2 - mid) / innerWidth;
      img.style.setProperty("--s", (1.06 - Math.min(off, 0.6) * 0.18).toFixed(3));
    });
  };
  let queued = false;
  addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { onScroll(); queued = false; });
  }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  if (calm || !matchMedia("(pointer: fine)").matches) return;

  /* Phone follows the mouse a little */
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

  /* Spotlight inside feature cards */
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* Buttons lean towards the pointer */
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
})();
