// =============================================
// ExplainLikeMyTeacher Landing Page — script.js
// =============================================

// ===== COLOR BENDS SHADER (ported from React Bits) =====
const MAX_COLORS = 8;

const fragShader = `
#define MAX_COLORS ${MAX_COLORS}
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[MAX_COLORS];
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer;
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
uniform int uIterations;
uniform float uIntensity;
uniform float uBandWidth;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;

  for (int j = 0; j < 5; j++) {
    if (j >= uIterations - 1) break;
    vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
    q += (rr - q) * 0.15;
  }

  vec3 col = vec3(0.0);
  float a = 1.0;

  if (uColorCount > 0) {
    vec2 s = q;
    vec3 sumCol = vec3(0.0);
    float cover = 0.0;
    for (int i = 0; i < MAX_COLORS; ++i) {
      if (i >= uColorCount) break;
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float m = mix(m0, m1, kMix);
      float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
      sumCol += uColors[i] * w;
      cover = max(cover, w);
    }
    col = clamp(sumCol, 0.0, 1.0);
    a = uTransparent > 0 ? cover : 1.0;
  } else {
    vec2 s = q;
    for (int k = 0; k < 3; ++k) {
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float m = mix(m0, m1, kMix);
      col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
    }
    a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
  }

  col *= uIntensity;

  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);
  }

  vec3 rgb = (uTransparent > 0) ? col * a : col;
  gl_FragColor = vec4(rgb, a);
}
`;

const vertShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

function initColorBends(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || typeof THREE === 'undefined') return null;

    const config = {
        colors: ['#7c5cfc', '#00c8ff', '#ff6bca'],
        rotation: 90,
        speed: 0.2,
        scale: 1,
        frequency: 1,
        warpStrength: 1,
        mouseInfluence: 1,
        noise: 0.15,
        parallax: 0.5,
        iterations: 1,
        intensity: 1.5,
        bandWidth: 6,
        transparent: true,
        ...options
    };

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const uColorsArray = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));

    // Parse hex colors
    const parsedColors = config.colors.filter(Boolean).slice(0, MAX_COLORS).map(hex => {
        const h = hex.replace('#', '').trim();
        const v = h.length === 3
            ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
            : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
        return new THREE.Vector3(v[0] / 255, v[1] / 255, v[2] / 255);
    });

    parsedColors.forEach((c, i) => uColorsArray[i].copy(c));

    const rad = (config.rotation * Math.PI) / 180;

    const material = new THREE.ShaderMaterial({
        vertexShader: vertShader,
        fragmentShader: fragShader,
        uniforms: {
            uCanvas: { value: new THREE.Vector2(1, 1) },
            uTime: { value: 0 },
            uSpeed: { value: config.speed },
            uRot: { value: new THREE.Vector2(Math.cos(rad), Math.sin(rad)) },
            uColorCount: { value: parsedColors.length },
            uColors: { value: uColorsArray },
            uTransparent: { value: config.transparent ? 1 : 0 },
            uScale: { value: config.scale },
            uFrequency: { value: config.frequency },
            uWarpStrength: { value: config.warpStrength },
            uPointer: { value: new THREE.Vector2(0, 0) },
            uMouseInfluence: { value: config.mouseInfluence },
            uParallax: { value: config.parallax },
            uNoise: { value: config.noise },
            uIterations: { value: config.iterations },
            uIntensity: { value: config.intensity },
            uBandWidth: { value: config.bandWidth }
        },
        premultipliedAlpha: true,
        transparent: true
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'high-performance',
        alpha: true
    });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, config.transparent ? 0 : 1);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const pointerTarget = new THREE.Vector2(0, 0);
    const pointerCurrent = new THREE.Vector2(0, 0);

    function handleResize() {
        const w = container.clientWidth || 1;
        const h = container.clientHeight || 1;
        renderer.setSize(w, h, false);
        material.uniforms.uCanvas.value.set(w, h);
    }

    handleResize();

    if ('ResizeObserver' in window) {
        new ResizeObserver(handleResize).observe(container);
    } else {
        window.addEventListener('resize', handleResize);
    }

    container.addEventListener('pointermove', (e) => {
        const rect = container.getBoundingClientRect();
        pointerTarget.set(
            ((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1,
            -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1)
        );
    });

    let rafId;
    function loop() {
        const dt = clock.getDelta();
        const elapsed = clock.elapsedTime;
        material.uniforms.uTime.value = elapsed;

        const deg = config.rotation % 360;
        const r = (deg * Math.PI) / 180;
        material.uniforms.uRot.value.set(Math.cos(r), Math.sin(r));

        const amt = Math.min(1, dt * 8);
        pointerCurrent.lerp(pointerTarget, amt);
        material.uniforms.uPointer.value.copy(pointerCurrent);

        renderer.render(scene, camera);
        rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return { renderer, material, destroy: () => cancelAnimationFrame(rafId) };
}


// ===== SCROLL ANIMATIONS (Intersection Observer) =====
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                // Stagger siblings a bit
                const parent = entry.target.parentElement;
                const siblings = parent ? Array.from(parent.querySelectorAll('.animate-on-scroll')) : [];
                const idx = siblings.indexOf(entry.target);
                const delay = idx >= 0 ? idx * 80 : 0;

                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, delay);

                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}


// ===== NAVBAR SCROLL EFFECT =====
function initNavbar() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const current = window.scrollY;
        if (current > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = current;
    }, { passive: true });
}


// ===== MOBILE MENU =====
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        menu.style.display = 'flex';
        // Trigger reflow for animation
        requestAnimationFrame(() => {
            menu.classList.toggle('open');
        });
    });

    // Close on link click
    menu.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            btn.classList.remove('active');
            menu.classList.remove('open');
            setTimeout(() => { menu.style.display = 'none'; }, 300);
        });
    });
}


// ===== COUNTER ANIMATION =====
function initCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.getAttribute('data-count'), 10);
                animateCounter(el, target);
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(c => observer.observe(c));
}

function animateCounter(el, target) {
    const duration = 1500;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}


// ===== SMOOTH SCROLL FOR NAV LINKS =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const id = link.getAttribute('href');
            if (id === '#') return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}


// ===== CHROMA GRID EFFECT =====
function initChromaGrid(containerId, options = {}) {
    const root = document.getElementById(containerId);
    if (!root || typeof gsap === 'undefined') return;

    const config = {
        damping: 0.45,
        fadeOut: 0.6,
        ease: 'power3.out',
        ...options
    };

    const fadeEl = root.querySelector('.chroma-fade');
    const pos = { x: 0, y: 0 };

    // Initialize position to center
    const rect = root.getBoundingClientRect();
    pos.x = rect.width / 2;
    pos.y = rect.height / 2;
    root.style.setProperty('--x', pos.x + 'px');
    root.style.setProperty('--y', pos.y + 'px');

    // Use GSAP quickSetter for performance
    const setX = gsap.quickSetter(root, '--x', 'px');
    const setY = gsap.quickSetter(root, '--y', 'px');
    setX(pos.x);
    setY(pos.y);

    function moveTo(x, y) {
        gsap.to(pos, {
            x, y,
            duration: config.damping,
            ease: config.ease,
            onUpdate: () => {
                setX(pos.x);
                setY(pos.y);
            },
            overwrite: true
        });
    }

    root.addEventListener('pointermove', (e) => {
        const r = root.getBoundingClientRect();
        moveTo(e.clientX - r.left, e.clientY - r.top);
        gsap.to(fadeEl, { opacity: 0, duration: 0.25, overwrite: true });
    });

    root.addEventListener('pointerleave', () => {
        gsap.to(fadeEl, { opacity: 1, duration: config.fadeOut, overwrite: true });
    });

    // Per-card spotlight
    root.querySelectorAll('.chroma-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const cr = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', (e.clientX - cr.left) + 'px');
            card.style.setProperty('--mouse-y', (e.clientY - cr.top) + 'px');
        });
    });
}


// ===== CARD STACK EFFECT =====
function initStack(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const config = {
        sensitivity: 200,
        autoplay: true,
        autoplayDelay: 3500,
        pauseOnHover: true,
        ...options
    };

    const cardEls = Array.from(container.querySelectorAll('.stack-card'));
    // Stack order: last in array = on top (visible)
    let stack = cardEls.map((el, i) => ({ id: i, el }));
    let isPaused = false;

    function updatePositions() {
        const total = stack.length;
        stack.forEach((card, index) => {
            const fromTop = total - 1 - index; // 0 = top card
            const rotation = fromTop * 4;
            const scale = 1 - fromTop * 0.06;
            card.el.style.zIndex = index;
            card.el.style.transform = `rotateZ(${rotation}deg) scale(${scale})`;
        });
    }

    function sendToBack(id) {
        const idx = stack.findIndex(c => c.id === id);
        if (idx < 0) return;
        const [card] = stack.splice(idx, 1);
        stack.unshift(card);
        updatePositions();
    }

    // Drag handling
    cardEls.forEach((el, originalIdx) => {
        let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;

        function onPointerDown(e) {
            // Only drag the top card
            const topCard = stack[stack.length - 1];
            if (topCard.el !== el) {
                // Click to send to back if not top
                sendToBack(originalIdx);
                return;
            }
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            el.classList.add('dragging');
            e.preventDefault();
        }

        function onPointerMove(e) {
            if (!dragging) return;
            dx = e.clientX - startX;
            dy = e.clientY - startY;
            // Apply drag offset with slight 3D rotation
            const rotX = (dy / 5).toFixed(1);
            const rotY = (-dx / 5).toFixed(1);
            el.style.transform = `translate(${dx}px, ${dy}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }

        function onPointerUp() {
            if (!dragging) return;
            dragging = false;
            el.classList.remove('dragging');

            if (Math.abs(dx) > config.sensitivity || Math.abs(dy) > config.sensitivity) {
                sendToBack(originalIdx);
            } else {
                // If barely dragged, treat as click
                if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
                    sendToBack(originalIdx);
                }
                updatePositions();
            }
            dx = 0;
            dy = 0;
        }

        el.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    });

    // Hover pause
    if (config.pauseOnHover) {
        container.addEventListener('mouseenter', () => { isPaused = true; });
        container.addEventListener('mouseleave', () => { isPaused = false; });
    }

    // Autoplay
    if (config.autoplay) {
        setInterval(() => {
            if (!isPaused && stack.length > 1) {
                const topId = stack[stack.length - 1].id;
                sendToBack(topId);
            }
        }, config.autoplayDelay);
    }

    updatePositions();
}


// ===== CLICK SPARK EFFECT =====
function initClickSpark(options = {}) {
    const config = {
        sparkColor: '#fff',
        sparkSize: 14,       // default 10, bumped +4
        sparkRadius: 19,     // default 15, bumped +4
        sparkCount: 8,
        duration: 400,
        easing: 'ease-out',
        extraScale: 1.0,
        ...options
    };

    const canvas = document.createElement('canvas');
    canvas.id = 'click-spark-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let sparks = [];

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function ease(t) {
        switch (config.easing) {
            case 'linear': return t;
            case 'ease-in': return t * t;
            case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            default: return t * (2 - t); // ease-out
        }
    }

    function draw(timestamp) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        sparks = sparks.filter(spark => {
            const elapsed = timestamp - spark.startTime;
            if (elapsed >= config.duration) return false;

            const progress = elapsed / config.duration;
            const eased = ease(progress);
            const distance = eased * config.sparkRadius * config.extraScale;
            const lineLength = config.sparkSize * (1 - eased);

            const x1 = spark.x + distance * Math.cos(spark.angle);
            const y1 = spark.y + distance * Math.sin(spark.angle);
            const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
            const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

            ctx.strokeStyle = config.sparkColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return true;
        });

        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    document.addEventListener('click', (e) => {
        const now = performance.now();
        for (let i = 0; i < config.sparkCount; i++) {
            sparks.push({
                x: e.clientX,
                y: e.clientY,
                angle: (2 * Math.PI * i) / config.sparkCount,
                startTime: now
            });
        }
    });
}


// ===== INFINITE MENU (3D GLOBE) =====
function initInfiniteMenu(canvasId, items) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof mat4 === 'undefined') return;

    // gl-matrix v2.x: mat4, vec3, quat, vec2 are top-level globals
    const SPHERE_RADIUS = 2;
    const TARGET_FRAME_DURATION = 1000 / 60;

    // ---- SHADERS ----
    const discVert = `#version 300 es
uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec4 uRotationAxisVelocity;
in vec3 aModelPosition;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;
out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;
void main() {
    vec4 wp = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);
    vec3 cp = (uWorldMatrix * aInstanceMatrix * vec4(0.,0.,0.,1.)).xyz;
    float radius = length(cp.xyz);
    if (gl_VertexID > 0) {
        vec3 ra = uRotationAxisVelocity.xyz;
        float rv = min(.15, uRotationAxisVelocity.w * 15.);
        vec3 sd = normalize(cross(cp, ra));
        vec3 rp = normalize(wp.xyz - cp);
        float s = dot(sd, rp);
        float ia = min(0., abs(s) - 1.);
        s = rv * sign(s) * abs(ia*ia*ia + 1.);
        wp.xyz += sd * s;
    }
    wp.xyz = radius * normalize(wp.xyz);
    gl_Position = uProjectionMatrix * uViewMatrix * wp;
    vAlpha = smoothstep(0.5, 1., normalize(wp.xyz).z) * .9 + .1;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}`;

    const discFrag = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;
out vec4 outColor;
in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;
void main() {
    int idx = vInstanceId % uItemCount;
    int cpr = uAtlasSize;
    int cx = idx % cpr;
    int cy = idx / cpr;
    vec2 cs = vec2(1.0) / vec2(float(cpr));
    vec2 co = vec2(float(cx), float(cy)) * cs;
    vec2 st = vec2(vUvs.x, 1.0 - vUvs.y);
    st = st * cs + co;
    outColor = texture(uTex, st);
    outColor.a *= vAlpha;
}`;

    // ---- GEOMETRY ----
    function makeDiscGeometry(steps, radius) {
        steps = Math.max(4, steps || 48);
        radius = radius || 1;
        const verts = [0, 0, 0], uvs = [0.5, 0.5], indices = [];
        const alpha = (2 * Math.PI) / steps;
        for (let i = 0; i < steps; i++) {
            const x = Math.cos(alpha * i), y = Math.sin(alpha * i);
            verts.push(radius * x, radius * y, 0);
            uvs.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
            if (i > 0) indices.push(0, i, i + 1);
        }
        indices.push(0, steps, 1);
        return { vertices: new Float32Array(verts), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) };
    }

    function makeIcosahedron(subdivisions, radius) {
        const t = Math.sqrt(5) * 0.5 + 0.5;
        let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
        let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
        const cache = {};
        function mid(a, b) {
            const key = a < b ? a + '_' + b : b + '_' + a;
            if (cache[key] !== undefined) return cache[key];
            const va = verts[a], vb = verts[b];
            const ndx = verts.length;
            verts.push([(va[0] + vb[0]) * 0.5, (va[1] + vb[1]) * 0.5, (va[2] + vb[2]) * 0.5]);
            cache[key] = ndx;
            return ndx;
        }
        for (let d = 0; d < (subdivisions || 1); d++) {
            const nf = [];
            faces.forEach(f => {
                const a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]);
                nf.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]);
            });
            faces = nf;
        }
        // Spherize
        return verts.map(v => {
            const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
            return vec3.fromValues(v[0] / len * (radius || 2), v[1] / len * (radius || 2), v[2] / len * (radius || 2));
        });
    }

    // ---- WEBGL HELPERS ----
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
    if (!gl) return;

    function compileShader(src, type) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
        return s;
    }

    function linkProgram(vs, fs) {
        const p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, fs);
        gl.bindAttribLocation(p, 0, 'aModelPosition');
        gl.bindAttribLocation(p, 1, 'aModelUvs');
        gl.bindAttribLocation(p, 2, 'aInstanceMatrix');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
        return p;
    }

    const vs = compileShader(discVert, gl.VERTEX_SHADER);
    const fs = compileShader(discFrag, gl.FRAGMENT_SHADER);
    const program = linkProgram(vs, fs);
    if (!program) return;

    const loc = {
        uWorldMatrix: gl.getUniformLocation(program, 'uWorldMatrix'),
        uViewMatrix: gl.getUniformLocation(program, 'uViewMatrix'),
        uProjectionMatrix: gl.getUniformLocation(program, 'uProjectionMatrix'),
        uRotationAxisVelocity: gl.getUniformLocation(program, 'uRotationAxisVelocity'),
        uTex: gl.getUniformLocation(program, 'uTex'),
        uItemCount: gl.getUniformLocation(program, 'uItemCount'),
        uAtlasSize: gl.getUniformLocation(program, 'uAtlasSize')
    };

    // Disc geometry
    const disc = makeDiscGeometry(48, 1);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.bufferData(gl.ARRAY_BUFFER, disc.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    const uBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uBuf);
    gl.bufferData(gl.ARRAY_BUFFER, disc.uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    const iBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, disc.indices, gl.STATIC_DRAW);

    // Instance positions from icosahedron
    const instancePositions = makeIcosahedron(1, SPHERE_RADIUS);
    const instanceCount = instancePositions.length;
    const matricesArray = new Float32Array(instanceCount * 16);
    const instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, matricesArray.byteLength, gl.DYNAMIC_DRAW);
    for (let j = 0; j < 4; j++) {
        const l = 2 + j;
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 64, j * 16);
        gl.vertexAttribDivisor(l, 1);
    }
    gl.bindVertexArray(null);

    // Atlas texture from items
    const atlasSize = Math.ceil(Math.sqrt(items.length));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const cellSize = 256;
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = atlasSize * cellSize;
    atlasCanvas.height = atlasSize * cellSize;
    const actx = atlasCanvas.getContext('2d');

    // Load logo images and build atlas
    Promise.all(items.map(it => new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
            // Fallback: draw colored circle with text
            const fc = document.createElement('canvas');
            fc.width = cellSize; fc.height = cellSize;
            const fctx = fc.getContext('2d');
            fctx.fillStyle = it.color || '#7c5cfc';
            fctx.beginPath(); fctx.arc(cellSize / 2, cellSize / 2, cellSize / 2, 0, Math.PI * 2); fctx.fill();
            fctx.fillStyle = '#fff';
            fctx.font = 'bold 60px sans-serif';
            fctx.textAlign = 'center';
            fctx.textBaseline = 'middle';
            fctx.fillText(it.title.charAt(0), cellSize / 2, cellSize / 2);
            resolve(fc);
        };
        img.src = it.image;
    }))).then(images => {
        images.forEach((img, i) => {
            const x = (i % atlasSize) * cellSize;
            const y = Math.floor(i / atlasSize) * cellSize;
            // Draw dark circle background
            actx.fillStyle = '#111';
            actx.beginPath();
            actx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2, 0, Math.PI * 2);
            actx.fill();
            // Draw logo centered
            const pad = 40;
            actx.save();
            actx.beginPath();
            actx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2 - 4, 0, Math.PI * 2);
            actx.clip();
            actx.drawImage(img, x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2);
            actx.restore();
        });
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    });

    // Camera
    const camPos = vec3.fromValues(0, 0, 3);
    const viewMat = mat4.create(), projMat = mat4.create(), worldMat = mat4.create(), camMat = mat4.create();

    function updateCamera() {
        mat4.targetTo(camMat, camPos, [0, 0, 0], [0, 1, 0]);
        mat4.invert(viewMat, camMat);
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const h = SPHERE_RADIUS * 0.35;
        const fov = aspect > 1 ? 2 * Math.atan(h / camPos[2]) : 2 * Math.atan(h / aspect / camPos[2]);
        mat4.perspective(projMat, fov, aspect, 0.1, 40);
    }

    // Arcball control
    const orientation = quat.create();
    const pointerRot = quat.create();
    const IDENTITY = quat.create();
    let isDown = false, ptrPos = vec2.create(), prevPtr = vec2.create();
    let rotVel = 0, _rotVel = 0;
    const rotAxis = vec3.fromValues(1, 0, 0);
    const _cq = quat.create();
    const snapDir = vec3.fromValues(0, 0, -1);
    let snapTarget = null;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { vec2.set(ptrPos, e.clientX, e.clientY); vec2.copy(prevPtr, ptrPos); isDown = true; });
    canvas.addEventListener('pointerup', () => { isDown = false; });
    canvas.addEventListener('pointerleave', () => { isDown = false; });
    canvas.addEventListener('pointermove', e => { if (isDown) vec2.set(ptrPos, e.clientX, e.clientY); });

    function project(p) {
        const w = canvas.clientWidth, h = canvas.clientHeight, s = Math.max(w, h) - 1;
        const x = (2 * p[0] - w - 1) / s, y = (2 * p[1] - h - 1) / s;
        const r = 2, xySq = x * x + y * y, rSq = r * r;
        const z = xySq <= rSq / 2 ? Math.sqrt(rSq - xySq) : rSq / Math.sqrt(xySq);
        return vec3.fromValues(-x, y, z);
    }

    function quatFromVecs(a, b, out, af) {
        const axis = vec3.cross(vec3.create(), a, b);
        vec3.normalize(axis, axis);
        const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
        quat.setAxisAngle(out, axis, Math.acos(d) * (af || 1));
    }

    // Active item display
    const titleEl = document.getElementById('im-title');
    const descEl = document.getElementById('im-desc');
    let movementActive = false;

    function setActiveItem(index) {
        const item = items[index % items.length];
        if (titleEl) titleEl.textContent = item.title;
        if (descEl) descEl.textContent = item.description || '';
    }

    function setMoving(v) {
        if (v === movementActive) return;
        movementActive = v;
        const cls = v ? 'inactive' : 'active';
        if (titleEl) { titleEl.className = 'face-title ' + cls; }
        if (descEl) { descEl.className = 'face-description ' + cls; }
    }

    function findNearest() {
        const inv = quat.conjugate(quat.create(), orientation);
        const nt = vec3.transformQuat(vec3.create(), snapDir, inv);
        let maxD = -1, best = 0;
        for (let i = 0; i < instancePositions.length; i++) {
            const d = vec3.dot(nt, instancePositions[i]);
            if (d > maxD) { maxD = d; best = i; }
        }
        return best;
    }

    // Resize
    function resize() {
        const dpr = Math.min(2, window.devicePixelRatio);
        const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        updateCamera();
    }
    resize();
    window.addEventListener('resize', resize);

    // Animation loop
    let prevTime = 0;
    function loop(time) {
        const dt = Math.min(32, time - prevTime);
        prevTime = time;
        const ts = dt / TARGET_FRAME_DURATION + 0.00001;

        // Update arcball
        let snapRot = quat.create();
        if (isDown) {
            const INT = 0.3 * ts, AMP = 5 / ts;
            const mp = vec2.sub(vec2.create(), ptrPos, prevPtr);
            vec2.scale(mp, mp, INT);
            if (vec2.sqrLen(mp) > 0.1) {
                vec2.add(mp, prevPtr, mp);
                const a = vec3.normalize(vec3.create(), project(mp));
                const b = vec3.normalize(vec3.create(), project(prevPtr));
                vec2.copy(prevPtr, mp);
                quatFromVecs(a, b, pointerRot, AMP);
            } else {
                quat.slerp(pointerRot, pointerRot, IDENTITY, INT);
            }
        } else {
            quat.slerp(pointerRot, pointerRot, IDENTITY, 0.1 * ts);
            if (snapTarget) {
                const sd2 = vec3.squaredDistance(snapTarget, snapDir);
                const df = Math.max(0.1, 1 - sd2 * 10);
                quatFromVecs(snapTarget, snapDir, snapRot, 0.2 * df * ts);
            }
        }

        const combined = quat.multiply(quat.create(), snapRot, pointerRot);
        quat.multiply(orientation, combined, orientation);
        quat.normalize(orientation, orientation);

        quat.slerp(_cq, _cq, combined, 0.8 * ts);
        quat.normalize(_cq, _cq);
        const rad = Math.acos(_cq[3]) * 2;
        const s = Math.sin(rad / 2);
        let rv = 0;
        if (s > 0.000001) {
            rv = rad / (2 * Math.PI);
            rotAxis[0] = _cq[0] / s; rotAxis[1] = _cq[1] / s; rotAxis[2] = _cq[2] / s;
        }
        _rotVel += (rv - _rotVel) * 0.5 * ts;
        rotVel = _rotVel / ts;

        // Camera zoom
        const isMoving = isDown || Math.abs(rotVel) > 0.01;
        setMoving(isMoving);
        let targetZ = 3;
        let damp = 5 / ts;
        if (!isDown) {
            const ni = findNearest();
            setActiveItem(ni);
            const np = vec3.transformQuat(vec3.create(), instancePositions[ni], orientation);
            snapTarget = vec3.normalize(vec3.create(), np);
        } else {
            targetZ += rotVel * 80 + 2.5;
            damp = 7 / ts;
        }
        camPos[2] += (targetZ - camPos[2]) / damp;
        updateCamera();

        // Update instances
        const positions = instancePositions.map(p => vec3.transformQuat(vec3.create(), p, orientation));
        const scale = 0.25;
        positions.forEach((p, ndx) => {
            const sf = (Math.abs(p[2]) / SPHERE_RADIUS) * 0.6 + 0.4;
            const fs = sf * scale;
            const m = mat4.create();
            mat4.multiply(m, m, mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), p)));
            mat4.multiply(m, m, mat4.targetTo(mat4.create(), [0, 0, 0], p, [0, 1, 0]));
            mat4.multiply(m, m, mat4.fromScaling(mat4.create(), [fs, fs, fs]));
            mat4.multiply(m, m, mat4.fromTranslation(mat4.create(), [0, 0, -SPHERE_RADIUS]));
            matricesArray.set(m, ndx * 16);
        });

        gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, matricesArray);

        // Render
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(program);
        gl.uniformMatrix4fv(loc.uWorldMatrix, false, worldMat);
        gl.uniformMatrix4fv(loc.uViewMatrix, false, viewMat);
        gl.uniformMatrix4fv(loc.uProjectionMatrix, false, projMat);
        gl.uniform4f(loc.uRotationAxisVelocity, rotAxis[0], rotAxis[1], rotAxis[2], rotVel * 1.1);
        gl.uniform1i(loc.uItemCount, items.length);
        gl.uniform1i(loc.uAtlasSize, atlasSize);
        gl.uniform1i(loc.uTex, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);

        gl.bindVertexArray(vao);
        gl.drawElementsInstanced(gl.TRIANGLES, disc.indices.length, gl.UNSIGNED_SHORT, 0, instanceCount);

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded', () => {
    // ColorBends hero background
    initColorBends('hero-color-bends', {
        colors: ['#7c5cfc', '#00c8ff', '#ff6bca'],
        rotation: 90,
        speed: 0.2,
        scale: 1,
        frequency: 1,
        warpStrength: 1,
        mouseInfluence: 1,
        noise: 0.15,
        parallax: 0.5,
        iterations: 1,
        intensity: 1.5,
        bandWidth: 6,
        transparent: true
    });

    initScrollAnimations();
    initNavbar();
    initMobileMenu();
    initCounters();
    initSmoothScroll();
    initChromaGrid('vark-chroma-grid');
    initStack('features-stack', {
        sensitivity: 200,
        autoplay: true,
        autoplayDelay: 3500,
        pauseOnHover: true
    });
    initClickSpark();
    initInfiniteMenu('infinite-menu-canvas', [
        { image: 'https://cdn.simpleicons.org/react/61DAFB', title: 'React Native', description: 'Cross-platform mobile framework', color: '#61DAFB' },
        { image: 'https://cdn.simpleicons.org/expo/FFFFFF', title: 'Expo', description: 'React Native toolchain', color: '#000020' },
        { image: 'https://cdn.simpleicons.org/supabase/3FCF8E', title: 'Supabase', description: 'Open source Firebase alternative', color: '#3FCF8E' },
        { image: 'https://cdn.simpleicons.org/huggingface/FFD21E', title: 'Hugging Face', description: 'AI model hosting platform', color: '#FFD21E' },
        { image: 'https://cdn.simpleicons.org/react/61DAFB', title: 'ReactFlow', description: 'Interactive node-based UIs', color: '#FF0072' },
        { image: 'https://cdn.simpleicons.org/gradio/F97316', title: 'Gradio', description: 'ML demo interfaces', color: '#F97316' }
    ]);
});
