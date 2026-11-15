// Single constant for the live Terra-Analog application URL
const APP_URL = "https://terra-analog-app.vercel.app/?_vercel_share=0m3Ah2nSZjAR3qLT1xPJBO7yTHV7x71R#/landing";

// Ground-truth configuration (only enabled sources & working features render)
const FACTS = {
  dataSources: [
    {
      id: "mars-moon-terrain",
      name: "Mars and Moon terrain",
      target: "modeled (live NASA Trek feed returned 404, DEM integration is the next step)",
      body: "mars",
      enabled: true,
    },
    {
      id: "earth-dem",
      name: "AWS Terrain Tiles",
      target: "Earth elevation, measured",
      body: "earth",
      enabled: true,
    },
  ],
  features: {
    dualMap: true,
    terrain3d: true,
    similarityMatrix: true,
    pdfDossier: true,
  },
};

const TOTAL_SLIDES = 6;
const WHEEL_COOLDOWN_MS = 650;
const SWIPE_THRESHOLD_PX = 50;

function clampSlideIndex(index, total = TOTAL_SLIDES) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(index)));
}

function formatSlideCounter(index, total = TOTAL_SLIDES) {
  const clamped = clampSlideIndex(index, total);
  return `${clamped + 1} / ${total}`;
}

function getSlideDirectionForKey(key, isInteractiveTarget) {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
      return 1;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return -1;
    case " ":
      return isInteractiveTarget ? 0 : 1;
    default:
      return 0;
  }
}

function getSlideDirectionForSwipe(deltaX, deltaY, thresholdPx = SWIPE_THRESHOLD_PX) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < thresholdPx) return 0;
  if (absX <= absY * 1.2) return 0;
  return deltaX < 0 ? 1 : -1;
}

function getSlideDirectionForWheel(
  deltaX,
  deltaY,
  scrollTop,
  scrollHeight,
  clientHeight,
  minDelta = 12
) {
  const primaryDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  if (Math.abs(primaryDelta) < minDelta) return 0;

  const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
  if (!isHorizontal && scrollHeight > clientHeight + 2) {
    return 0;
  }

  return primaryDelta > 0 ? 1 : -1;
}

function filterEnabledSources(sources) {
  return sources.filter((item) => Boolean(item && item.enabled));
}

if (typeof globalThis !== "undefined") {
  globalThis.__TERRA_ANALOG_NAV__ = {
    TOTAL_SLIDES,
    clampSlideIndex,
    formatSlideCounter,
    getSlideDirectionForKey,
    getSlideDirectionForSwipe,
    getSlideDirectionForWheel,
    filterEnabledSources,
  };
}

function setupScreenshotFallbacks() {
  const slots = document.querySelectorAll(".screen-slot");
  slots.forEach((slot) => {
    const img = slot.querySelector(".screen-img");
    const placeholder = slot.querySelector(".screen-placeholder");
    if (!img || !placeholder) return;

    const showPlaceholder = () => {
      img.hidden = true;
      placeholder.hidden = false;
    };

    const showImage = () => {
      img.hidden = false;
      placeholder.hidden = true;
    };

    img.addEventListener("error", showPlaceholder);
    img.addEventListener("load", () => {
      if (img.naturalWidth === 0) {
        showPlaceholder();
      } else {
        showImage();
      }
    });

    if (img.complete) {
      if (img.naturalWidth === 0) {
        showPlaceholder();
      } else {
        showImage();
      }
    }
  });
}

function renderFactsData() {
  const launchCta = document.getElementById("launch-app-cta");
  if (launchCta) {
    launchCta.setAttribute("href", APP_URL);
  }

  const sourcesContainer = document.getElementById("data-sources-list");
  if (sourcesContainer) {
    sourcesContainer.innerHTML = "";
    const activeSources = filterEnabledSources(FACTS.dataSources);
    activeSources.forEach((source) => {
      const row = document.createElement("div");
      row.className = "source-row";

      const nameEl = document.createElement("span");
      nameEl.className = "source-name";
      nameEl.textContent = source.name;

      const targetEl = document.createElement("span");
      targetEl.className = `source-target target-${source.body}`;
      targetEl.textContent = source.target;

      row.appendChild(nameEl);
      row.appendChild(targetEl);
      sourcesContainer.appendChild(row);
    });
  }

  const featureNodes = document.querySelectorAll("[data-feature]");
  featureNodes.forEach((node) => {
    const key = node.getAttribute("data-feature");
    if (!key) return;
    const isEnabled = Boolean(FACTS.features[key]);
    node.hidden = !isEnabled;
  });
}

function initAccretionShader() {
  const canvas = document.getElementById("accretion-bg-canvas");
  if (!canvas) return null;

  const gl =
    canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    }) ||
    canvas.getContext("experimental-webgl", {
      alpha: false,
      antialias: false,
    });

  if (!gl) return null;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const debugExt = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererStr = debugExt
    ? String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || "")
    : "";
  const isSoftwareGl = /swiftshader|llvmpipe|softpipe/i.test(rendererStr);

  const vertexShaderSrc = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSrc = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2D(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.5;
      mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 4; i++) {
        v += amp * noise2D(p);
        p = rot * p * 2.03;
        amp *= 0.5;
      }
      return v;
    }

    // Rotate sampling coords CCW so pattern rotates CLOCKWISE on screen (y-up)
    vec2 rotateForCW(vec2 p, float angle) {
      float c = cos(angle);
      float s = sin(angle);
      return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    }

    // Evaluates one lensed accretion disk + shadow-mirrored plasma field.
    // mirrorSign = +1.0 -> warm orange upper-arch / left-beamed disk
    // mirrorSign = -1.0 -> cool blue mirrored lower-arch / shadow counterpart
    vec2 evalDiskLayer(vec2 p, float time, float mirrorSign) {
      // Slight tilted inclination matching the reference perspective
      float tilt = -0.10 * mirrorSign;
      float ct = cos(tilt);
      float st = sin(tilt);
      vec2 q = vec2(p.x * ct - p.y * st, p.x * st + p.y * ct);

      // Mirror vertically for the counterpart shadow layer
      vec2 m = vec2(q.x, q.y * mirrorSign);

      // Clockwise screen-space angular phase (decreasing theta with time)
      float theta = atan(p.y, p.x + 1e-6);
      float cwPhase = theta + time * 0.55;

      // Elliptical shadow radius (slightly wider horizontally like an inclined Kerr shadow)
      vec2 ell = vec2(m.x * 0.90, (m.y - 0.015) * 1.12);
      float r = length(ell);
      float rh = 0.165;

      // 1) Wide horizontal rippled plasma disk stretching across the frame
      vec2 diskPos = vec2(m.x * 0.72, (m.y + 0.045) * 3.85);
      float rDisk = length(diskPos);
      vec2 swirlCoord = rotateForCW(diskPos * 3.1, time * 0.34);
      float nDisk = fbm(swirlCoord + vec2(rDisk * 3.8, sin(cwPhase * 2.0) * 0.35));
      float wave = sin(rDisk * 36.0 - nDisk * 7.2 + cwPhase * 3.0);
      float ripples = pow(0.5 + 0.5 * wave, 1.35);

      float diskMask = smoothstep(rh * 0.78, rh * 1.25, rDisk)
                     * exp(-max(0.0, rDisk - rh * 1.05) * 1.45);
      float wingStretch = exp(-abs(m.y + 0.045) * 5.2) * smoothstep(0.08, 0.25, abs(m.x));
      float diskEnergy = (diskMask * 0.95 + wingStretch * 0.45) * (0.30 + 0.70 * ripples) * (0.48 + 0.72 * nDisk);

      // 2) Concentric gravitational-lensing arch curving tightly over the shadow dome
      vec2 archPos = vec2(m.x * 0.92, (m.y - 0.018) * 1.08);
      float rArch = length(archPos);
      float nArch = fbm(rotateForCW(archPos * 5.6, time * 0.30) + vec2(rArch * 5.5, 1.7));
      float archStriations = pow(0.5 + 0.5 * sin(rArch * 68.0 - nArch * 4.5 + cwPhase * 2.0), 1.45);
      float upperHemisphere = smoothstep(-0.08, 0.16, m.y);
      float archMask = smoothstep(rh * 0.99, rh * 1.06, rArch)
                     * exp(-max(0.0, rArch - rh * 1.03) * 6.8);
      float archEnergy = archMask * upperHemisphere * (0.35 + 0.65 * archStriations) * (0.65 + 0.55 * nArch);

      // 3) Razor-thin photon ring crescent (stronger on the approaching left limb)
      float ringDist = abs(r - rh * 1.015);
      float doppler = 0.35 + 0.65 * cos(atan(m.y, m.x + 1e-6) + 2.75 * mirrorSign);
      float photonRing = exp(-pow(ringDist / 0.0046, 2.0)) * (0.30 + 0.95 * max(0.0, doppler));

      // 4) Luminous foreground equatorial bridge crossing the lower rim of the shadow
      float bridgeY = abs(m.y + 0.042 + 0.012 * sin(m.x * 5.0 + time * 0.5));
      float bridgeBand = exp(-pow(bridgeY / 0.020, 2.0)) * smoothstep(0.32, 0.04, abs(m.x));
      float bridgeEnergy = bridgeBand * (0.55 + 0.45 * nDisk);

      // Clean shadow-mirror separation so orange dominates upper/left & blue mirrors lower/right
      float mirrorBias = smoothstep(-0.26, 0.28, m.y - 0.14 * m.x * mirrorSign);
      float totalDisk = (diskEnergy * 1.15 + archEnergy * 1.30) * (0.28 + 0.72 * mirrorBias);

      return vec2(totalDisk + photonRing * 1.10, bridgeEnergy);
    }

    void main() {
      vec2 res = u_resolution;
      float minDim = min(res.x, res.y);
      bool isPortrait = res.x <= res.y;
      vec2 center = isPortrait
        ? vec2(res.x * 0.50, res.y * 0.27)
        : vec2(res.x * 0.66, res.y * 0.50);
      vec2 p = (gl_FragCoord.xy - center) / minDim;

      p *= isPortrait ? 1.32 : 1.04;

      // Elliptical event horizon shadow (pure black inside)
      vec2 shadowEll = vec2(p.x * 0.90, p.y * 1.12);
      float rShadow = length(shadowEll);
      float horizonMask = smoothstep(0.158, 0.171, rShadow);

      vec2 warm = evalDiskLayer(p, u_time, 1.0);
      vec2 cool = evalDiskLayer(p, u_time + 1.4, -1.0);

      // Warm amber/orange palette
      vec3 orangeDeep = vec3(0.22, 0.06, 0.015);
      vec3 orangeMid = vec3(0.86, 0.41, 0.14);
      vec3 orangeHot = vec3(1.00, 0.87, 0.66);
      float warmVal = warm.x;
      vec3 warmCol = mix(orangeDeep, orangeMid, clamp(warmVal * 0.92, 0.0, 1.0));
      warmCol = mix(warmCol, orangeHot, clamp(pow(max(0.0, warmVal - 0.52), 1.45), 0.0, 1.0));
      warmCol *= smoothstep(0.03, 0.78, warmVal);

      // Mirrored cool steel-blue/silver palette
      vec3 blueDeep = vec3(0.04, 0.07, 0.14);
      vec3 blueMid = vec3(0.35, 0.49, 0.70);
      vec3 blueHot = vec3(0.89, 0.94, 1.00);
      float coolVal = cool.x;
      vec3 coolCol = mix(blueDeep, blueMid, clamp(coolVal * 0.88, 0.0, 1.0));
      coolCol = mix(coolCol, blueHot, clamp(pow(max(0.0, coolVal - 0.52), 1.45), 0.0, 1.0));
      coolCol *= smoothstep(0.03, 0.78, coolVal);

      // Foreground disk filament passing slightly in front of the black hole shadow
      vec3 fgBridge = orangeHot * warm.y * 0.42 + blueHot * cool.y * 0.36;

      vec3 bg = vec3(0.043, 0.051, 0.063); // #0B0D10
      vec3 outerField = (warmCol * 1.05 + coolCol * 0.96) * horizonMask;
      vec3 color = bg * mix(0.15, 1.0, horizonMask) + outerField + fgBridge * smoothstep(0.04, 0.17, rShadow);

      // Wide elliptical vignette melting seamlessly into #0B0D10
      float edgeFade = 1.0 - smoothstep(0.44, 1.08, length(p * vec2(0.66, 1.05)));
      color = mix(bg, color, clamp(edgeFade + 0.08, 0.0, 1.0));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSrc);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }

  gl.useProgram(program);

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uResLoc = gl.getUniformLocation(program, "u_resolution");
  const uTimeLoc = gl.getUniformLocation(program, "u_time");

  let isSlideOneActive = true;
  let rafId = null;
  let lastFrameMs = 0;
  const startTime = performance.now();
  const minIntervalMs = isSoftwareGl ? 60 : 16;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = isSoftwareGl ? 0.65 : Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function drawFrame(now) {
    if (!isSlideOneActive) {
      rafId = null;
      return;
    }

    if (now - lastFrameMs >= minIntervalMs || lastFrameMs === 0) {
      lastFrameMs = now;
      const elapsed = (now - startTime) * 0.001;
      gl.uniform2f(uResLoc, canvas.width, canvas.height);
      gl.uniform1f(uTimeLoc, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    if (!prefersReducedMotion) {
      rafId = window.requestAnimationFrame(drawFrame);
    }
  }

  resize();
  drawFrame(performance.now());

  window.addEventListener("resize", () => {
    resize();
    if (prefersReducedMotion && isSlideOneActive) {
      lastFrameMs = 0;
      drawFrame(performance.now());
    }
  });

  return {
    setActive(active) {
      isSlideOneActive = active;
      if (!active) {
        if (rafId !== null) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (!prefersReducedMotion && rafId === null) {
        lastFrameMs = 0;
        rafId = window.requestAnimationFrame(drawFrame);
      } else if (prefersReducedMotion) {
        lastFrameMs = 0;
        drawFrame(performance.now());
      }
    },
  };
}

function initPresentation() {
  renderFactsData();
  setupScreenshotFallbacks();
  const accretionBackdrop = initAccretionShader();

  const track = document.getElementById("slides-track");
  const viewport = document.getElementById("deck-viewport");
  const counterEl = document.getElementById("slide-counter");
  const prevBtn = document.getElementById("prev-slide-btn");
  const nextBtn = document.getElementById("next-slide-btn");
  const startBtn = document.getElementById("start-briefing-btn");
  const slideSections = Array.from(document.querySelectorAll(".slide"));
  const dotButtons = Array.from(document.querySelectorAll(".slide-dot"));

  if (!track || !viewport || slideSections.length === 0) return;

  let currentSlide = 0;
  let lastWheelNav = 0;
  let touchStart = null;

  const scrollHintEl = document.getElementById("global-scroll-hint");

  function updateScrollHintVisibility() {
    if (!scrollHintEl) return;
    const activeSection = slideSections[currentSlide];
    if (!activeSection) {
      scrollHintEl.classList.add("is-hidden");
      return;
    }

    const scrollTop = activeSection.scrollTop;
    const scrollHeight = activeSection.scrollHeight;
    const clientHeight = activeSection.clientHeight;

    const isScrollable = scrollHeight > clientHeight + 8;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 24;
    const isScrolledDown = scrollTop > 40;

    if (!isScrollable || isScrolledDown || isNearBottom) {
      scrollHintEl.classList.add("is-hidden");
    } else {
      scrollHintEl.classList.remove("is-hidden");
    }
  }

  slideSections.forEach((section) => {
    section.addEventListener("scroll", updateScrollHintVisibility, { passive: true });
  });

  if (scrollHintEl) {
    scrollHintEl.addEventListener("click", () => {
      const activeSection = slideSections[currentSlide];
      if (!activeSection) return;
      activeSection.scrollBy({
        top: activeSection.clientHeight * 0.8,
        behavior: "smooth"
      });
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      updateScrollHintVisibility();
    });
    slideSections.forEach((section) => ro.observe(section));
  }

  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener("load", updateScrollHintVisibility);
  });

  function updateDeckUI() {
    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    if (counterEl) {
      counterEl.textContent = formatSlideCounter(currentSlide, TOTAL_SLIDES);
    }

    slideSections.forEach((section, index) => {
      const isActive = index === currentSlide;
      section.setAttribute("aria-hidden", String(!isActive));
      section.inert = !isActive;
      if (isActive) {
        section.scrollTop = 0;
      }
    });

    dotButtons.forEach((btn, index) => {
      const isActive = index === currentSlide;
      btn.classList.toggle("is-active", isActive);
      if (isActive) {
        btn.setAttribute("aria-current", "step");
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    if (prevBtn) prevBtn.disabled = currentSlide === 0;
    if (nextBtn) nextBtn.disabled = currentSlide === TOTAL_SLIDES - 1;
    if (accretionBackdrop) accretionBackdrop.setActive(currentSlide === 0);

    updateScrollHintVisibility();
  }

  function goToSlide(targetIndex) {
    const next = clampSlideIndex(targetIndex, TOTAL_SLIDES);
    if (next === currentSlide) return;
    currentSlide = next;
    updateDeckUI();
  }

  function stepSlide(delta) {
    goToSlide(currentSlide + delta);
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => goToSlide(1));
  }
  if (prevBtn) {
    prevBtn.addEventListener("click", () => stepSlide(-1));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => stepSlide(1));
  }
  dotButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-slide") ?? 0);
      goToSlide(idx);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target && event.target.tagName ? event.target.tagName : "";
    const isInteractive =
      tag === "BUTTON" ||
      tag === "A" ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT";

    const direction = getSlideDirectionForKey(event.key, isInteractive);
    if (direction === 0) return;

    event.preventDefault();
    stepSlide(direction);
  });

  viewport.addEventListener(
    "wheel",
    (event) => {
      const now = Date.now();
      if (now - lastWheelNav < WHEEL_COOLDOWN_MS) return;

      const activeSection = slideSections[currentSlide];
      const scrollTop = activeSection ? activeSection.scrollTop : 0;
      const scrollHeight = activeSection ? activeSection.scrollHeight : 0;
      const clientHeight = activeSection ? activeSection.clientHeight : 0;

      const direction = getSlideDirectionForWheel(
        event.deltaX,
        event.deltaY,
        scrollTop,
        scrollHeight,
        clientHeight
      );

      if (direction !== 0) {
        lastWheelNav = now;
        stepSlide(direction);
      }
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) {
        touchStart = null;
        return;
      }
      touchStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    },
    { passive: true }
  );

  viewport.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart || event.changedTouches.length !== 1) {
        touchStart = null;
        return;
      }
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;

      const direction = getSlideDirectionForSwipe(dx, dy, SWIPE_THRESHOLD_PX);
      if (direction !== 0) {
        stepSlide(direction);
      }
    },
    { passive: true }
  );

  updateDeckUI();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPresentation);
  } else {
    initPresentation();
  }
}
