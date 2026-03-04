// =========================
// Helpers
// =========================
const $ = (q) => document.querySelector(q);
const safeText = (s) => (s || "").toString().trim().replace(/\s+/g, " ");
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const today = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date());
$("#today").textContent = today;

let typingTimer = null;

function typeText(el, text, speed = 18){
  if(!el) return;
  clearInterval(typingTimer);

  el.textContent = "";
  el.classList.add("glow");

  let i = 0;
  typingTimer = setInterval(() => {
    el.textContent += text[i] || "";
    i++;

    if(i >= text.length){
      clearInterval(typingTimer);
      typingTimer = null;
    }
  }, speed);
}

// UI elements
const nameEl = $("#name");
const headlineEl = $("#headline");
const leadEl = $("#lead");
const messageEl = $("#message");
const statusEl = $("#status");
const flameEl = $("#flame");

const celebrateBtn = $("#celebrate");
const blowBtn = $("#blow");
const resetBtn = $("#reset");
const toggleMusicBtn = $("#toggleMusic");
const musicIcon = $("#musicIcon");

const audioGate = $("#audioGate");
const startAudioBtn = $("#startAudioBtn");

// =========================
// Confetti (Canvas physics)
// =========================
const canvas = $("#confetti");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let confetti = [];
let confettiRunning = false;

function spawnConfettiBurst(intensity = 220) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const originX = w * 0.5;
  const originY = h * 0.22;

  const shapes = ["rect", "circle", "tri"];
  for (let i = 0; i < intensity; i++) {
    const size = rand(6, 12);
    const hue = (rand(0, 360)) | 0;

    confetti.push({
      x: originX + rand(-12, 12),
      y: originY + rand(-10, 10),

      vx: rand(-6, 6),
      vy: rand(-12, -6),

      gravity: rand(0.12, 0.22),
      drag: rand(0.985, 0.995),

      rot: rand(0, Math.PI * 2),
      vr: rand(-0.18, 0.18),

      sway: rand(0.6, 1.6),
      swayPhase: rand(0, Math.PI * 2),

      size,
      hue,
      alpha: rand(0.85, 1),
      shape: shapes[(Math.random() * shapes.length) | 0],

      life: rand(140, 220),
    });
  }

  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(tickConfetti);
  }
}

function drawPiece(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);

  ctx.globalAlpha = p.alpha * Math.max(0, Math.min(1, p.life / 40));
  ctx.fillStyle = `hsl(${p.hue}, 92%, 62%)`;

  const s = p.size;
  if (p.shape === "rect") {
    ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
  } else if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.lineTo(s * 0.42, s * 0.36);
    ctx.lineTo(-s * 0.42, s * 0.36);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function tickConfetti() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const w = window.innerWidth;
  const h = window.innerHeight;

  confetti = confetti.filter((p) => p.life-- > 0 && p.y < h + 60);

  for (const p of confetti) {
    p.swayPhase += 0.08;
    const swayX = Math.sin(p.swayPhase) * p.sway;

    p.vx *= p.drag;
    p.vy *= p.drag;
    p.vy += p.gravity;

    p.x += p.vx + swayX * 0.12;
    p.y += p.vy;
    p.rot += p.vr;

    if (p.x < -40) p.x = w + 40;
    if (p.x > w + 40) p.x = -40;

    drawPiece(p);
  }

  if (confetti.length === 0) {
    confettiRunning = false;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    return;
  }
  requestAnimationFrame(tickConfetti);
}

// =========================
// Music (Web Audio) - Happy Birthday
// =========================
let audioCtx = null;
let masterGain = null;
let musicOn = true;
let playing = false;
let scheduled = [];

function ensureAudio() {
  if (audioCtx) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;

  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.22;
  masterGain.connect(audioCtx.destination);
  return true;
}

function stopMusic() {
  playing = false;
  scheduled.forEach((node) => {
    try { node.stop?.(); } catch {}
    try { node.disconnect?.(); } catch {}
  });
  scheduled = [];
}

function noteFreq(note) {
  const map = {
    "C4": -9, "C#4": -8, "D4": -7, "D#4": -6, "E4": -5, "F4": -4, "F#4": -3,
    "G4": -2, "G#4": -1, "A4": 0, "A#4": 1, "B4": 2,
    "C5": 3, "C#5": 4, "D5": 5, "D#5": 6, "E5": 7, "F5": 8, "F#5": 9,
    "G5": 10,
  };
  return 440 * Math.pow(2, map[note] / 12);
}

function playTone(freq, start, dur) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.value = freq;

  const a = 0.01;
  const r = 0.08;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.7, start + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur + r);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(start);
  osc.stop(start + dur + r + 0.02);

  scheduled.push(osc, gain);
}

function playHappyBirthday() {
  if (!musicOn) return;
  if (!ensureAudio()) return;

  if (audioCtx.state !== "running") {
    audioCtx.resume().catch(() => {});
  }

  stopMusic();
  playing = true;

  const tempo = 108;
  const beat = 60 / tempo;
  const now = audioCtx.currentTime + 0.05;

  const seq = [
    ["G4", 1], ["G4", 1], ["A4", 2], ["G4", 2], ["C5", 2], ["B4", 4],
    ["G4", 1], ["G4", 1], ["A4", 2], ["G4", 2], ["D5", 2], ["C5", 4],
    ["G4", 1], ["G4", 1], ["G5", 2], ["E5", 2], ["C5", 2], ["B4", 2], ["A4", 4],
    ["F5", 1], ["F5", 1], ["E5", 2], ["C5", 2], ["D5", 2], ["C5", 4],
  ];

  let t = now;
  for (const [note, beats] of seq) {
    const dur = beats * beat * 0.92;
    playTone(noteFreq(note), t, dur);
    t += beats * beat;
  }

  const total = (t - now) + 0.25;
  setTimeout(() => {
    if (playing && musicOn) playHappyBirthday();
  }, total * 1000);
}

async function tryAutoplayMusic() {
  if (!ensureAudio()) {
    statusEl.textContent = "Audio not supported";
    return;
  }

  try {
    await audioCtx.resume();
    playHappyBirthday();
    statusEl.textContent = "Music playing";
    audioGate?.classList.add("hidden");
  } catch {
    audioGate?.classList.remove("hidden");
    statusEl.textContent = "Tap to enable music";
  }
}

// =========================
// Party background: sparkles + balloons
// =========================
function buildSparkles(count = 22){
    const root = document.getElementById("sparkles");
    if(!root) return;
    root.innerHTML = "";
    for(let i=0;i<count;i++){
      const s = document.createElement("div");
      s.className = "sparkle";
      s.style.left = `${Math.random()*100}%`;
      s.style.top = `${Math.random()*100}%`;
      s.style.setProperty("--dur", `${rand(2.8, 5.2).toFixed(2)}s`);
      s.style.transform = `translate3d(0,0,0) scale(${rand(.7,1.2).toFixed(2)})`;
      root.appendChild(s);
    }
  }
  
  function buildBalloons(count = 7){
    const root = document.getElementById("balloons");
    if(!root) return;
    root.innerHTML = "";
    for(let i=0;i<count;i++){
      const b = document.createElement("div");
      b.className = "balloon";
      b.style.left = `${rand(5, 95)}%`;
      b.style.setProperty("--dur", `${rand(12, 20).toFixed(2)}s`);
      b.style.setProperty("--r", `${rand(-8, 8).toFixed(1)}deg`);
      b.style.transform = `translate3d(0, 120vh, 0) rotate(${rand(-8,8)}deg)`;
      root.appendChild(b);
    }
  }
  
  window.addEventListener("load", () => {
    buildSparkles(26);
    buildBalloons(8);
  });

startAudioBtn?.addEventListener("click", async () => {
  if (!ensureAudio()) return;
  try {
    await audioCtx.resume();
    playHappyBirthday();
    audioGate?.classList.add("hidden");
    statusEl.textContent = "Music playing";
  } catch {
    statusEl.textContent = "Could not start audio";
  }
});

toggleMusicBtn?.addEventListener("click", () => {
  musicOn = !musicOn;
  if (!musicOn) {
    stopMusic();
    statusEl.textContent = "Music off";
    musicIcon.textContent = "🔇";
  } else {
    musicIcon.textContent = "🔊";
  }
});

// =========================
// Interactions
// =========================
celebrateBtn.addEventListener("click", () => {
    const nm = safeText(nameEl.value);
  
    if(!nm){
      statusEl.textContent = "Isi nama dulu ya 🙂";
      return;
    }
  
    headlineEl.textContent = `Selamat Ulang Tahun, ${nm}! ✨`;
  
    // pilih ucapan otomatis (acak)
    const msg =
      `Semoga ${nm} selalu sehat, bahagia, dan dilancarkan semua urusannya. 🌟
      Selamat ulang tahun, ${nm}! Semoga setiap langkahmu makin dekat ke hal-hal baik yang kamu impikan. 💫
      ${nm}, semoga tahun ini penuh kabar baik, rezeki lancar, dan hati yang tenang. 🤍
      Happy birthday, ${nm}! Semoga harimu manis, hidupmu ringan, dan senyummu makin sering. 🎂
      Untuk ${nm}: semoga makin sukses, makin sayang diri sendiri, dan makin dikelilingi orang baik. 🌷
      ${nm}, semoga semua yang kamu semogakan pelan-pelan jadi nyata. ✨`;
  
      typeText(messageEl, msg, 16);
  
    // re-light candle
    flameEl.classList.remove("off");
  
    // confetti
    spawnConfettiBurst(240);
    spawnGiftRain();
    // start music automatically after first user interaction
if (!playing) {
    playHappyBirthday();
  }
    statusEl.textContent = "Celebrating 🎊";
  });

blowBtn?.addEventListener("click", () => {
  flameEl.classList.add("off");
  spawnConfettiBurst(120);
  statusEl.textContent = "Make a wish ✨";
});

resetBtn?.addEventListener("click", () => {
  nameEl.value = "";
  headlineEl.textContent = "Selamat Ulang Tahun! ✨";
  leadEl.innerHTML = `Isi nama, lalu klik <b>Rayakan</b>. Setelah itu jangan lupa tiup lilinnya, setelah tiup lilin jangan lupa buka kadonya.`;
  messageEl.textContent = "Semoga hari ini penuh tawa, cinta, dan hal-hal baik yang datang tanpa permisi. 🥳";
  flameEl.classList.remove("off");
  confetti = [];
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  statusEl.textContent = "Ready";
});

// Start music
tryAutoplayMusic();

// =========================
// Photos (15) + Modal
// =========================
const photos = [
  { src: "photos/1.jpeg", caption: "Foto 1" },
  { src: "photos/2.jpeg", caption: "Foto 2" },
  { src: "photos/3.jpeg", caption: "Foto 3" },
  { src: "photos/4.jpeg", caption: "Foto 4" },
  { src: "photos/5.jpeg", caption: "Foto 5" },
  { src: "photos/6.jpeg", caption: "Foto 6" },
  { src: "photos/7.jpeg", caption: "Foto 7" },
  { src: "photos/8.jpeg", caption: "Foto 8" },
  { src: "photos/9.jpeg", caption: "Foto 9" },
  { src: "photos/10.jpeg", caption: "Foto 10" },
  { src: "photos/11.jpeg", caption: "Foto 11" },
  { src: "photos/12.jpeg", caption: "Foto 12" },
  { src: "photos/13.jpeg", caption: "Foto 13" },
  { src: "photos/14.jpeg", caption: "Foto 14" },
  { src: "photos/15.jpeg", caption: "Foto 15" },
];

// Modal elements (must exist in index.html)
const photoModal = $("#photoModal");
const modalBackdrop = $("#modalBackdrop");
const modalClose = $("#modalClose");
const modalImg = $("#modalImg");
const modalCaption = $("#modalCaption");
const prevPhotoBtn = $("#prevPhoto");
const nextPhotoBtn = $("#nextPhoto");

let currentPhotoIndex = 0;

function openPhoto(index) {
  currentPhotoIndex = (index + photos.length) % photos.length;
  const p = photos[currentPhotoIndex];

  modalImg.src = p.src;
  modalCaption.textContent = p.caption || "";
  photoModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closePhoto() {
  photoModal.classList.add("hidden");
  document.body.style.overflow = "auto";
}

function showPhoto(index) {
  currentPhotoIndex = (index + photos.length) % photos.length;
  const p = photos[currentPhotoIndex];
  modalImg.src = p.src;
  modalCaption.textContent = p.caption || "";
}

modalClose?.addEventListener("click", closePhoto);
modalBackdrop?.addEventListener("click", closePhoto);
prevPhotoBtn?.addEventListener("click", () => showPhoto(currentPhotoIndex - 1));
nextPhotoBtn?.addEventListener("click", () => showPhoto(currentPhotoIndex + 1));

document.addEventListener("keydown", (e) => {
  if (photoModal?.classList.contains("hidden")) return;
  if (e.key === "Escape") closePhoto();
  if (e.key === "ArrowLeft") showPhoto(currentPhotoIndex - 1);
  if (e.key === "ArrowRight") showPhoto(currentPhotoIndex + 1);
});

// =========================
// Gifts Rain (15 gifts) + Open animation then Photo Modal
// =========================
const giftsArea = $("#giftsArea");
const cakeStage = document.querySelector(".cake-stage");
const cakeEl = document.querySelector(".cake");

let gifts = [];
let animId = null;

function computeLandingSpots(count) {
  const stageRect = cakeStage.getBoundingClientRect();
  const cakeRect = cakeEl.getBoundingClientRect();

  const cx = (cakeRect.left + cakeRect.right) / 2 - stageRect.left;
  const cy = (cakeRect.top + cakeRect.bottom) / 2 - stageRect.top;

  const spots = [];
  const giftSize = 72;

  const minR = Math.min(stageRect.width, stageRect.height) * 0.22;
  const maxR = Math.min(stageRect.width, stageRect.height) * 0.42;

  let tries = 0;
  while (spots.length < count && tries < 2500) {
    tries++;

    const a = rand(0, Math.PI * 2);
    const r = rand(minR, maxR);

    let x = cx + Math.cos(a) * r - giftSize / 2;
    let y = cy + Math.sin(a) * r - giftSize / 2;

    x = clamp(x, 10, stageRect.width - giftSize - 10);
    y = clamp(y, 20, stageRect.height - giftSize - 18);

    const gx1 = x + stageRect.left, gy1 = y + stageRect.top;
    const gx2 = gx1 + giftSize, gy2 = gy1 + giftSize;

    const overlap =
      gx1 < cakeRect.right - 14 &&
      gx2 > cakeRect.left + 14 &&
      gy1 < cakeRect.bottom - 10 &&
      gy2 > cakeRect.top + 10;

    if (overlap) continue;

    let ok = true;
    for (const s of spots) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (Math.hypot(dx, dy) < 62) { ok = false; break; }
    }
    if (!ok) continue;

    spots.push({ x, y });
  }

  while (spots.length < count) {
    spots.push({
      x: rand(10, stageRect.width - giftSize - 10),
      y: rand(stageRect.height * 0.55, stageRect.height - giftSize - 18),
    });
  }

  return spots;
}

function makeGiftElement(i) {
  const el = document.createElement("div");
  el.className = "gift falling";
  el.dataset.index = String(i);

  el.innerHTML = `
    <div class="lid"></div>
    <div class="box"></div>
    <div class="ribbon-v"></div>
    <div class="ribbon-h"></div>
    <div class="bow"></div>
  `;

  el.addEventListener("click", () => {
    if (el.classList.contains("opening")) return;

    el.classList.add("opening");
    // optional little confetti
    spawnConfettiBurst(70);

    setTimeout(() => {
      openPhoto(Number(el.dataset.index) || 0);
      el.classList.remove("opening");
    }, 430);
  });

  return el;
}

function spawnGiftRain() {
  if (!giftsArea || !cakeStage || !cakeEl) return;

  giftsArea.innerHTML = "";
  gifts = [];
  cancelAnimationFrame(animId);

  const stageRect = cakeStage.getBoundingClientRect();
  const spots = computeLandingSpots(photos.length);

  for (let i = 0; i < photos.length; i++) {
    const el = makeGiftElement(i);
    giftsArea.appendChild(el);

    const startX = rand(10, stageRect.width - 72 - 10);
    const startY = rand(-240, -90);

    gifts.push({
      el,
      x: startX,
      y: startY,
      vx: rand(-0.4, 0.4),
      vy: rand(0, 1.2),
      g: rand(0.22, 0.32),
      drag: 0.985,
      sway: rand(0.6, 1.6),
      phase: rand(0, Math.PI * 2),
      rot: rand(-12, 12),
      vr: rand(-0.15, 0.15),
      ty: spots[i].y,
      landed: false,
      delay: i * 6,
    });

    el.style.setProperty("--x", `${startX}px`);
    el.style.setProperty("--y", `${startY}px`);
    el.style.setProperty("--r", `${rand(-12, 12)}deg`);
  }

  animateGifts();
}

function animateGifts() {
  const stageRect = cakeStage.getBoundingClientRect();

  for (const p of gifts) {
    if (p.delay > 0) {
      p.delay--;
      continue;
    }

    if (!p.landed) {
      p.phase += 0.06;
      const swayX = Math.sin(p.phase) * p.sway;

      p.vx = (p.vx + swayX * 0.02) * p.drag;
      p.vy = (p.vy + p.g) * p.drag;

      p.x += p.vx;
      p.y += p.vy;

      p.x = clamp(p.x, 10, stageRect.width - 72 - 10);

      if (p.y >= p.ty) {
        p.y = p.ty;
        p.landed = true;
        p.el.classList.remove("falling");
        p.el.classList.add("landed");
        setTimeout(() => { p.vx = 0; p.vy = 0; }, 180);
      }

      p.rot += p.vr;
      p.el.style.setProperty("--x", `${p.x}px`);
      p.el.style.setProperty("--y", `${p.y}px`);
      p.el.style.setProperty("--r", `${p.rot}deg`);
    }
  }

  const allLanded = gifts.every((g) => g.delay <= 0 && g.landed);
  if (!allLanded) animId = requestAnimationFrame(animateGifts);
}

// Start raining gifts on load
window.addEventListener("load", () => {
  spawnGiftRain();
});