/* ══ V1 — Dark Studio ══════════════════════════════════════ */

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

/* ── Three.js floating social-icon cluster ──────────────── */
(function initSocialIcons() {
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

  /* Warm gold studio lighting — no env map needed, just gives the tiles
     a touch of unified ambient tint consistent with the rest of the page */
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

  // Shift cluster toward left side of screen (reading-end in RTL) — same spot the lens used
  const iconGroup = new THREE.Group();
  const ICON_BASE_X = -1.2;
  const ICON_BASE_Y = 0;
  const ICON_SCALE  = 0.62;
  iconGroup.position.set(ICON_BASE_X, ICON_BASE_Y, 0);
  iconGroup.scale.setScalar(ICON_SCALE);
  scene.add(iconGroup);

  /* ── Icon tile textures — drawn once on an offscreen canvas, not per frame ── */
  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  function createIconTexture(spec) {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const r = s * 0.22;

    // Soft drop shadow baked under the tile for a believable "keycap" lift
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = s * 0.10;
    ctx.shadowOffsetX = s * 0.02;
    ctx.shadowOffsetY = s * 0.05;
    roundedRectPath(ctx, s * 0.06, s * 0.06, s * 0.88, s * 0.88, r);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // Background fill (solid or brand gradient), clipped to the rounded square
    roundedRectPath(ctx, s * 0.06, s * 0.06, s * 0.88, s * 0.88, r);
    ctx.save();
    ctx.clip();
    if (spec.bg.length > 1) {
      const grad = ctx.createLinearGradient(0, 0, s, s);
      spec.bg.forEach((color, i) => grad.addColorStop(i / (spec.bg.length - 1), color));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = spec.bg[0];
    }
    ctx.fillRect(0, 0, s, s);

    // Top-edge sheen (fake bevel highlight)
    const sheen = ctx.createLinearGradient(0, s * 0.06, 0, s * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.3)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s * 0.4);

    spec.glyph(ctx, s);
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  /* Platform glyphs — redrawn by hand as canvas paths in each brand's real
     colors/proportions, since no logo asset files are available to import
     in this static, no-build-step site. */
  const ICON_SPECS = {
    instagram: {
      bg: ['#fdf497', '#fd5949', '#d6249f', '#285AEB'],
      glyph(ctx, s) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = s * 0.045;
        roundedRectPath(ctx, s * 0.27, s * 0.27, s * 0.46, s * 0.46, s * 0.13);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 0.5, s * 0.5, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * 0.63, s * 0.37, s * 0.025, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      },
    },
    facebook: {
      bg: ['#1877F2'],
      glyph(ctx, s) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(0.62 * s, 0.22 * s);
        ctx.lineTo(0.50 * s, 0.22 * s);
        ctx.bezierCurveTo(0.40 * s, 0.22 * s, 0.36 * s, 0.27 * s, 0.36 * s, 0.36 * s);
        ctx.lineTo(0.36 * s, 0.42 * s);
        ctx.lineTo(0.27 * s, 0.42 * s);
        ctx.lineTo(0.27 * s, 0.54 * s);
        ctx.lineTo(0.36 * s, 0.54 * s);
        ctx.lineTo(0.36 * s, 0.80 * s);
        ctx.lineTo(0.50 * s, 0.80 * s);
        ctx.lineTo(0.50 * s, 0.54 * s);
        ctx.lineTo(0.61 * s, 0.54 * s);
        ctx.lineTo(0.63 * s, 0.42 * s);
        ctx.lineTo(0.50 * s, 0.42 * s);
        ctx.lineTo(0.50 * s, 0.37 * s);
        ctx.bezierCurveTo(0.50 * s, 0.33 * s, 0.52 * s, 0.31 * s, 0.56 * s, 0.31 * s);
        ctx.lineTo(0.62 * s, 0.31 * s);
        ctx.closePath();
        ctx.fill();
      },
    },
    tiktok: {
      bg: ['#000000'],
      glyph(ctx, s) {
        function note(ox, oy, color) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(0.42 * s + ox, 0.64 * s + oy, 0.10 * s, 0, Math.PI * 2);
          ctx.moveTo(0.50 * s + ox, 0.22 * s + oy);
          ctx.lineTo(0.50 * s + ox, 0.64 * s + oy);
          ctx.lineTo(0.40 * s + ox, 0.64 * s + oy);
          ctx.lineTo(0.40 * s + ox, 0.30 * s + oy);
          ctx.bezierCurveTo(0.50 * s + ox, 0.30 * s + oy, 0.60 * s + ox, 0.30 * s + oy, 0.68 * s + ox, 0.40 * s + oy);
          ctx.lineTo(0.68 * s + ox, 0.30 * s + oy);
          ctx.bezierCurveTo(0.60 * s + ox, 0.24 * s + oy, 0.55 * s + ox, 0.22 * s + oy, 0.50 * s + ox, 0.22 * s + oy);
          ctx.closePath();
          ctx.fill();
        }
        note(-s * 0.025, s * 0.018, '#25F4EE');
        note(s * 0.025, -s * 0.018, '#FE2C55');
        note(0, 0, '#ffffff');
      },
    },
    youtube: {
      bg: ['#FF0000'],
      glyph(ctx, s) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(0.42 * s, 0.34 * s);
        ctx.lineTo(0.42 * s, 0.66 * s);
        ctx.lineTo(0.66 * s, 0.5 * s);
        ctx.closePath();
        ctx.fill();
      },
    },
    x: {
      bg: ['#000000'],
      glyph(ctx, s) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0.30 * s, 0.28 * s); ctx.lineTo(0.70 * s, 0.72 * s);
        ctx.moveTo(0.70 * s, 0.28 * s); ctx.lineTo(0.30 * s, 0.72 * s);
        ctx.stroke();
      },
    },
  };

  /* Loose overlapping scatter, same footprint the lens occupied */
  const ICON_LAYOUT = [
    { key: 'instagram', x:  0.00, y:  0.45, z:  0.30, rot:  0.10, size: 1.25 },
    { key: 'facebook',  x: -0.85, y: -0.10, z:  0.05, rot: -0.16, size: 1.05 },
    { key: 'youtube',   x:  0.70, y: -0.15, z:  0.45, rot:  0.20, size: 0.95 },
    { key: 'tiktok',    x: -0.35, y: -0.65, z: -0.05, rot: -0.10, size: 1.05 },
    { key: 'x',         x:  0.45, y:  0.70, z: -0.20, rot: -0.22, size: 0.85 },
  ];

  const icons = [];
  ICON_LAYOUT.forEach(def => {
    const tex = createIconTexture(ICON_SPECS[def.key]);
    const geo = new THREE.PlaneGeometry(def.size, def.size);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, alphaTest: 0.02,
      roughness: 0.55, metalness: 0, side: THREE.DoubleSide,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(def.x, def.y, def.z);
    mesh.rotation.z = def.rot;
    mesh.userData.baseRot = def.rot;
    mesh.userData.baseZ = def.z;
    mesh.userData.depthFactor = 0.4 + ((def.z + 0.2) / 0.65) * 0.6;
    mesh.userData.phase = Math.random() * Math.PI * 2;
    iconGroup.add(mesh);
    icons.push(mesh);
  });

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

  /* Scroll through the hero drives the cluster position/scale/rotation.
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

  /* Project the cluster's world position to screen space for the glow overlay */
  const flareEl  = document.getElementById('lens-flare');
  const projVec  = new THREE.Vector3();

  const clock = new THREE.Clock();
  (function tick() {
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    const scrollProgress = getHeroScrollProgress();

    // Idle ambient drift — keeps the cluster alive on touch devices with no pointer events
    const idleX = Math.sin(t * 0.35) * 0.16;
    const idleY = Math.cos(t * 0.28) * 0.1;

    tx += (mx * 0.5 - tx) * 0.045;
    ty += (my * 0.4  - ty) * 0.045;
    iconGroup.rotation.y = tx + idleX;
    iconGroup.rotation.x = ty + idleY;
    iconGroup.rotation.z = scrollProgress * 0.3;
    iconGroup.position.y = ICON_BASE_Y - scrollProgress * 1.35;
    iconGroup.position.x = ICON_BASE_X + scrollProgress * 0.25;
    iconGroup.scale.setScalar(ICON_SCALE * (1 - scrollProgress * 0.18));

    // Per-tile depth-based parallax + phase-staggered idle bob, so the
    // cluster reads as layered tiles rather than one rigid flat plane
    icons.forEach(mesh => {
      const df = mesh.userData.depthFactor;
      mesh.rotation.x = ty * 0.6 * df;
      mesh.rotation.y = tx * 0.6 * df;
      mesh.position.z = mesh.userData.baseZ + Math.sin(t * 0.6 + mesh.userData.phase) * 0.04 * df;
      mesh.rotation.z = mesh.userData.baseRot + Math.sin(t * 0.4 + mesh.userData.phase) * 0.04;
    });

    rimLight.position.x = Math.sin(t * 0.3) * 1.5;
    fillLight.intensity = 1.2 + Math.sin(t * 0.8) * 0.2;

    renderer.render(scene, camera);

    if (flareEl) {
      projVec.copy(iconGroup.position);
      projVec.project(camera);
      const sx = (projVec.x * 0.5 + 0.5) * canvas.clientWidth;
      const sy = (-projVec.y * 0.5 + 0.5) * canvas.clientHeight;
      flareEl.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      flareEl.style.opacity = String((1 - scrollProgress * 1.3) * 0.8);
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
