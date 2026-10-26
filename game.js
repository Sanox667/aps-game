'use strict';

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960;
  const H = 620;

  const hud = {
    level: document.getElementById('hud-level'),
    score: document.getElementById('hud-score'),
    goal: document.getElementById('hud-goal'),
    combo: document.getElementById('hud-combo'),
    best: document.getElementById('hud-best'),
  };
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const ovUnlock = document.getElementById('ov-unlock');
  const ovBtn = document.getElementById('ov-btn');
  const toastEl = document.getElementById('toast');
  const toolsEl = document.getElementById('tools');

  // ---------- сцена ----------
  const WALL_L = 56;
  const WALL_R = 904;
  const TOP_Y = 60;
  const FLOOR_YS = [520, 400, 280, 160];
  const LADDERS = [
    { x: 150, top: 400, bottom: 520 },
    { x: 730, top: 280, bottom: 400 },
    { x: 330, top: 160, bottom: 280 },
  ];
  const GRAVITY = 1600;
  const MOVE_SPEED = 190;
  const CLIMB_SPEED = 135;
  const REACH = 54;
  const PLAYER_W = 22;
  const PLAYER_H = 36;

  // ---------- оборудование ----------
  const DEVICES = {
    smoke: { name: 'Дымовой извещатель', points: 10, color: '#e2e8f0', unlock: 1 },
    manual: { name: 'Ручной извещатель', points: 14, color: '#ef4444', unlock: 1 },
    heat: { name: 'Тепловой извещатель', points: 18, color: '#fb923c', unlock: 3 },
    siren: { name: 'Сирена', points: 26, color: '#facc15', unlock: 4 },
    panel: { name: 'Прибор ППК', points: 60, color: '#38bdf8', unlock: 6 },
  };

  const UNLOCKS = {
    2: { id: 'screwdriver', name: 'Шуруповёрт', desc: 'Установка на 45% быстрее' },
    3: { id: 'thermal', name: 'Тепловизор', desc: 'Тепловые извещатели дают x2 очки' },
    4: { id: 'radio', name: 'Рация', desc: 'Комбо больше не сбрасывается' },
    5: { id: 'helmet', name: 'Каска', desc: 'Скорость передвижения +25%' },
    6: { id: 'multimeter', name: 'Мультиметр', desc: '+10 очков за каждое устройство' },
    7: { id: 'partner', name: 'Напарник', desc: '+20% очков за установку' },
  };

  const unlocked = new Set();
  const has = (id) => unlocked.has(id);

  const keys = new Set();
  const player = {
    x: 100,
    y: FLOOR_YS[0] - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vy: 0,
    climbing: null,
    facing: 1,
  };

  const game = {
    level: 1,
    score: 0,
    installed: 0,
    goal: 5,
    combo: 0,
    comboTimer: 0,
    time: 0,
    state: 'play',
    spots: [],
    floaters: [],
    sparks: [],
    best: 0,
  };

  let installing = { timer: 0, total: 0, spot: null };
  let toastId = 0;

  // ---------- утилиты ----------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function rr(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function loadBest() {
    try {
      const value = Number(localStorage.getItem('aps_best'));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem('aps_best', String(game.best));
    } catch (e) {
      /* приватный режим — не критично */
    }
  }

  // ---------- звук ----------
  let audio = null;
  function beep(freq, dur, type) {
    try {
      if (!audio) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audio = new Ctx();
      }
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      if (audio.state === 'suspended') audio.resume();
      osc.type = type || 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + dur);
    } catch (e) {
      /* звук не обязателен */
    }
  }

  // ---------- уровень ----------
  function nearLadder(floor, x, dist) {
    const fy = FLOOR_YS[floor];
    return LADDERS.some((l) => (l.top === fy || l.bottom === fy) && Math.abs(l.x - x) < dist);
  }

  const WINDOW_ZONES = [
    [82, 248],
    [422, 568],
    [692, 878],
  ];

  function inWindowZone(x) {
    return WINDOW_ZONES.some((zone) => x > zone[0] && x < zone[1]);
  }

  function generateSpots() {
    const pool = Object.keys(DEVICES).filter((key) => DEVICES[key].unlock <= game.level);
    const spots = [];
    for (let attempt = 0; attempt < 14 && spots.length < game.goal; attempt++) {
      const gap = Math.max(56, 118 - attempt * 6);
      let guard = 0;
      while (spots.length < game.goal && guard++ < 400) {
        const floor = randInt(0, FLOOR_YS.length - 1);
        const x = randInt(WALL_L + 34, WALL_R - 34);
        if (nearLadder(floor, x, 46)) continue;
        if (floor === FLOOR_YS.length - 1 && inWindowZone(x)) continue;
        if (spots.some((s) => s.floor === floor && Math.abs(s.x - x) < gap)) continue;
        const type = pool[randInt(0, pool.length - 1)];
        spots.push({
          x,
          floor,
          y: FLOOR_YS[floor] - 58,
          type,
          done: false,
          blink: Math.random() * Math.PI * 2,
        });
      }
    }
    return spots;
  }

  function startLevel(n) {
    game.level = n;
    game.goal = 5 + (n - 1) * 2;
    game.installed = 0;
    game.combo = 0;
    game.comboTimer = 0;
    game.spots = generateSpots();
    if (game.spots.length < game.goal) game.goal = Math.max(1, game.spots.length);
    game.floaters.length = 0;
    game.sparks.length = 0;
    game.state = 'play';
    installing = { timer: 0, total: 0, spot: null };
    keys.clear();

    player.x = 100;
    player.y = FLOOR_YS[0] - player.h;
    player.vy = 0;
    player.climbing = null;
    player.facing = 1;

    if (UNLOCKS[n]) {
      unlocked.add(UNLOCKS[n].id);
      showToast('Новая функция: ' + UNLOCKS[n].name + ' — ' + UNLOCKS[n].desc);
    }

    hideOverlay();
    buildTools();
    updateHud();
  }

  function resetGame() {
    unlocked.clear();
    game.score = 0;
    game.best = loadBest();
    startLevel(1);
  }

  // ---------- игрок ----------
  function movePlayer(dt) {
    const p = player;
    const dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);

    if (p.climbing) {
      const ladder = p.climbing;
      if (dx !== 0) {
        p.climbing = null;
        p.facing = dx;
      } else {
        p.x = ladder.x - p.w / 2;
        const dir = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
        p.y = clamp(p.y + dir * CLIMB_SPEED * dt, ladder.top - p.h, ladder.bottom - p.h);

        if (dir < 0 && p.y <= ladder.top - p.h) {
          p.y = ladder.top - p.h;
          p.climbing = null;
          p.vy = 0;
        } else if (dir > 0 && p.y >= ladder.bottom - p.h) {
          p.y = ladder.bottom - p.h;
          p.climbing = null;
          p.vy = 0;
        }
        return;
      }
    }

    if (dx !== 0) p.facing = dx;

    const speed = MOVE_SPEED * (has('helmet') ? 1.25 : 1);
    p.x = clamp(p.x + dx * speed * dt, WALL_L + 4, WALL_R - p.w - 4);

    const prevBottom = p.y + p.h;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;

    for (const fy of FLOOR_YS) {
      if (p.vy > 0 && prevBottom <= fy + 1 && p.y + p.h >= fy) {
        p.y = fy - p.h;
        p.vy = 0;
        break;
      }
    }

    for (const ladder of LADDERS) {
      if (Math.abs(p.x + p.w / 2 - ladder.x) > 16) continue;
      const bottom = p.y + p.h;
      if (keys.has('up') && Math.abs(bottom - ladder.bottom) < 2) {
        p.climbing = ladder;
        p.x = ladder.x - p.w / 2;
        p.vy = 0;
        return;
      }
      if (keys.has('down') && Math.abs(p.y - (ladder.top - p.h)) < 2) {
        p.climbing = ladder;
        p.x = ladder.x - p.w / 2;
        p.vy = 0;
        return;
      }
    }
  }

  function nearestSpot() {
    const feet = player.y + player.h;
    let best = null;
    let bestDist = Infinity;
    for (const spot of game.spots) {
      if (spot.done) continue;
      if (Math.abs(FLOOR_YS[spot.floor] - feet) > 3) continue;
      const dist = Math.abs(player.x + player.w / 2 - spot.x);
      if (dist < REACH && dist < bestDist) {
        best = spot;
        bestDist = dist;
      }
    }
    return best;
  }

  function tryInstall() {
    if (game.state !== 'play' || installing.timer > 0) return;
    const spot = nearestSpot();
    if (!spot) return;
    const total = 0.95 * (has('screwdriver') ? 0.55 : 1);
    installing = { timer: total, total, spot };
    beep(520, 0.05, 'square');
  }

  function comboMultiplier() {
    return 1 + Math.min(Math.max(game.combo - 1, 0), 10) * 0.1;
  }

  function finishInstall() {
    const spot = installing.spot;
    if (!spot) {
      installing = { timer: 0, total: 0, spot: null };
      return;
    }
    const device = DEVICES[spot.type];
    spot.done = true;
    game.installed += 1;

    let base = device.points;
    if (spot.type === 'heat' && has('thermal')) base *= 2;
    if (has('multimeter')) base += 10;
    if (has('partner')) base = Math.round(base * 1.2);

    game.combo += 1;
    game.comboTimer = 7;

    const gained = Math.round(base * comboMultiplier());
    game.score += gained;

    addFloater(spot.x, spot.y - 14, '+' + gained, device.color);
    spawnSparks(spot.x, spot.y, device.color);
    beep(880, 0.07, 'triangle');

    installing = { timer: 0, total: 0, spot: null };
    updateHud();

    if (game.score > game.best) {
      game.best = game.score;
      saveBest();
    }

    if (game.installed >= game.goal) completeLevel();
  }

  function completeLevel() {
    game.state = 'levelup';
    beep(1046, 0.12, 'sine');
    const nextUnlock = UNLOCKS[game.level + 1];
    let text = 'Смена ' + game.level + ' закрыта. Устройств: ' + game.goal + '. Очки: ' + game.score + '.';
    ovTitle.textContent = 'Смена закрыта!';
    ovText.textContent = text;

    if (nextUnlock) {
      ovUnlock.innerHTML =
        '<div class="unlock"><span class="badge">НОВОЕ</span><b>' +
        nextUnlock.name +
        '</b><span>' +
        nextUnlock.desc +
        '</span></div>';
    } else {
      ovUnlock.innerHTML =
        '<div class="unlock"><span class="badge">ДАЛЬШЕ</span><b>Без ограничений</b><span>Задания продолжают расти — держи темп.</span></div>';
    }

    overlay.classList.remove('hidden');
  }

  function nextLevel() {
    if (game.state !== 'levelup') return;
    startLevel(game.level + 1);
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    const id = ++toastId;
    window.setTimeout(() => {
      if (id === toastId) toastEl.classList.add('hidden');
    }, 3200);
  }

  // ---------- частицы ----------
  function addFloater(x, y, text, color) {
    game.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  function spawnSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      game.sparks.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 120,
        vy: -Math.random() * 90,
        life: 0.5 + Math.random() * 0.3,
        color,
      });
    }
  }

  function updateEffects(dt) {
    for (let i = game.floaters.length - 1; i >= 0; i--) {
      const f = game.floaters[i];
      f.life -= dt;
      f.y -= 32 * dt;
      if (f.life <= 0) game.floaters.splice(i, 1);
    }
    for (let i = game.sparks.length - 1; i >= 0; i--) {
      const s = game.sparks[i];
      s.life -= dt;
      s.vy += 520 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) game.sparks.splice(i, 1);
    }
  }

  // ---------- обновление ----------
  function update(dt) {
    game.time += dt;

    if (game.state === 'play') {
      if (installing.timer > 0) {
        installing.timer -= dt;
        if (installing.timer <= 0) finishInstall();
      } else {
        movePlayer(dt);
      }

      if (game.combo > 0 && !has('radio') && installing.timer <= 0) {
        game.comboTimer -= dt;
        if (game.comboTimer <= 0) {
          game.combo = 0;
          game.comboTimer = 0;
        }
      }

      updateEffects(dt);
    }
  }

  function updateHud() {
    setText(hud.level, String(game.level));
    setText(hud.score, String(game.score));
    setText(hud.goal, game.installed + ' / ' + game.goal);
    setText(hud.combo, game.combo > 0 ? 'x' + comboMultiplier().toFixed(1) : '—');
    setText(hud.best, String(game.best));
  }

  function buildTools() {
    if (!toolsEl) return;
    const items = [];
    for (const [key, device] of Object.entries(DEVICES)) {
      if (device.unlock > game.level) continue;
      items.push(
        '<span class="chip"><i style="background:' +
          device.color +
          '"></i>' +
          device.name +
          '<em>+' +
          device.points +
          '</em></span>'
      );
    }
    for (const [level, unlock] of Object.entries(UNLOCKS)) {
      if (Number(level) > game.level) continue;
      items.push('<span class="chip feature">⚡ ' + unlock.name + '</span>');
    }
    toolsEl.innerHTML = items.join('');
  }

  // ---------- отрисовка ----------
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a1224');
    sky.addColorStop(0.55, '#0e1a33');
    sky.addColorStop(1, '#0b1526');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#131d33';
    ctx.fillRect(WALL_L - 16, TOP_Y, WALL_R - WALL_L + 32, H - TOP_Y - 44);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = WALL_L; x < WALL_R; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, TOP_Y);
      ctx.lineTo(x, H - 44);
      ctx.stroke();
    }

    // окна с ночным городом
    drawWindow(90, 80, 150, 58);
    drawWindow(700, 80, 170, 58);
    drawWindow(430, 80, 130, 58);

    // трубы вдоль стены
    ctx.strokeStyle = '#243352';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(WALL_R - 74, TOP_Y + 4);
    ctx.lineTo(WALL_R - 74, H - 50);
    ctx.stroke();
    ctx.strokeStyle = '#2f4166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WALL_R - 77, TOP_Y + 4);
    ctx.lineTo(WALL_R - 77, H - 50);
    ctx.stroke();

    // щит на первом этаже
    ctx.fillStyle = '#1c2a45';
    rr(WALL_L + 16, FLOOR_YS[0] + 16, 66, 52, 6);
    ctx.fill();
    ctx.strokeStyle = '#2f4166';
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(WALL_L + 26 + i * 14, FLOOR_YS[0] + 28, 6, 4);
    }
    ctx.fillStyle = '#334155';
    ctx.fillRect(WALL_L + 24, FLOOR_YS[0] + 44, 48, 4);
  }

  function drawWindow(x, y, w, h) {
    ctx.fillStyle = '#0b1628';
    ctx.fillRect(x, y, w, h);
    const glow = ctx.createLinearGradient(0, y, 0, y + h);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    glow.addColorStop(1, 'rgba(56, 189, 248, 0.03)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2f4166';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.stroke();
  }

  function drawFloor(fy) {
    const x = WALL_L - 12;
    const w = WALL_R - WALL_L + 24;
    ctx.fillStyle = '#1b2740';
    ctx.fillRect(x, fy, w, 14);
    ctx.fillStyle = '#2c3c5f';
    ctx.fillRect(x, fy, w, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, fy + 14, w, 4);
  }

  function drawLadder(ladder) {
    const x = ladder.x;
    ctx.strokeStyle = '#8ea3c4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 9, ladder.top);
    ctx.lineTo(x - 9, ladder.bottom);
    ctx.moveTo(x + 9, ladder.top);
    ctx.lineTo(x + 9, ladder.bottom);
    ctx.stroke();

    ctx.strokeStyle = '#6d82a6';
    ctx.lineWidth = 2;
    for (let y = ladder.top + 9; y < ladder.bottom; y += 18) {
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.stroke();
    }
  }

  function drawSpot(spot, activeSpot) {
    if (spot.done) {
      drawDevice(spot.x, spot.y, spot.type);
      return;
    }
    const device = DEVICES[spot.type];
    const pulse = 0.55 + 0.45 * Math.sin(game.time * 3 + spot.blink);
    const inReach = activeSpot === spot;

    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.shadowColor = device.color;
    ctx.shadowBlur = inReach ? 18 : 8;
    ctx.strokeStyle = 'rgba(148, 163, 184, ' + (0.45 + 0.35 * pulse).toFixed(2) + ')';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    rr(-14, -14, 28, 28, 6);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(148, 163, 184, ' + (0.55 + 0.45 * pulse).toFixed(2) + ')';
    ctx.fillRect(-1.5, -7, 3, 14);
    ctx.fillRect(-7, -1.5, 14, 3);
    ctx.restore();

    if (inReach) {
      ctx.save();
      ctx.fillStyle = '#bfdbfe';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ПРОБЕЛ', spot.x, spot.y - 26);
      ctx.restore();
    }
  }

  function drawDevice(x, y, type) {
    ctx.save();
    ctx.translate(x, y);
    const blink = 0.55 + 0.45 * Math.sin(game.time * 6 + x);

    if (type === 'smoke') {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.stroke();
      }
    } else if (type === 'manual') {
      ctx.fillStyle = '#b91c1c';
      rr(-10, -12, 20, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#fecaca';
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-6, 7, 12, 3);
    } else if (type === 'heat') {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.lineTo(4, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'siren') {
      ctx.fillStyle = '#facc15';
      rr(-11, -8, 22, 16, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, ' + blink.toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, -0.9, 0.9);
      ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = '#38bdf8';
      rr(-11, -13, 22, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(-7, -8, 14, 6);
      ctx.fillStyle = 'rgba(74, 222, 128, ' + blink.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(-5, 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(248, 113, 113, ' + blink.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(0, 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(250, 204, 21, ' + blink.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(5, 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // крепление к стене
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    const walking = game.state === 'play' && installing.timer <= 0 && !p.climbing && (keys.has('left') || keys.has('right'));
    const bob = walking ? Math.sin(game.time * 16) * 1.5 : 0;

    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, bob);

    // ноги
    ctx.fillStyle = '#1f2937';
    const legPhase = walking ? Math.sin(game.time * 16) * 3 : 0;
    ctx.fillRect(-7, -12 + legPhase * 0.4, 6, 12);
    ctx.fillRect(1, -12 - legPhase * 0.4, 6, 12);

    // жилет
    ctx.fillStyle = '#f97316';
    rr(-9, -30, 18, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-9, -26, 18, 3);
    ctx.fillRect(-9, -19, 18, 3);

    // руки
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(-12, -28, 4, 14);
    ctx.fillRect(8, -28, 4, 14);

    // инструмент в руке
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(12, -22, 3, 10);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(11, -24, 5, 4);

    // голова
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, -35, 6, 0, Math.PI * 2);
    ctx.fill();

    // каска
    ctx.fillStyle = has('helmet') ? '#fde047' : '#eab308';
    ctx.beginPath();
    ctx.arc(0, -38, 7.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-9, -38.5, 18, 2.6);

    // усталое лицо
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(1.5, -36, 2, 1.5);

    ctx.restore();
  }

  function drawInstallProgress() {
    if (installing.timer <= 0) return;
    const ratio = 1 - installing.timer / installing.total;
    const cx = player.x + player.w / 2;
    const cy = player.y - 14;

    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#4ade80';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawEffects() {
    for (const f of game.floaters) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    for (const s of game.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life * 2);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      ctx.restore();
    }
  }

  function draw() {
    drawBackground();
    for (const fy of FLOOR_YS) drawFloor(fy);
    for (const ladder of LADDERS) drawLadder(ladder);
    const activeSpot = nearestSpot();
    for (const spot of game.spots) drawSpot(spot, activeSpot);
    drawPlayer();
    drawInstallProgress();
    drawEffects();

    ctx.fillStyle = 'rgba(7, 11, 22, 0.85)';
    ctx.fillRect(0, H - 34, W, 34);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Объект: БЦ «Заря» · монтаж АПС', 18, H - 13);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Смена ' + game.level + ' · осталось ' + (game.goal - game.installed), W - 18, H - 13);
  }

  // ---------- управление ----------
  const KEYMAP = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyW: 'up',
    KeyS: 'down',
    Space: 'action',
    KeyE: 'action',
    Enter: 'enter',
    KeyR: 'restart',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return;

    if (action === 'restart') {
      resetGame();
      return;
    }
    if (action === 'enter') {
      nextLevel();
      return;
    }
    if (action === 'action') {
      tryInstall();
      return;
    }
    keys.add(action);
  });

  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });

  window.addEventListener('blur', () => keys.clear());

  ovBtn.addEventListener('click', nextLevel);

  // экранные кнопки для телефона
  const touchButtons = document.querySelectorAll('[data-k]');
  touchButtons.forEach((button) => {
    const key = button.getAttribute('data-k');
    const press = (e) => {
      e.preventDefault();
      if (key === 'action') {
        tryInstall();
        return;
      }
      keys.add(key);
    };
    const release = (e) => {
      if (e) e.preventDefault();
      keys.delete(key);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---------- запуск ----------
  function fitStage() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const maxW = Math.min(window.innerWidth - 24, 1000);
    const maxH = Math.max(150, window.innerHeight - (coarse ? 230 : 200));
    const scale = Math.min(maxW / W, maxH / H, 1);
    canvas.style.width = Math.round(W * scale) + 'px';
    canvas.style.height = Math.round(H * scale) + 'px';
  }

  window.addEventListener('resize', fitStage);
  fitStage();

  window.__aps = {
    game,
    player,
    keys,
    unlocked,
    spots: () => game.spots,
    floors: FLOOR_YS,
    startLevel,
    tryInstall,
    nextLevel,
    resetGame,
  };

  game.best = loadBest();
  startLevel(1);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw();
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
