/* ══════════════════════════════════════════════════════
   main.js — שירה רווח
   Lenis + GSAP + ScrollTrigger
══════════════════════════════════════════════════════ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Lenis ───────────────────────────────────────────── */
let lenis;
if (!reduced) {
  lenis = new Lenis({
    duration: 1.25,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    smoothTouch: false,
  });

  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on('scroll', ScrollTrigger.update);
}

gsap.registerPlugin(ScrollTrigger);

/* ── Anchor clicks → Lenis ───────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.35, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

/* ── Sticky header ───────────────────────────────────── */
const header = document.getElementById('site-header');
if (header) {
  ScrollTrigger.create({
    trigger: '#about',
    start: 'top 85%',
    onEnter:     () => header.classList.add('is-visible'),
    onLeaveBack: () => header.classList.remove('is-visible'),
  });
}

/* ── Hero entrance ───────────────────────────────────── */
if (!reduced) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('.reveal-label', { opacity: 1, duration: 0.7, delay: 0.15 });

  // Mask-reveal each title line
  gsap.utils.toArray('.hero__title-line').forEach((line, i) => {
    const inner = document.createElement('span');
    inner.style.cssText = 'display:block;';
    inner.innerHTML = line.innerHTML;
    line.innerHTML = '';
    line.style.cssText = 'overflow:hidden; display:block;';
    line.appendChild(inner);

    tl.fromTo(inner,
      { yPercent: 108 },
      { yPercent: 0, duration: 1.1, ease: 'power3.out' },
      i === 0 ? '-=0.45' : '-=0.8'
    );
  });

  tl
    .to('.reveal-text', { opacity: 1, duration: 0.85 }, '-=0.5')
    .to('.reveal-cta',  { opacity: 1, duration: 0.7  }, '-=0.55')
    .to('.reveal-hint', { opacity: 1, duration: 0.6  }, '-=0.3')
    .fromTo('.hero__bg-line',
      { scaleX: 0 },
      { scaleX: 1, duration: 1.6, ease: 'power2.inOut', transformOrigin: 'right center' },
      '-=1.4'
    );

  // Activate scroll hint bounce after entrance
  tl.add(() => {
    document.querySelector('.hero__scroll-hint')?.classList.add('is-ready');
  });

  // Parallax on the big background "שירה" text
  gsap.to('.hero__bg-text', {
    y: -80,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1.5,
    },
  });

} else {
  gsap.set(['.reveal-label', '.reveal-text', '.reveal-cta', '.reveal-hint'], { opacity: 1 });
}

/* ── Scroll reveal util ──────────────────────────────── */
function fadeUp(targets, { duration = 0.9, stagger = 0.1, start = 'top 88%' } = {}) {
  if (reduced) return;
  gsap.utils.toArray(targets).forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 38 },
      {
        opacity: 1, y: 0,
        duration,
        ease: 'power3.out',
        delay: stagger * i,
        scrollTrigger: { trigger: el, start, toggleActions: 'play none none none' },
      }
    );
  });
}

/* ── About ───────────────────────────────────────────── */
fadeUp('.about__label',       { duration: 0.7 });
fadeUp('.about__pull-quote',  { duration: 1.05 });
fadeUp('.about__body',        { stagger: 0.15 });

if (!reduced) {
  gsap.fromTo('.about__rule',
    { scaleX: 0 },
    {
      scaleX: 1,
      duration: 1.1,
      ease: 'power2.inOut',
      transformOrigin: 'right center',
      scrollTrigger: { trigger: '.about__rule', start: 'top 90%' },
    }
  );
}

/* ── Programs ────────────────────────────────────────── */
fadeUp('.programs__header');

gsap.utils.toArray('.program').forEach(program => {
  if (reduced) return;

  const num     = program.querySelector('.program__number');
  const divider = program.querySelector('.program__divider');

  // Number slides in
  gsap.fromTo(num,
    { opacity: 0, x: 24 },
    { opacity: 1, x: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: program, start: 'top 82%' } }
  );

  // Number parallax
  gsap.to(num, {
    y: -55,
    ease: 'none',
    scrollTrigger: { trigger: program, start: 'top bottom', end: 'bottom top', scrub: 1.8 },
  });

  // Divider draws down
  if (divider) {
    gsap.fromTo(divider,
      { scaleY: 0 },
      { scaleY: 1, duration: 1.0, ease: 'power2.inOut', transformOrigin: 'top center',
        scrollTrigger: { trigger: program, start: 'top 80%' } }
    );
  }

  // Body elements stagger up
  const items = program.querySelectorAll(
    '.program__body > .label, .program__title, .program__desc, .module, .program__outcomes, .program__cta'
  );
  gsap.fromTo(items,
    { opacity: 0, y: 28 },
    { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09,
      scrollTrigger: { trigger: program, start: 'top 78%' } }
  );
});

/* ── Why Me ──────────────────────────────────────────── */
if (!reduced) {
  gsap.fromTo('.why__line',
    { scaleX: 0 },
    { scaleX: 1, duration: 1.2, ease: 'power2.inOut', transformOrigin: 'right center',
      scrollTrigger: { trigger: '.why__line', start: 'top 88%' } }
  );
  gsap.fromTo('.why__quote',
    { opacity: 0, y: 32 },
    { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out',
      scrollTrigger: { trigger: '.why__quote', start: 'top 85%' } }
  );
}

fadeUp('.why__stat', { stagger: 0.13, start: 'top 92%' });

/* ── Form ────────────────────────────────────────────── */
fadeUp('.form-section .section-title');
fadeUp('.form-section__sub');
fadeUp('.field-group', { stagger: 0.11 });
fadeUp('#submit-btn',  { duration: 0.8 });

/* ── Form submit → Netlify Forms ─────────────────────── */
document.getElementById('submit-btn')?.addEventListener('click', () => {
  const nameEl  = document.getElementById('name');
  const phoneEl = document.getElementById('phone');
  const btn     = document.getElementById('submit-btn');
  const label   = document.getElementById('submit-label');
  const success = document.getElementById('form-success');

  let valid = true;
  [nameEl, phoneEl].forEach(f => {
    if (!f.value.trim()) {
      f.style.borderColor = '#b33';
      f.focus();
      setTimeout(() => { f.style.borderColor = ''; }, 1800);
      valid = false;
    }
  });
  if (!valid) return;

  btn.disabled = true;
  label.textContent = 'שולחת…';

  const formData = new URLSearchParams({
    'form-name': 'contact',
    name:     nameEl.value.trim(),
    phone:    phoneEl.value.trim(),
    business: document.getElementById('business')?.value.trim() || '',
  });

  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })
  .then(() => {
    btn.style.display = 'none';
    success.hidden = false;
    if (!reduced) gsap.fromTo(success, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 });
  })
  .catch(() => {
    btn.disabled = false;
    label.textContent = 'שגיאה, נסי שוב';
  });
});

/* ── Back to top ─────────────────────────────────────── */
document.getElementById('back-to-top')?.addEventListener('click', () => {
  if (lenis) lenis.scrollTo(0, { duration: 1.5, easing: t => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
});
