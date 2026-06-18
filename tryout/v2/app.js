/* ══ V2 — Light Studio (same behavior as V1, light palette via CSS) ══ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Lenis ─────────────────────────────────────────────── */
let lenis;
if (!reduced) {
  lenis = new Lenis({ duration: 1.25, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothTouch: false });
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
gsap.registerPlugin(ScrollTrigger);
if (lenis) lenis.on('scroll', ScrollTrigger.update);

/* ── Ticker — JS-driven marquee, wraps on the live measured width ──
   A CSS keyframe loop can drift out of sync with a precomputed duration
   (e.g. once the webfont swaps in and re-flows the text), leaving a visible
   blank gap at the seam. Driving the transform every frame and wrapping on
   the *live* scrollWidth makes a gap mathematically impossible. ─────────── */
(function initTicker() {
  const wrap  = document.querySelector('.ticker');
  const track = document.getElementById('ticker-track');
  const unit  = track?.querySelector('.ticker__unit');
  if (!wrap || !track || !unit) return;

  let half = 0;
  let offset = 0;
  let paused = false;

  function build() {
    track.style.transform = 'translateX(0px)';
    track.innerHTML = '';
    track.appendChild(unit.cloneNode(true));

    const viewportW = window.innerWidth;
    // Clone the unit until one "half" is wider than the viewport, so the
    // wrap point is always further away than what's visible on screen.
    while (track.scrollWidth < viewportW) {
      track.appendChild(unit.cloneNode(true));
    }
    half = track.scrollWidth;

    // Duplicate that whole half once more — two identical halves back to back.
    Array.from(track.children).forEach(child => track.appendChild(child.cloneNode(true)));
    offset = 0;
  }

  build();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 200);
  });
  // Re-measure once the real webfont swaps in — fallback-font metrics can
  // differ enough to leave the precomputed width stale.
  if (document.fonts?.ready) document.fonts.ready.then(build);

  wrap.addEventListener('mouseenter', () => { paused = true; });
  wrap.addEventListener('mouseleave', () => { paused = false; });

  if (reduced) return;

  const PX_PER_SEC = 70;
  let last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused || !half) return;
    offset -= PX_PER_SEC * dt;
    if (offset <= -half) offset += half; // wraps against the live width — never blank
    track.style.transform = `translateX(${offset}px)`;
  })(last);
})();

/* ── Custom cursor ─────────────────────────────────────── */
const cursorDot  = document.getElementById('cursor');
const cursorRing = document.getElementById('cursor-ring');
let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
let rx = cx, ry = cy;

if (cursorDot && !('ontouchstart' in window)) {
  window.addEventListener('mousemove', e => {
    cx = e.clientX; cy = e.clientY;
    cursorDot.style.left = cx + 'px';
    cursorDot.style.top  = cy + 'px';
  });

  gsap.ticker.add(() => {
    rx += (cx - rx) * 0.11;
    ry += (cy - ry) * 0.11;
    cursorRing.style.left = rx + 'px';
    cursorRing.style.top  = ry + 'px';
  });

  document.querySelectorAll('a, button, .magnetic').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursorDot.classList.add('is-hover');
      cursorRing.classList.add('is-hover');
    });
    el.addEventListener('mouseleave', () => {
      cursorDot.classList.remove('is-hover');
      cursorRing.classList.remove('is-hover');
    });
  });
}

/* ── Three.js camera lens — small, unmistakable corner accent ──
   Earlier lens attempts read as ambiguous/flower-like because of busy
   animated iris blades. This version drops the blades entirely and leans
   on cues that read instantly as "camera lens": concentric metal rings,
   a glass front element with a real specular highlight, and printed
   focus-distance tick marks baked onto a ring texture — printed engravings
   are a far stronger "this is a lens" signal than blade geometry was. ── */
(function initLens() {
  const canvas = document.getElementById('blob');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  /* Warm gold studio lighting — no env map needed for the metal/glass look */
  scene.add(new THREE.AmbientLight(0x4a3520, 1.6));
  const keyLight = new THREE.DirectionalLight(0xfff1d8, 2.4);
  keyLight.position.set(2.5, 3, 4);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xc4985a, 3.2, 14);
  rimLight.position.set(-3, -1.5, 2.5);
  scene.add(rimLight);
  const fillLight = new THREE.PointLight(0xffe8c0, 1.4, 14);
  fillLight.position.set(0, 0.5, 4);
  scene.add(fillLight);

  // Small corner accent now — the hero's main visual is the photo placeholder
  const lensGroup = new THREE.Group();
  const LENS_BASE_X = -1.7;
  const LENS_BASE_Y = -0.85;
  const LENS_SCALE  = 0.34;
  lensGroup.position.set(LENS_BASE_X, LENS_BASE_Y, 0);
  lensGroup.scale.setScalar(LENS_SCALE);
  scene.add(lensGroup);

  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x4a3318, metalness: 1, roughness: 0.32, emissive: 0x1a1006, emissiveIntensity: 0.1 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xF3E7CF, metalness: 0.5, roughness: 0.22 });
  const glassMat  = new THREE.MeshPhysicalMaterial({
    color: 0x0a0e16, metalness: 0.05, roughness: 0.06,
    iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 380],
    clearcoat: 1, clearcoatRoughness: 0.08,
    transparent: true, opacity: 0.55,
  });

  /* Thick dark-gold barrel — the dominant "lens body" shape */
  const barrel = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.24, 28, 96), barrelMat);
  lensGroup.add(barrel);

  /* Thin pale brand ring */
  const accentRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 16, 96), accentMat);
  lensGroup.add(accentRing);

  /* Printed focus-distance tick marks, baked onto a flat ring texture —
     this single detail reads as "camera lens" far more reliably than blades */
  function createFocusRingTexture() {
    const w = 1024, h = 96;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(243,231,207,0.95)';
    ctx.fillStyle = 'rgba(243,231,207,0.95)';
    ctx.lineWidth = 3;
    ctx.font = '600 30px Heebo, sans-serif';
    ctx.textAlign = 'center';
    const marks = ['24', '28', '35', '50', '85', '135'];
    const step = w / marks.length;
    marks.forEach((label, i) => {
      const x = step * i + step / 2;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.15);
      ctx.lineTo(x, h * 0.55);
      ctx.stroke();
      ctx.fillText(label, x, h * 0.92);
      // small ticks between numbers
      for (let j = 1; j < 4; j++) {
        const tx2 = x - step / 2 + (step / 4) * j;
        ctx.beginPath();
        ctx.moveTo(tx2, h * 0.15);
        ctx.lineTo(tx2, h * 0.32);
        ctx.stroke();
      }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const focusRing = new THREE.Mesh(
    new THREE.RingGeometry(1.58, 1.7, 96),
    new THREE.MeshStandardMaterial({
      map: createFocusRingTexture(), transparent: true, alphaTest: 0.05,
      metalness: 0.2, roughness: 0.4, side: THREE.DoubleSide,
    })
  );
  focusRing.position.z = 0.01;
  lensGroup.add(focusRing);

  /* Glass front element with a real specular highlight */
  const glass = new THREE.Mesh(new THREE.CircleGeometry(1.42, 72), glassMat);
  glass.position.z = 0.08;
  lensGroup.add(glass);

  /* Pointer drives tilt (parallax) — mouse AND touch */
  let mx = 0, my = 0, tx = 0, ty = 0;
  function updatePointer(clientX, clientY) {
    mx = (clientX / window.innerWidth  - 0.5) * 2;
    my = -(clientY / window.innerHeight - 0.5) * 1.5;
  }
  window.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY));
  window.addEventListener('touchmove', e => {
    if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  /* Scroll through the hero drives the lens position/scale/rotation.
     Read getBoundingClientRect() directly every frame instead of going through
     ScrollTrigger's scrub callback — on touch devices Lenis doesn't smooth/
     report native scroll the same way, so the scrub callback can silently
     stop firing on mobile. A direct rect read works identically everywhere. */
  const heroEl = document.getElementById('hero');
  function getHeroScrollProgress() {
    if (!heroEl) return 0;
    const rect = heroEl.getBoundingClientRect();
    return Math.min(1, Math.max(0, -rect.top / rect.height));
  }

  /* Project the lens' world position to screen space for the glow overlay */
  const flareEl  = document.getElementById('lens-flare');
  const projVec  = new THREE.Vector3();

  const clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    const scrollProgress = getHeroScrollProgress();

    // Idle ambient drift — keeps the lens alive on touch devices with no pointer events
    const idleX = Math.sin(t * 0.35) * 0.14;
    const idleY = Math.cos(t * 0.28) * 0.09;

    tx += (mx * 0.5 - tx) * 0.045;
    ty += (my * 0.4  - ty) * 0.045;
    lensGroup.rotation.y = tx + idleX;
    lensGroup.rotation.x = ty + idleY;
    lensGroup.rotation.z = scrollProgress * 0.3;
    lensGroup.position.y = LENS_BASE_Y - scrollProgress * 1.1;
    lensGroup.position.x = LENS_BASE_X + scrollProgress * 0.2;
    lensGroup.scale.setScalar(LENS_SCALE * (1 - scrollProgress * 0.18));

    rimLight.position.x = Math.sin(t * 0.3) * 1.5;
    fillLight.intensity = 1.2 + Math.sin(t * 0.8) * 0.2;

    renderer.render(scene, camera);

    if (flareEl) {
      projVec.copy(lensGroup.position);
      projVec.project(camera);
      const sx = (projVec.x * 0.5 + 0.5) * canvas.clientWidth;
      const sy = (-projVec.y * 0.5 + 0.5) * canvas.clientHeight;
      flareEl.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      flareEl.style.opacity = String((1 - scrollProgress * 1.3) * 0.6);
    }
  })();
})();

/* ── Hero entrance ─────────────────────────────────────── */
if (!reduced) {
  const tl = gsap.timeline({ delay: 0.1 });

  tl.to('.hero__eyebrow', { opacity: 1, duration: 0.7 });

  document.querySelectorAll('.title-line').forEach((line, i) => {
    const inner = document.createElement('span');
    inner.className = 'title-line__inner';
    inner.innerHTML = line.innerHTML;
    line.innerHTML = '';
    line.appendChild(inner);
    tl.to(inner, { y: '0%', duration: 1.1, ease: 'power3.out' }, i === 0 ? '-=0.45' : '-=0.85');
  });

  tl.to('.hero__sub',    { opacity: 1, duration: 0.8 }, '-=0.6')
    .to('.hero__cta',    { opacity: 1, duration: 0.7 }, '-=0.5')
    .to('.hero__scroll', { opacity: 1, duration: 0.6 }, '-=0.3');
} else {
  gsap.set(['.hero__eyebrow','.hero__sub','.hero__cta','.hero__scroll'], { opacity: 1 });
  document.querySelectorAll('.title-line').forEach(line => {
    const inner = document.createElement('span');
    inner.innerHTML = line.innerHTML;
    line.innerHTML = '';
    line.appendChild(inner);
  });
}

/* ── Scroll-driven golden background glow ───────────────── */
(function initBgFlare() {
  const bgFlare = document.getElementById('bg-flare');
  if (!bgFlare || reduced) return;

  // Read window.scrollY directly every frame instead of ScrollTrigger.scrub —
  // robust on touch devices regardless of how Lenis reports scroll there.
  function update() {
    requestAnimationFrame(update);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bgFlare.style.setProperty('--flare-y', `${8 + p * 80}%`);
    bgFlare.style.setProperty('--flare-rot', `${p * 140}deg`);
    bgFlare.style.opacity = String(0.45 + p * 0.5);
  }
  update();
})();

/* ── Nav reveal on scroll ──────────────────────────────── */
const nav = document.getElementById('nav');
ScrollTrigger.create({
  trigger: '#about', start: 'top 85%',
  onEnter:     () => nav?.classList.add('is-visible'),
  onLeaveBack: () => nav?.classList.remove('is-visible'),
});

/* ── Mobile nav hamburger ────────────────────────────────── */
(function initMobileNav() {
  const burger = document.getElementById('nav-burger');
  const mobile = document.getElementById('nav-mobile');
  if (!burger || !mobile) return;

  function close() {
    mobile.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  }
  function toggle() {
    const open = mobile.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  }

  burger.addEventListener('click', toggle);
  mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('click', e => {
    if (!mobile.classList.contains('is-open')) return;
    if (!mobile.contains(e.target) && !burger.contains(e.target)) close();
  });
})();

/* ── Scroll reveals ─────────────────────────────────────── */
function reveal(targets, opts = {}) {
  if (reduced) return;
  const { y = 35, duration = 0.9, stagger = 0.1, start = 'top 88%' } = opts;
  gsap.utils.toArray(targets).forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, ease: 'power3.out', delay: stagger * i,
        scrollTrigger: { trigger: el, start, toggleActions: 'play none none none' } }
    );
  });
}

reveal('.about__label');
reveal('.about__quote',  { duration: 1.1 });
reveal('.about__body',   { duration: 0.9 });

if (!reduced) {
  gsap.fromTo('.about__rule',
    { scaleX: 0 },
    { scaleX: 1, duration: 1.1, ease: 'power2.inOut', transformOrigin: 'right center',
      scrollTrigger: { trigger: '.about__rule', start: 'top 90%' } }
  );
}

reveal('.section-label', { y: 20, stagger: 0 });
reveal('.section-title', { y: 40, duration: 1.0 });

/* ── Program cards — 3D tilt on hover ─────────────────── */
document.querySelectorAll('.prog-card').forEach((card, i) => {
  if (!reduced) {
    gsap.fromTo(card,
      { opacity: 0, y: 55 },
      { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out',
        delay: i * 0.12,
        scrollTrigger: { trigger: card, start: 'top 86%', toggleActions: 'play none none none' } }
    );
  } else {
    card.style.opacity = 1;
    card.style.transform = 'none';
  }

  const shine = card.querySelector('.card__shine');

  function applyTilt(clientX, clientY) {
    const r = card.getBoundingClientRect();
    const x = (clientX - r.left) / r.width  - 0.5;
    const y = (clientY - r.top)  / r.height - 0.5;
    gsap.to(card, { rotateY: x * 18, rotateX: -y * 13, scale: 1.025, duration: 0.45, overwrite: 'auto' });
    if (shine) {
      shine.style.opacity = '1';
      shine.style.background = `radial-gradient(circle at ${(x+0.5)*100}% ${(y+0.5)*100}%, rgba(196,152,90,0.22), transparent 58%)`;
    }
  }
  function resetTilt() {
    gsap.to(card, { rotateY: 0, rotateX: 0, scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
    if (shine) shine.style.opacity = '0';
  }

  if ('ontouchstart' in window) {
    // Same tilt+shine effect, driven by touch position instead of the mouse
    card.addEventListener('touchstart', e => {
      if (e.touches[0]) applyTilt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    card.addEventListener('touchmove', e => {
      if (e.touches[0]) applyTilt(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    card.addEventListener('touchend', resetTilt);
    card.addEventListener('touchcancel', resetTilt);
  } else {
    card.addEventListener('mousemove', e => applyTilt(e.clientX, e.clientY));
    card.addEventListener('mouseleave', resetTilt);
  }
});

/* ── Magnetic buttons ──────────────────────────────────── */
document.querySelectorAll('.magnetic').forEach(btn => {
  if ('ontouchstart' in window) return;
  btn.addEventListener('mousemove', e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width  / 2;
    const y = e.clientY - r.top  - r.height / 2;
    gsap.to(btn, { x: x * 0.22, y: y * 0.18, duration: 0.45 });
  });
  btn.addEventListener('mouseleave', () => {
    gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.35)' });
  });
});

/* ── Stat counters ─────────────────────────────────────── */
document.querySelectorAll('.stat__num').forEach(el => {
  const target = parseInt(el.dataset.count, 10);
  ScrollTrigger.create({
    trigger: el, start: 'top 85%', once: true,
    onEnter: () => {
      gsap.fromTo(el,
        { innerText: 0 },
        { innerText: target, duration: 1.8, ease: 'power2.out',
          snap: { innerText: 1 },
          onUpdate() { el.innerText = Math.round(parseFloat(el.innerText)); }
        }
      );
    }
  });
});

/* ── Why section ───────────────────────────────────────── */
reveal('.why__quote', { duration: 1.1 });
if (!reduced) {
  gsap.fromTo('.why__line',
    { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power2.inOut', transformOrigin: 'right center',
      scrollTrigger: { trigger: '.why__line', start: 'top 88%' } }
  );
}
reveal('.why__stat', { stagger: 0.15 });

/* ── Form ──────────────────────────────────────────────── */
reveal('.form-inner .section-label');
reveal('.form-inner .section-title');
reveal('.form-sub');
reveal('.field', { stagger: 0.1 });

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

  fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() })
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

/* ── Anchor nav ────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

document.getElementById('back-top')?.addEventListener('click', () => {
  if (lenis) lenis.scrollTo(0, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
});
