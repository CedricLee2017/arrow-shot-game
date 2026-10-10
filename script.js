(() => {
  'use strict';

  const canvas = document.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  const canvasWrap = document.querySelector('#canvas-wrap');
  const scoreElement = document.querySelector('#score');
  const arrowsElement = document.querySelector('#arrows-left');
  const pipsElement = document.querySelector('#arrow-pips');
  const statusElement = document.querySelector('#shot-status');
  const lastShotElement = document.querySelector('#last-shot');
  const windElement = document.querySelector('#wind-display');
  const hintElement = document.querySelector('#canvas-hint');
  const overlayElement = document.querySelector('#round-overlay');
  const soundButton = document.querySelector('#sound-toggle');
  const TAU = Math.PI * 2;
  const ARROW_TOTAL = 8;
  const scene = { width: 1000, height: 544 };
  const game = {
    score: 0, arrows: ARROW_TOTAL, phase: 'ready', dragging: false,
    pointer: null, flight: null, projectiles: [], stuckArrows: [], particles: [],
    target: { x: 810, y: 355, radius: 47, phase: Math.random() * TAU, speed: 0.8 },
    wind: (Math.random() - 0.5) * 0.7, sound: true, audio: null, lastTime: 0,
    clouds: Array.from({ length: 5 }, (_, index) => ({ x: index * 244 + Math.random() * 90, y: 48 + Math.random() * 118, speed: 3 + Math.random() * 5, size: 28 + Math.random() * 48 })),
  };
  const bow = { x: 154, y: 424 };
  const aim = { x: 206, y: 340 };
  const colors = { sky: '#dce6d8', far: '#c4d2bd', hill: '#b6c6ad', field: '#98ac8a', shadow: '#657e61', bark: '#80684e', bow: '#684933', wood: '#90613f' };

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    context.setTransform(canvas.width / scene.width, 0, 0, canvas.height / scene.height, 0, 0);
    draw();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawBackground(time) {
    const sky = context.createLinearGradient(0, 0, 0, 410);
    sky.addColorStop(0, '#dce9df'); sky.addColorStop(0.67, '#e9ebd9'); sky.addColorStop(1, '#dce1c9');
    context.fillStyle = sky; context.fillRect(0, 0, scene.width, scene.height);
    context.fillStyle = '#f7efda'; context.beginPath(); context.arc(772, 116, 34, 0, TAU); context.fill();
    context.fillStyle = '#f7efda33'; context.beginPath(); context.arc(772, 116, 49, 0, TAU); context.fill();

    game.clouds.forEach((cloud, index) => {
      cloud.x -= cloud.speed * Math.min(time, 0.04);
      if (cloud.x < -cloud.size * 4) cloud.x = scene.width + cloud.size;
      context.save(); context.globalAlpha = 0.14 + index % 2 * 0.045; context.fillStyle = '#fffdf0';
      context.beginPath(); context.ellipse(cloud.x, cloud.y, cloud.size * 1.8, cloud.size * 0.27, 0, 0, TAU); context.fill(); context.restore();
    });

    context.fillStyle = '#c5d1bb'; context.beginPath(); context.moveTo(0, 304); context.quadraticCurveTo(128, 224, 270, 294); context.quadraticCurveTo(432, 204, 567, 286); context.quadraticCurveTo(745, 221, 1000, 285); context.lineTo(1000, 433); context.lineTo(0, 433); context.closePath(); context.fill();
    context.fillStyle = '#b0c1a7'; context.beginPath(); context.moveTo(0, 365); context.quadraticCurveTo(205, 273, 393, 356); context.quadraticCurveTo(618, 262, 821, 341); context.quadraticCurveTo(916, 299, 1000, 346); context.lineTo(1000, 452); context.lineTo(0, 452); context.closePath(); context.fill();

    const ground = context.createLinearGradient(0, 370, 0, scene.height);
    ground.addColorStop(0, '#9faf88'); ground.addColorStop(1, '#748b68');
    context.fillStyle = ground; context.fillRect(0, 365, scene.width, 179);
    context.fillStyle = '#d1d0aa'; context.beginPath(); context.moveTo(175, 544); context.quadraticCurveTo(364, 424, 630, 390); context.quadraticCurveTo(439, 476, 303, 544); context.closePath(); context.fill();
    context.fillStyle = '#d1d0aa'; context.beginPath(); context.moveTo(600, 397); context.quadraticCurveTo(823, 432, 1000, 520); context.lineTo(1000, 544); context.lineTo(728, 453); context.closePath(); context.fill();

    const windDrift = Math.sin(time * 1.1) * 0.2;
    context.strokeStyle = '#f4f0da59'; context.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const x = (i * 159 + 73 + (time * 10 + 300) % 180) % 1060 - 30;
      const y = 397 + (i % 3) * 38;
      context.beginPath(); context.moveTo(x, y + 8); context.quadraticCurveTo(x + 6 + windDrift * 8, y - 3, x + 13, y - 8); context.stroke();
    }
    drawDistanceMarkers(); drawTarget(time);
    drawFence();
  }

  function drawDistanceMarkers() {
    [0.34, 0.56, 0.78].forEach((scale, index) => {
      const x = 172 + (810 - 172) * scale;
      context.fillStyle = '#576851bd'; context.font = '10px "DM Mono", monospace'; context.textAlign = 'center';
      context.fillText(`${15 + index * 10} M`, x, 516 - index * 17);
      context.strokeStyle = '#f0edd19b'; context.lineWidth = 1; context.beginPath(); context.moveTo(x, 466 - index * 15); context.lineTo(x, 506 - index * 16); context.stroke();
    });
    context.textAlign = 'start';
  }

  function drawFence() {
    context.strokeStyle = '#7282628c'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(0, 429); context.lineTo(90, 429); context.moveTo(0, 449); context.lineTo(90, 449); context.stroke();
    for (let i = 0; i < 6; i++) {
      context.beginPath(); context.moveTo(i * 19, 419); context.lineTo(i * 19, 460); context.stroke();
    }
    drawShrub(35, 395, 0.78); drawShrub(952, 385, 1.15); drawShrub(920, 421, 0.62); drawShrub(317, 392, 0.52);
  }

  function drawShrub(x, y, scale) {
    context.save(); context.translate(x, y); context.scale(scale, scale);
    for (let i = 0; i < 5; i++) {
      context.fillStyle = ['#657e60', '#728765', '#819373'][i % 3];
      context.beginPath(); context.arc((i - 2) * 12, Math.sin(i * 3) * 5, 10 + (i % 2) * 3, 0, TAU); context.fill();
    }
    context.restore();
  }

  function drawTarget(time) {
    const target = game.target;
    target.y = 333 + Math.sin(time * target.speed + target.phase) * 31;
    const x = target.x, y = target.y;
    context.save();
    context.fillStyle = '#3c4c3740'; context.beginPath(); context.ellipse(x + 2, 461, 49, 9, 0, 0, TAU); context.fill();
    context.strokeStyle = '#71543b'; context.lineWidth = 8; context.lineCap = 'round';
    context.beginPath(); context.moveTo(x, y + target.radius - 3); context.lineTo(x - 3, 462); context.moveTo(x, y + target.radius - 3); context.lineTo(x + 14, 462); context.stroke();
    context.strokeStyle = '#aa8259'; context.lineWidth = 2; context.beginPath(); context.moveTo(x - 15, 451); context.lineTo(x + 16, 451); context.stroke();
    const rings = [
      [target.radius, '#f5f0df'], [target.radius * .79, '#c65d44'], [target.radius * .58, '#f5f0df'],
      [target.radius * .37, '#c65d44'], [target.radius * .18, '#e9ca61'], [target.radius * .065, '#f7f1dc'],
    ];
    rings.forEach(([radius, color]) => { context.fillStyle = color; context.beginPath(); context.arc(x, y, radius, 0, TAU); context.fill(); });
    context.strokeStyle = '#745d42'; context.lineWidth = 2; context.beginPath(); context.arc(x, y, target.radius, 0, TAU); context.stroke();
    context.fillStyle = '#a43e33'; context.beginPath(); context.arc(x, y, 1.5, 0, TAU); context.fill();
    context.restore();
  }

  function anchorPoint() {
    return { x: bow.x + 27, y: bow.y - 15 };
  }

  function currentAim() {
    const anchor = anchorPoint();
    if (!game.dragging || !game.pointer) return { angle: -0.14, power: 0, pull: 0, anchor };
    let dx = anchor.x - game.pointer.x;
    let dy = anchor.y - game.pointer.y;
    const pull = Math.min(Math.hypot(dx, dy), 116);
    const maxPull = Math.hypot(dx, dy) || 1;
    dx /= maxPull; dy /= maxPull;
    return { angle: Math.atan2(dy, dx), power: pull / 116, pull, anchor, dx, dy };
  }

  function drawBowAndAim() {
    const a = currentAim();
    const cx = bow.x, cy = bow.y;
    context.save();
    context.fillStyle = '#48533c44'; context.beginPath(); context.ellipse(cx + 3, 470, 27, 5, 0, 0, TAU); context.fill();
    context.strokeStyle = '#96724e'; context.lineWidth = 8; context.lineCap = 'round';
    context.beginPath(); context.moveTo(cx - 10, 462); context.quadraticCurveTo(cx - 20, 439, cx - 16, 418); context.quadraticCurveTo(cx - 22, 389, cx - 7, 372); context.stroke();
    context.strokeStyle = '#694a34'; context.lineWidth = 4;
    context.beginPath(); context.moveTo(cx - 9, 458); context.quadraticCurveTo(cx + 4, 422, cx - 8, 379); context.stroke();
    context.strokeStyle = '#e5d6ad'; context.lineWidth = 1.1; context.beginPath(); context.moveTo(cx - 11, 460); context.lineTo(cx + 27, cy - 15); context.lineTo(cx - 10, 377); context.stroke();
    context.strokeStyle = '#b59469'; context.lineWidth = 4; context.beginPath(); context.moveTo(cx - 5, 422); context.lineTo(cx + 2, 425); context.stroke();
    context.fillStyle = '#d4b98d'; context.beginPath(); context.arc(cx + 1, cy - 14, 2.5, 0, TAU); context.fill();

    if (game.dragging) {
      const tip = { x: a.anchor.x - Math.cos(a.angle) * 28, y: a.anchor.y - Math.sin(a.angle) * 28 };
      context.strokeStyle = '#ead4af'; context.lineWidth = 1.1; context.beginPath(); context.moveTo(cx - 10, 377); context.lineTo(tip.x, tip.y); context.lineTo(cx - 11, 460); context.stroke();
      drawTrajectory(a.angle, a.power);
      drawPowerMeter(a.power);
      context.fillStyle = '#382f22'; context.beginPath(); context.ellipse(tip.x, tip.y, 22, 7, a.angle, 0, TAU); context.fill();
      drawArrowhead(tip.x, tip.y, a.angle, '#e9dbc0');
    } else if (game.phase === 'ready' && game.arrows > 0) {
      const angle = -0.14;
      drawTrajectory(angle, 0.48);
      const tipX = a.anchor.x + Math.cos(angle) * 48, tipY = a.anchor.y + Math.sin(angle) * 48;
      drawArrow(tipX, tipY, angle, 45, '#725238');
    }
    context.restore();
  }

  function drawPowerMeter(power) {
    const x = 31, y = 217, w = 8, h = 96;
    roundedRect(context, x - 7, y - 8, 22, 119, 4); context.fillStyle = '#ffffff9c'; context.fill();
    context.fillStyle = '#7b7b684e'; context.fillRect(x, y, w, h);
    const fillHeight = h * power;
    const gradient = context.createLinearGradient(0, y + h, 0, y); gradient.addColorStop(0, '#748962'); gradient.addColorStop(1, '#ce7654');
    context.fillStyle = gradient; context.fillRect(x, y + h - fillHeight, w, fillHeight);
    context.fillStyle = '#58604f'; context.font = '8px "DM Mono", monospace'; context.save(); context.translate(15, y + h); context.rotate(-Math.PI / 2); context.fillText('PULL POWER', 0, 0); context.restore();
    context.fillStyle = '#545e4c'; context.font = '9px "DM Mono", monospace'; context.fillText(`${Math.round(power * 100)}%`, x - 3, y + h + 17);
  }

  function drawTrajectory(angle, power) {
    if (power < 0.1) return;
    const anchor = anchorPoint();
    const initial = (8.2 + power * 9.8) * 60;
    context.save(); context.setLineDash([3, 7]); context.lineWidth = 1.6; context.strokeStyle = '#3647346c'; context.beginPath(); context.moveTo(anchor.x, anchor.y);
    for (let t = 0.08; t < 2.1; t += 0.08) {
      const x = anchor.x + Math.cos(angle) * initial * t + game.wind * 19 * t * t;
      const y = anchor.y + Math.sin(angle) * initial * t + 0.5 * 67 * t * t;
      if (y > 477 || x > 995) break;
      context.lineTo(x, y);
    }
    context.stroke(); context.restore();
  }

  function drawArrowhead(x, y, angle, color) {
    context.save(); context.translate(x, y); context.rotate(angle);
    context.fillStyle = color; context.beginPath(); context.moveTo(17, 0); context.lineTo(7, -4); context.lineTo(9, 0); context.lineTo(7, 4); context.closePath(); context.fill(); context.restore();
  }

  function drawArrow(tipX, tipY, angle, length = 45, color = '#57412e') {
    context.save(); context.translate(tipX, tipY); context.rotate(angle);
    context.strokeStyle = color; context.lineWidth = 2.6; context.lineCap = 'round'; context.beginPath(); context.moveTo(-length, 0); context.lineTo(13, 0); context.stroke();
    context.fillStyle = '#d8c7a2'; context.beginPath(); context.moveTo(21, 0); context.lineTo(11, -4); context.lineTo(13, 0); context.lineTo(11, 4); context.closePath(); context.fill();
    context.fillStyle = '#f3eee1'; context.beginPath(); context.moveTo(-length, 0); context.lineTo(-length - 10, -6); context.lineTo(-length + 2, 0); context.closePath(); context.fill();
    context.beginPath(); context.moveTo(-length, 0); context.lineTo(-length - 10, 6); context.lineTo(-length + 2, 0); context.closePath(); context.fill();
    context.restore();
  }

  function drawProjectiles() {
    game.projectiles.forEach(projectile => drawArrow(projectile.x, projectile.y, projectile.angle, 47, '#59442d'));
    game.stuckArrows.forEach(arrow => drawArrow(arrow.x, arrow.y, arrow.angle, 45, '#6d5438'));
    game.particles.forEach(particle => {
      context.save(); context.globalAlpha = Math.max(0, particle.life / particle.maxLife); context.fillStyle = particle.color;
      context.beginPath(); context.arc(particle.x, particle.y, particle.size, 0, TAU); context.fill(); context.restore();
    });
  }

  function draw() {
    if (!context || !canvas.width) return;
    const time = performance.now() / 1000;
    context.clearRect(0, 0, scene.width, scene.height);
    drawBackground(time); drawProjectiles(); drawBowAndAim();
  }

  function pointerPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * scene.width, y: (event.clientY - bounds.top) / bounds.height * scene.height };
  }

  function beginAim(event) {
    if (game.phase !== 'ready' || game.arrows <= 0) return;
    const point = pointerPosition(event), anchor = anchorPoint();
    if (point.x > 320 || point.y < 90 || point.y > 520) return;
    event.preventDefault(); canvas.setPointerCapture?.(event.pointerId);
    game.dragging = true; game.pointer = point; hintElement.classList.add('dismissed');
    statusElement.textContent = '拉弦瞄準中 — 放開滑鼠即可發射';
    playSound('pull'); draw();
  }

  function moveAim(event) {
    if (!game.dragging) return;
    game.pointer = pointerPosition(event); draw();
  }

  function releaseAim() {
    if (!game.dragging || game.phase !== 'ready') return;
    const a = currentAim();
    game.dragging = false; game.pointer = null;
    let angle = a.angle;
    if (a.pull < 30) angle = -0.14;
    if (angle > 0.16) angle = 0.16;
    if (angle < -1.35) angle = -1.35;
    const power = a.pull < 30 ? 0.57 : Math.max(0.22, a.power);
    launchArrow(angle, power); draw();
  }

  function launchArrow(angle, power) {
    if (game.phase !== 'ready' || game.arrows <= 0) return;
    game.arrows--; updateHud(); game.phase = 'flight';
    const anchor = anchorPoint(), speed = (8.2 + power * 9.8) * 60;
    game.flight = { x: anchor.x + Math.cos(angle) * 26, y: anchor.y + Math.sin(angle) * 26, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, angle, elapsed: 0, wind: game.wind };
    game.projectiles.push(game.flight);
    statusElement.textContent = '箭矢飛行中 — 注意風向';
    lastShotElement.innerHTML = '<span class="last-shot-icon">↗</span><span><b>箭已離弦。</b><small>追蹤你的飛行軌跡</small></span>';
    playSound('shoot');
    window.setTimeout(() => { if (!game.dragging && game.phase === 'ready') statusElement.textContent = '準備就緒 — 拉起弓弦開始瞄準'; }, 800);
  }

  function updateFlight(deltaSeconds) {
    const arrow = game.flight;
    if (!arrow) return;
    const steps = Math.max(1, Math.ceil(deltaSeconds * 70));
    const dt = deltaSeconds / steps;
    for (let step = 0; step < steps; step++) {
      const previous = { x: arrow.x, y: arrow.y };
      arrow.vx += arrow.wind * 38 * dt;
      arrow.vy += 67 * dt;
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;
      arrow.elapsed += dt;
      arrow.angle = Math.atan2(arrow.vy, arrow.vx);
      if (segmentHitsCircle(previous, arrow, game.target.x, game.target.y, game.target.radius)) {
        const centerTime = (game.target.x - arrow.x) / (arrow.vx || 1);
        const projectedY = arrow.y + arrow.vy * centerTime + 0.5 * 67 * centerTime * centerTime;
        registerHit(arrow, Math.abs(projectedY - game.target.y)); return;
      }
      if (arrow.y > 456 || arrow.x > 1025 || arrow.x < -50 || arrow.elapsed > 5) {
        missArrow(arrow); return;
      }
    }
  }

  function segmentHitsCircle(from, to, cx, cy, radius) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const denominator = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((cx - from.x) * dx + (cy - from.y) * dy) / denominator));
    return Math.hypot(from.x + t * dx - cx, from.y + t * dy - cy) < radius + 6;
  }

  function registerHit(arrow, distance) {
    const radius = game.target.radius;
    let points, ring;
    if (distance < radius * .13) { points = 100; ring = '金心！正中靶心'; }
    else if (distance < radius * .32) { points = 75; ring = '黃心！精準命中'; }
    else if (distance < radius * .53) { points = 50; ring = '內圈命中'; }
    else if (distance < radius * .75) { points = 30; ring = '紅圈命中'; }
    else { points = 10; ring = '擦中外圈'; }
    game.score += points;
    const stuck = { x: arrow.x, y: arrow.y, angle: arrow.angle };
    game.stuckArrows.push(stuck);
    addParticles(arrow.x, arrow.y, points === 100 ? '#ead181' : '#e7ede0', 16);
    game.projectiles = game.projectiles.filter(item => item !== arrow);
    game.flight = null; game.phase = 'ready'; game.target.speed = 0.8 + Math.random() * 0.36;
    updateHud(); playSound('hit', points === 100);
    statusElement.textContent = `${ring}！ +${points} 分`;
    lastShotElement.innerHTML = `<span class="last-shot-icon">◎</span><span><b>${ring}　+${points} 分</b><small>${Math.round(distance / radius * 100)}% 靶心半徑</small></span>`;
    scheduleNext();
  }

  function missArrow(arrow) {
    game.projectiles = game.projectiles.filter(item => item !== arrow);
    addParticles(Math.max(40, Math.min(970, arrow.x)), Math.min(450, arrow.y), '#ede7d0', 5);
    game.flight = null; game.phase = 'ready'; playSound('miss'); updateHud();
    statusElement.textContent = '落箭 — 穩住呼吸，再試一次';
    lastShotElement.innerHTML = '<span class="last-shot-icon">↘</span><span><b>這次差了一點。</b><small>風向變化中，修正後再試</small></span>';
    game.wind = (Math.random() - 0.5) * 0.9;
    windElement.textContent = `風向　${game.wind > 0.1 ? '→' : game.wind < -0.1 ? '←' : '·'}　${Math.abs(game.wind) > .24 ? '和風' : '微風'}`;
    scheduleNext();
  }

  function scheduleNext() {
    if (game.arrows <= 0) {
      window.setTimeout(() => {
        if (game.arrows <= 0 && game.phase !== 'flight') {
          game.phase = 'finished'; document.querySelector('#final-score').textContent = String(game.score).padStart(4, '0');
          overlayElement.hidden = false; statusElement.textContent = '本回合結束 — 你已射出全部箭矢';
        }
      }, 600);
    }
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU, speed = 30 + Math.random() * 130;
      game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .3 + Math.random() * .55, maxLife: .85, size: 1.5 + Math.random() * 2.2, color });
    }
  }

  function updateParticles(dt) {
    game.particles = game.particles.filter(particle => {
      particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      particle.vy += 60 * dt; return particle.life > 0;
    });
  }

  function updateHud() {
    scoreElement.textContent = String(game.score).padStart(4, '0');
    arrowsElement.textContent = String(game.arrows);
    pipsElement.setAttribute('aria-label', `剩餘 ${game.arrows} 支箭`);
    pipsElement.innerHTML = Array.from({ length: ARROW_TOTAL }, (_, index) => `<span class="arrow-pip ${index < game.arrows ? 'active' : 'used'}"></span>`).join('');
  }

  function playSound(type, perfect = false) {
    if (!game.sound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      game.audio ||= new AudioContext();
      if (game.audio.state === 'suspended') game.audio.resume();
      const now = game.audio.currentTime;
      const voice = game.audio.createOscillator();
      const volume = game.audio.createGain();
      voice.connect(volume); volume.connect(game.audio.destination);
      if (type === 'pull') {
        voice.type = 'sine'; voice.frequency.setValueAtTime(215, now); voice.frequency.exponentialRampToValueAtTime(265, now + .07);
        volume.gain.setValueAtTime(.045, now); volume.gain.exponentialRampToValueAtTime(.001, now + .09); voice.start(now); voice.stop(now + .1);
      } else if (type === 'shoot') {
        voice.type = 'triangle'; voice.frequency.setValueAtTime(480, now); voice.frequency.exponentialRampToValueAtTime(145, now + .16);
        volume.gain.setValueAtTime(.12, now); volume.gain.exponentialRampToValueAtTime(.001, now + .18); voice.start(now); voice.stop(now + .19);
      } else if (type === 'hit') {
        const base = perfect ? 790 : 530;
        voice.type = 'sine'; voice.frequency.setValueAtTime(base, now); voice.frequency.exponentialRampToValueAtTime(base * 1.33, now + .07);
        volume.gain.setValueAtTime(.085, now); volume.gain.exponentialRampToValueAtTime(.001, now + .26); voice.start(now); voice.stop(now + .27);
        if (perfect) setTimeout(() => playSound('sparkle'), 90);
      } else if (type === 'sparkle') {
        voice.type = 'sine'; voice.frequency.setValueAtTime(1180, now); voice.frequency.exponentialRampToValueAtTime(1760, now + .12);
        volume.gain.setValueAtTime(.035, now); volume.gain.exponentialRampToValueAtTime(.001, now + .22); voice.start(now); voice.stop(now + .23);
      } else {
        voice.type = 'sine'; voice.frequency.setValueAtTime(170, now); voice.frequency.exponentialRampToValueAtTime(90, now + .2);
        volume.gain.setValueAtTime(.055, now); volume.gain.exponentialRampToValueAtTime(.001, now + .2); voice.start(now); voice.stop(now + .21);
      }
    } catch (_) { /* Audio is a graceful enhancement; gameplay never depends on it. */ }
  }

  function restart() {
    game.score = 0; game.arrows = ARROW_TOTAL; game.phase = 'ready'; game.dragging = false; game.pointer = null; game.flight = null;
    game.projectiles = []; game.stuckArrows = []; game.particles = [];
    game.target.speed = 0.8; game.target.phase = Math.random() * TAU;
    game.wind = (Math.random() - .5) * .65;
    windElement.textContent = `風向　${game.wind > .1 ? '→' : game.wind < -.1 ? '←' : '·'}　微風`;
    overlayElement.hidden = true; hintElement.classList.remove('dismissed');
    statusElement.textContent = '準備就緒 — 拉起弓弦開始瞄準';
    lastShotElement.innerHTML = '<span class="last-shot-icon">◎</span><span><b>你的射程，自己定義。</b><small>每一箭都值得專注。</small></span>';
    updateHud(); draw();
  }

  function frame(timestamp) {
    const delta = game.lastTime ? Math.min((timestamp - game.lastTime) / 1000, 0.04) : 1 / 60;
    game.lastTime = timestamp;
    updateFlight(delta); updateParticles(delta);
    draw(); requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', beginAim);
  canvas.addEventListener('pointermove', moveAim);
  canvas.addEventListener('pointerup', releaseAim);
  canvas.addEventListener('pointercancel', releaseAim);
  document.querySelector('#restart-button').addEventListener('click', restart);
  document.querySelector('#play-again').addEventListener('click', restart);
  soundButton.addEventListener('click', () => {
    game.sound = !game.sound;
    soundButton.setAttribute('aria-pressed', String(game.sound));
    document.querySelector('#sound-icon').textContent = game.sound ? '♫' : '♩';
    document.querySelector('#sound-label').textContent = game.sound ? '音效開啟' : '音效關閉';
    if (game.sound) playSound('pull');
  });
  window.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'r' && !event.repeat && !event.target.matches('input,textarea,button')) restart();
    if (event.key === 'Escape' && game.dragging) { game.dragging = false; game.pointer = null; statusElement.textContent = '瞄準取消 — 拉起弓弦開始瞄準'; draw(); }
  });
  new ResizeObserver(resize).observe(canvas);
  resize(); updateHud(); requestAnimationFrame(frame);
})();
