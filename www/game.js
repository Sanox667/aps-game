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
    time: document.getElementById('hud-time'),
    timeCard: document.getElementById('stat-time'),
  };
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const ovUnlock = document.getElementById('ov-unlock');
  const ovBtn = document.getElementById('ov-btn');
  const toastEl = document.getElementById('toast');
  const muteBtn = document.getElementById('btn-sound');
  const stageEl = document.getElementById('stage');

  // ---------- константы сцены ----------
  const WALL_L = 56;
  const WALL_R = 904;
  const TOP_Y = 60;
  const GRAVITY = 1600;
  const MOVE_SPEED = 190;
  const CLIMB_SPEED = 140;
  const REACH = 56;
  const PLAYER_W = 22;
  const PLAYER_H = 36;
  const BOX_X = WALL_L + 34; // распаячная коробка на каждом этаже
  const PANEL_X = WALL_L + 46; // щит АПС на первом этаже

  // ---------- объекты (уровни-сцены) ----------
  // pace: множитель времени (больше = легче). dark: затемнение. crates: ящики. boss: сцена босса.
  const OBJECTS = [
    {
      name: 'БЦ «Заря»', floors: 4, extra: ['smoke'], pace: 1,
      pal: { sky1: '#0a1224', sky2: '#0e1a33', wall: '#131d33', beam: '56, 189, 248', wire: '#38bdf8', light: '#fcd34d' },
    },
    {
      name: 'Школа №14', floors: 4, extra: ['manual', 'heat'], pace: 1.05, dark: 0.24,
      pal: { sky1: '#0a1420', sky2: '#0d1e2c', wall: '#12261e', beam: '74, 222, 128', wire: '#4ade80', light: '#a3e635' },
    },
    {
      name: 'Склад «Гранит»', floors: 5, extra: ['smoke', 'heat'], pace: 1.1, crates: true,
      pal: { sky1: '#171208', sky2: '#221a08', wall: '#2a2110', beam: '250, 204, 21', wire: '#eab308', light: '#fde047' },
    },
    {
      name: 'ТЦ «Меридиан»', floors: 3, extra: ['siren', 'siren'], pace: 1.08,
      pal: { sky1: '#150a26', sky2: '#1c0f33', wall: '#221238', beam: '192, 132, 252', wire: '#c084fc', light: '#f0abfc' },
    },
    {
      name: 'Стадион «Факел»', floors: 4, extra: ['siren'], pace: 1.15, boss: true,
      pal: { sky1: '#240a0a', sky2: '#331212', wall: '#331a1a', beam: '248, 113, 113', wire: '#f87171', light: '#fca5a5' },
    },
    {
      name: 'Больница «Надежда»', floors: 5, extra: ['smoke', 'manual', 'heat'], pace: 0.95, dark: 0.18,
      pal: { sky1: '#0a1a18', sky2: '#0c241e', wall: '#16322a', beam: '110, 231, 183', wire: '#6ee7b7', light: '#a7f3d0' },
    },
    {
      name: 'Офис «Синева»', floors: 4, extra: ['siren'], pace: 0.92,
      pal: { sky1: '#081226', sky2: '#0c1830', wall: '#14203c', beam: '96, 165, 250', wire: '#60a5fa', light: '#93c5fd' },
    },
    {
      name: 'Завод «Прогресс»', floors: 5, extra: ['heat', 'siren'], pace: 1, crates: true, dark: 0.12,
      pal: { sky1: '#160d07', sky2: '#20130a', wall: '#2c1c0d', beam: '214, 155, 58', wire: '#d97706', light: '#fcd34d' },
    },
    {
      name: 'Аэропорт «Крыло»', floors: 3, extra: ['siren', 'panel'], pace: 1,
      pal: { sky1: '#060d1d', sky2: '#0a1428', wall: '#131f3a', beam: '125, 211, 252', wire: '#38bdf8', light: '#bae6fd' },
    },
    {
      name: 'Энергоблок «Аврора»', floors: 5, extra: ['siren', 'panel'], pace: 1.05, boss: true,
      pal: { sky1: '#1a0b26', sky2: '#26103a', wall: '#2c1440', beam: '232, 121, 249', wire: '#e879f9', light: '#f5d0fe' },
    },
  ];

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
    3: { id: 'crimper', name: 'Пресс-клещи', desc: 'Кабели прокладываются вдвое быстрее' },
    4: { id: 'radio', name: 'Рация', desc: 'Комбо больше не сбрасывается' },
    5: { id: 'helmet', name: 'Каска', desc: 'Скорость передвижения +25%' },
    6: { id: 'multimeter', name: 'Мультиметр', desc: '+10 очков за каждое устройство' },
    7: { id: 'partner', name: 'Напарник', desc: '+20% очков за установку' },
  };

  const unlocked = new Set();
  const has = (id) => unlocked.has(id);

  // ================= ПЕРСОНАЖИ =================
  // luck: шанс успешного монтажа; fall: шанс свалиться с лестницы при подъёме
  // stats: множители времени (install/cable — больше = медленнее), speed/climb — больше = быстрее
  const CHARACTERS = [
    { id: 'sol', name: 'Соль', emoji: '⚡', luck: 0.30, fall: 0.06, speed: 1.35, climb: 1.2, install: 0.5, cable: 1,
      desc: 'Офигенно быстрый монтаж, но криво: половину переделывать. Ловится часто.' },
    { id: 'ilyusha', name: 'Илюша', emoji: '🧓', luck: 0.70, fall: 0.01, speed: 0.9, climb: 0.9, install: 1.7, cable: 1.1,
      desc: '95 лет стажа, но работает как в первый раз. Медленно и надёжно.' },
    { id: 'kalmar', name: 'Кальмар', emoji: '🦑', luck: 0.90, fall: 0.01, speed: 0.75, climb: 0.85, install: 1.85, cable: 0.9,
      desc: 'Делает медленно, зато качественно и красиво. Брак — редкость.' },
    { id: 'dima', name: 'Дима который Игорь', emoji: '🚿', luck: 0.50, fall: 0.03, speed: 0.7, climb: 0.8, install: 2.15, cable: 1, plumber: true,
      desc: 'Очень медленно, но хороший сантехник. Промахнётся — поставит кран.' },
    { id: 'volodya', name: 'Володя', emoji: '😤', luck: 0.60, fall: 0.05, speed: 1.1, climb: 1.1, install: 0.85, cable: 1, bossPass: true,
      desc: 'Агрессивный, ругается с коллегами. На босс-объекте с шансом 60% проходит без монтажа.' },
    { id: 'shavkat', name: 'Шавкат', emoji: '👷', luck: 0.55, fall: 0.02, speed: 1, climb: 1, install: 1.15, cable: 1.15, squad: true,
      desc: 'Бригадир. С шансом 30% призывает бригаду из 5 узбеков на весь объект.' },
  ];
  function loadCharId() {
    try {
      const id = localStorage.getItem('aps_char');
      return CHARACTERS.some((c) => c.id === id) ? id : 'sol';
    } catch (e) { return 'sol'; }
  }

  const keys = new Set();
  const player = {
    x: 100, y: 520 - PLAYER_H, w: PLAYER_W, h: PLAYER_H,
    vy: 0, climbing: null, facing: 1, stun: 0, walkAcc: 0,
  };

  const game = {
    level: 1, score: 0, installed: 0, goal: 5,
    combo: 0, comboTimer: 0, timeText: '', shiftTime: 0, shiftLimit: 0,
    timeouts: 0, time: 0, state: 'play', acceptance: false,
    spots: [], cables: [], floaters: [], sparks: [], dust: [],
    best: 0, object: OBJECTS[0], floorYs: [], ladders: [],
    char: null, // задаётся при загрузке в самом низу
    debuff: null, eventTimer: 18,
    buffState: {}, buffTimer: 24, buffs: [],
    squad: [], bossPass: false,
    leninTimer: 12,
    droneTimer: 15, inspectTimer: 30, flood: null,
    maxTimer: 20,
  };

  let installing = { timer: 0, total: 0, spot: null, kind: null };
  let toastId = 0;
  let shake = 0;
  let boss = null;
  let lenin = null; // начальник Ленин: гуляет и тянет монтажника на перекур
  let drone = null; // дрон прораба: облетает объект, может упасть — стройка заново
  let max = null; // строгий Макс: выгоняет Ленина и срывает перекуры

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function rr(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
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
      const v = Number(localStorage.getItem('aps_best'));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    } catch (e) { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem('aps_best', String(game.best)); } catch (e) { /* приватный режим */ }
  }

  // ================= ЗВУК =================
  const AudioSys = {
    ctx: null, master: null, muted: false,
    drill: null, sirenTimer: 0,

    ensure() {
      try {
        if (!this.ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return false;
          this.ctx = new C();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.5;
          this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return true;
      } catch (e) { return false; }
    },
    unlock() { this.ensure(); },
    tone(freq, dur, type, vol, slideTo) {
      try {
        if (!this.ensure() || this.muted) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type || 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        g.gain.setValueAtTime(vol || 0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(this.master);
        osc.start(t); osc.stop(t + dur + 0.02);
      } catch (e) { /* без звука */ }
    },
    noise(dur, freq, vol) {
      try {
        if (!this.ensure() || this.muted) return;
        const t = this.ctx.currentTime;
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol || 0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(this.master);
        src.start(t); src.stop(t + dur);
      } catch (e) { /* без звука */ }
    },
    installStart() {
      try {
        if (!this.ensure() || this.muted || this.drill) return;
        const len = Math.floor(this.ctx.sampleRate * 0.4);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.5;
        const g = this.ctx.createGain();
        g.gain.value = 0.05;
        const lfo = this.ctx.createOscillator();
        const lg = this.ctx.createGain();
        lfo.frequency.value = 14; lg.gain.value = 0.03;
        lfo.connect(lg).connect(g.gain);
        src.connect(f).connect(g).connect(this.master);
        src.start(); lfo.start();
        this.drill = { src, g, lfo };
      } catch (e) { /* без звука */ }
    },
    installStop() {
      try {
        if (this.drill) {
          this.drill.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
          this.drill.src.stop(this.ctx.currentTime + 0.12);
          this.drill.lfo.stop(this.ctx.currentTime + 0.12);
          this.drill = null;
        }
      } catch (e) { this.drill = null; }
    },
    siren() {
      // двухтональная сирена: три качка
      if (this.muted) return;
      for (let i = 0; i < 3; i++) {
        const d = 0.34;
        this.tone(860, d, 'square', 0.05, 520);
        if (i < 2) this.tone(640, d, 'square', 0.05, 900);
      }
    },
    step() { this.noise(0.04, 520, 0.05); },
    clank() { this.tone(180, 0.07, 'square', 0.06); this.noise(0.05, 1600, 0.04); },
    win() { [660, 880, 1100].forEach((f, i) => window.setTimeout(() => this.tone(f, 0.09, 'sine', 0.1), i * 60)); },
    comboUp() { this.tone(760, 0.08, 'sine', 0.08, 1150); },
    levelEnd() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => this.tone(f, 0.13, 'sine', 0.11), i * 110)); },
    tick() { this.tone(1200, 0.05, 'square', 0.07); },
    caught() { this.tone(300, 0.35, 'sawtooth', 0.1, 90); },
    angry() { this.tone(140, 0.5, 'sawtooth', 0.1, 70); },
    alarm() { this.siren(); this.angry(); },
    setMuted(m) {
      this.muted = m;
      try { if (this.master) this.master.gain.value = m ? 0 : 0.5; } catch (e) { /* нет контекста */ }
      try { localStorage.setItem('aps_muted', m ? '1' : '0'); } catch (e) { /* приватный режим */ }
      if (m) this.installStop();
      if (muteBtn) muteBtn.textContent = m ? '🔇' : '🔊';
    },
  };
  try {
    AudioSys.muted = localStorage.getItem('aps_muted') === '1';
    if (muteBtn) muteBtn.textContent = AudioSys.muted ? '🔇' : '🔊';
  } catch (e) { /* localStorage недоступен */ }

  // ================= УРОВЕНЬ =================
  function floorYsFor(n) {
    if (n === 3) return [180, 340, 520];
    if (n === 5) return [160, 250, 340, 430, 520];
    return [160, 280, 400, 520];
  }

  function buildLadders(n) {
    const ys = game.floorYs;
    const xs = [690, 170, 480, 800, 260, 590, 400, 720];
    const out = [];
    for (let i = 0; i < n - 1; i++) {
      const a = xs[(i * 2) % xs.length];
      const b = xs[(i * 2 + 3) % xs.length];
      out.push({ x: a, upper: i, lower: i + 1, top: ys[i], bottom: ys[i + 1] });
      out.push({ x: b, upper: i, lower: i + 1, top: ys[i], bottom: ys[i + 1] });
    }
    return out;
  }

  function nearLadder(floor, x, dist) {
    const fy = game.floorYs[floor];
    return game.ladders.some((l) => (l.top === fy || l.bottom === fy) && Math.abs(l.x - x) < dist);
  }

  const WINDOW_ZONES = [[82, 248], [422, 568], [692, 878]];
  function inWindowZone(x) { return WINDOW_ZONES.some((z) => x > z[0] && x < z[1]); }

  function devicePool(level) {
    const obj = game.object;
    const pool = Object.keys(DEVICES).filter((k) => DEVICES[k].unlock <= level);
    for (const e of obj.extra || []) if (!pool.includes(e)) pool.push(e);
    return pool;
  }

  function generateSpots() {
    const ys = game.floorYs;
    const n = ys.length;
    const pool = devicePool(game.level);
    const perFloor = Array.from({ length: n }, () => []);
    for (let f = 0; f < n; f++) {
      let x = WALL_L + 150;
      while (x < WALL_R - 40) {
        x += randInt(84, 150);
        if (x >= WALL_R - 40) break;
        if (nearLadder(f, x, 60)) continue;
        if (f === 0 && inWindowZone(x)) continue;
        if (f === n - 1 && Math.abs(x - PANEL_X) < 90) continue;
        if (f === n - 1 && Math.abs(x - BOX_X) < 70) continue;
        perFloor[f].push(x);
      }
    }
    const spots = [];
    const type = () => pool[randInt(0, pool.length - 1)];
    // равномерно по этажам, round-robin, чтобы ёмкость сходилась
    const need = game.goal;
    let row = 0;
    let attempts = 0;
    while (spots.length < need && attempts++ < 2000) {
      let added = false;
      for (let f = 0; f < n && spots.length < need; f++) {
        const list = perFloor[f];
        if (list.length > row) {
          const x = list[randInt(0, list.length - 1)];
          if (!spots.some((s) => s.floor === f && Math.abs(s.x - x) < 72)) {
            spots.push({ x, floor: f, y: ys[f] - 58, type: type(), done: false, cabled: false, cableT: 0, blink: Math.random() * 6.28 });
            added = true;
          }
        }
      }
      if (!added) row++;
      if (row > 60) break;
    }
    return spots;
  }

  function startLevel(n) {
    game.level = n;
    game.object = OBJECTS[(n - 1) % OBJECTS.length];
    // «круг» сложности: 2-й круг тех же объектов — таймеры короче, босс злее
    game.cycle = Math.floor((n - 1) / OBJECTS.length);
    game.floorYs = floorYsFor(game.object.floors);
    game.ladders = buildLadders(game.object.floors);

    game.goal = Math.min(400, 5 + (n - 1) * 2);
    const capacity = generateSpotsPreview();
    if (capacity < game.goal) game.goal = Math.max(1, capacity);

    game.spots = generateSpots();
    if (game.spots.length < game.goal) game.goal = Math.max(1, game.spots.length);

    game.installed = 0;
    game.combo = 0;
    game.comboTimer = 0;
    game.timeouts = 0;
    game.acceptance = false;
    const diff = Math.max(0.6, 1 - 0.07 * game.cycle);
    game.shiftLimit = Math.round((38 + game.goal * 9) * game.object.pace * (game.object.boss ? 1.2 : 1) * diff);
    game.shiftTime = game.shiftLimit;
    game.cables = [];
    game.floaters.length = 0;
    game.sparks.length = 0;
    game.state = 'play';
    installing = { timer: 0, total: 0, spot: null, kind: null };
    shake = 0;
    keys.clear();

    player.x = PANEL_X + 50;
    player.y = game.floorYs[game.floorYs.length - 1] - player.h;
    player.vy = 0;
    player.climbing = null;
    player.facing = 1;
    player.stun = 0;

    boss = game.object.boss ? makeBoss() : null;

    // ---- персональные механики ----
    if (!game.char) game.char = CHARACTERS.find((c) => c.id === loadCharId());
    game.debuff = null;
    game.eventTimer = 18 + Math.random() * 10;
    game.buffTimer = 22 + Math.random() * 10;
    game.buffState = {};
    game.buffs = [];
    game.squad = [];
    game.bossPass = false;
    lenin = null;
    game.leninTimer = 6 + Math.random() * 6; // Ленин приходит рано — не даёт расслабиться
    drone = null;
    game.droneTimer = 15 + Math.random() * 15;
    game.inspectTimer = 26 + Math.random() * 22;
    game.flood = null;
    max = null;
    game.maxTimer = 14 + Math.random() * 18;
    game.failsAtLevel = 0; // счёт срывов сдейла на этом объекте

    if (game.char.squad && Math.random() < 0.3) {
      const n = Math.min(5, game.floorYs.length);
      for (let i = 0; i < n; i++) {
        game.squad.push({
          floor: i, x: randInt(WALL_L + 120, WALL_R - 60), timer: 2.5 + i * 1.7,
          w: 20, h: 32, job: null,
        });
      }
      showToast('Бригада удалась: ' + n + ' узбеков работают по каждому этажу!');
      AudioSys.win();
    } else if (game.char.squad) {
      showToast('Бригада сегодня не приехала — работаем в одиночку.');
    }

    if (game.object.boss && game.char.bossPass && Math.random() < 0.6) {
      game.bossPass = true;
      startAcceptance();
      showToast('Володя зарулил на словах: приёмка сразу, монтаж не нужен!');
    }

    if (UNLOCKS[n]) {
      unlocked.add(UNLOCKS[n].id);
      showToast('Новая функция: ' + UNLOCKS[n].name + ' — ' + UNLOCKS[n].desc);
    }

    AudioSys.siren();
    if (game.cycle > 0 && (n - 1) % OBJECTS.length === 0) {
      showToast('Круг ' + (game.cycle + 1) + ': таймеры короче, босс злее. Держи темп!');
    }
    hideOverlay();
    updateHud();
  }

  // ёмкость этажей под goal: сколько всего мест
  function generateSpotsPreview() {
    const ys = game.floorYs;
    const n = ys.length;
    const savedGoal = game.goal;
    game.goal = 400;
    const perFloor = Array.from({ length: n }, () => 0);
    for (let f = 0; f < n; f++) {
      let x = WALL_L + 150;
      let c = 0;
      while (x < WALL_R - 40) {
        x += 84;
        if (x >= WALL_R - 40) break;
        if (nearLadder(f, x, 60)) continue;
        if (f === 0 && inWindowZone(x)) continue;
        if (f === n - 1 && Math.abs(x - PANEL_X) < 90) continue;
        if (f === n - 1 && Math.abs(x - BOX_X) < 70) continue;
        c++;
      }
      perFloor[f] = c;
    }
    game.goal = savedGoal;
    return perFloor.reduce((a, b) => a + b, 0);
  }

  function makeBoss() {
    const cycle = game.cycle || 0;
    return {
      x: WALL_R - 120, floor: 0, y: game.floorYs[0] - 40,
      w: 26, h: 40,
      speed: Math.min(150, 92 + game.level * 1.6 + cycle * 10),
      reach: 28 + cycle * 2,
      dir: -1, mode: 'patrol', wait: 0, angry: 0, cooldown: 0,
    };
  }

  function resetGame() {
    unlocked.clear();
    game.score = 0;
    game.best = loadBest();
    startLevel(1);
  }

  // ================= ВЫБОР ПЕРСОНАЖА =================
  function openSelect() {
    game.state = 'select';
    ovTitle.textContent = 'Кто сегодня на объекте?';
    ovText.textContent = '';
    const saved = loadCharId();
    ovUnlock.innerHTML = CHARACTERS.map((c, i) =>
      '<button class="charcard' + (c.id === saved ? ' active' : '') + '" data-char="' + c.id + '">' +
      '<span class="ce">' + c.emoji + '</span>' +
      '<span class="cn">' + (i + 1) + '. ' + c.name + '</span>' +
      '<span class="cd">' + c.desc + '</span>' +
      '<span class="cs">удача ' + Math.round(c.luck * 100) + '% · падение ' + Math.round(c.fall * 100) + '%</span></button>'
    ).join('');
    ovBtn.hidden = true;
    overlay.classList.remove('hidden');
  }

  function chooseChar(id) {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return;
    game.char = c;
    try { localStorage.setItem('aps_char', id); } catch (e) { /* приватный режим */ }
    resetGame();
    ovBtn.hidden = false;
    showToast('Сегодня работает ' + c.name + '. ' + c.desc);
  }

  // ================= ИГРОК =================
  function moveMutators() {
    const wet = game.debuff && game.debuff.type === 'wet';
    return {
      speed: (game.char ? game.char.speed : 1) * (wet ? 0.8 : 1) * (game.buffState.turbo ? 1.35 : 1),
      climb: (game.char ? game.char.climb : 1) * (wet ? 0.85 : 1),
      fall: (game.char ? game.char.fall : 0) * (wet ? 3 : 1),
    };
  }

  function speedFactor() {
    return MOVE_SPEED * (has('helmet') ? 1.25 : 1) * moveMutators().speed;
  }

  function movePlayer(dt) {
    const p = player;
    if (p.stun > 0) { p.stun -= dt; return; }
    let dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);

    // Ленин зовёт на перекур: монтажник бежит сам, игрок временно без руля
    const forced = leninForce();
    if (forced) {
      const L = lenin;
      if (L.state === 'smoke') dx = 0;
      else {
        dx = Math.sign(L.x - (p.x + p.w / 2));
        if (dx === 0) dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
      }
      if (p.climbing) { p.climbing = null; p.vy = 0; }
    }

    if (p.climbing) {
      const ladder = p.climbing;
      if (dx !== 0) {
        p.climbing = null;
        p.facing = dx;
      } else {
        p.x = ladder.x - p.w / 2;
        const dir = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
        p.y = clamp(p.y + dir * CLIMB_SPEED * moveMutators().climb * dt, ladder.top - p.h, ladder.bottom - p.h);
        if (dir < 0 && p.y <= ladder.top - p.h) { p.climbing = null; p.vy = 0; }
        else if (dir > 0 && p.y >= ladder.bottom - p.h) { p.climbing = null; p.vy = 0; }
        return;
      }
    }

    if (dx !== 0) p.facing = dx;
    p.x = clamp(p.x + dx * speedFactor() * dt, WALL_L + 4, WALL_R - p.w - 4);

    if (dx !== 0 && installing.timer <= 0) {
      p.walkAcc += Math.abs(dx) * speedFactor() * dt;
      if (p.walkAcc > 30) { p.walkAcc = 0; AudioSys.step(); }
    }

    const prevBottom = p.y + p.h;
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    for (const fy of game.floorYs) {
      if (p.vy > 0 && prevBottom <= fy + 1 && p.y + p.h >= fy) { p.y = fy - p.h; p.vy = 0; break; }
    }

    for (const ladder of game.ladders) {
      if (leninForce()) break; // на перекуре руками по лестницам не лазаем
      if (Math.abs(p.x + p.w / 2 - ladder.x) > 16) continue;
      const bottom = p.y + p.h;
      if (keys.has('up') && Math.abs(bottom - ladder.bottom) < 3) { grab(ladder); return; }
      if (keys.has('down') && Math.abs(p.y - (ladder.top - p.h)) < 3) { grab(ladder); return; }
    }
  }

  function grab(ladder) {
    const m = moveMutators();
    if (Math.random() < m.fall) {
      // свалился с лестницы
      player.climbing = null;
      player.x = ladder.x - player.w / 2;
      player.y = ladder.bottom - player.h;
      player.vy = 0;
      player.stun = 0.5;
      game.combo = 0;
      game.comboTimer = 0;
      shake = 6;
      AudioSys.caught();
      addFloater(ladder.x, ladder.bottom - 60, 'СВАЛИЛСЯ!', '#f87171');
      showToast('Свалился с лестницы! Комбо сгорело.');
      return;
    }
    player.climbing = ladder;
    player.x = ladder.x - player.w / 2;
    player.vy = 0;
    AudioSys.clank();
  }

  function onFloorPlayer() {
    const feet = player.y + player.h;
    return game.floorYs.findIndex((fy) => Math.abs(fy - feet) < 3);
  }

  function nearestSpot(needCabled) {
    const floor = onFloorPlayer();
    if (floor < 0) return null;
    let best = null, bestDist = Infinity;
    for (const s of game.spots) {
      if (s.done) continue;
      if (s.floor !== floor) continue;
      if (needCabled === true && !s.cabled) continue;
      if (needCabled === false && s.cabled) continue;
      const d = Math.abs(player.x + player.w / 2 - s.x);
      if (d < REACH && d < bestDist) { best = s; bestDist = d; }
    }
    return best;
  }

  // ================= НАЧАЛЬНИК ЛЕНИН =================
  // Гуляет по этажам объекта. Как только подходит близко — созывает монтажника на
  // перекур: игрок принудительно бежит к нему и «курит» пару секунд. Отвлечение!
  function summonLenin() {
    if (lenin) return;
    const pf = onFloorPlayer();
    const floor = pf >= 0 ? pf : randInt(0, game.floorYs.length - 1);
    const playerOnSide = player.x + player.w / 2 > W / 2;
    lenin = {
      floor, x: playerOnSide ? WALL_L + 70 : WALL_R - 90, w: 26, h: 42,
      state: 'walk', t: 15 + Math.random() * 8, smokeT: 0, facing: 1, cool: 3,
      targetX: randInt(WALL_L + 140, WALL_R - 140),
    };
    showToast('Ленин пришёл на объект — гуляет и следит!');
    AudioSys.tone(220, 0.16, 'triangle', 0.08);
  }

  function leaveLenin(msg) {
    lenin = null;
    game.leninTimer = 18 + Math.random() * 14;
    if (msg) showToast(msg);
  }

  function leninForce() {
    return lenin && (lenin.state === 'call' || lenin.state === 'smoke') && onFloorPlayer() === lenin.floor;
  }

  function leninUpdate(dt) {
    if (!lenin) {
      game.leninTimer -= dt;
      if (game.leninTimer <= 0) summonLenin();
      return;
    }
    const L = lenin;
    const fy = game.floorYs[L.floor];

    if (L.state === 'walk') {
      if (L.cool > 0) L.cool -= dt;
      const dir = Math.sign(L.targetX - L.x);
      if (dir !== 0) { L.x += dir * 46 * dt; L.facing = dir; }
      if (dir === 0 || Math.abs(L.targetX - L.x) < 8) L.targetX = randInt(WALL_L + 120, WALL_R - 120);
      L.t -= dt;
      if (L.t <= 0) { leaveLenin('Ленин погулял и ушёл по своим делам.'); return; }
      const pcx = player.x + player.w / 2;
      if (L.cool <= 0 && !player.stun && onFloorPlayer() === L.floor && Math.abs(pcx - L.x) < 300) {
        L.state = 'call';
        L.t = 0;
        addFloater(L.x, fy - 64, 'ПЕРЕКУР!', '#fbbf24');
        AudioSys.tone(170, 0.2, 'sawtooth', 0.08);
      }
      return;
    }

    if (L.state === 'call') {
      L.t += dt;
      if (onFloorPlayer() !== L.floor) {
        if (L.t > 9) { leaveLenin('Ленин ушёл не попыхав — вы отстояли работу.'); }
        return;
      }
      const pcx = player.x + player.w / 2;
      if (Math.abs(pcx - L.x) < 20) {
        L.state = 'smoke';
        L.smokeT = 2.8;
        addFloater(L.x, fy - 64, 'курим…', '#fef08a');
      }
      return;
    }

    if (L.state === 'smoke') {
      L.smokeT -= dt;
      if (L.smokeT <= 0) {
        addFloater(L.x, fy - 64, 'Всё, работаем!', '#86efac');
        L.state = 'walk';
        L.t = 17 + Math.random() * 9;
        L.cool = 9;
        // уходит в противоположную от монтажника сторону
        const pcx = player.x + player.w / 2;
        L.targetX = pcx > W / 2
          ? randInt(WALL_L + 100, W / 2 - 90)
          : randInt(W / 2 + 90, WALL_R - 130);
      }
    }
  }

  // ================= ДРОН ПРОРАБА =================
  // Облетает объект. С шансом ~25% за рейс падает на стройку — уровень начинается заново.
  function spawnDrone() {
    const fromLeft = Math.random() < 0.5;
    drone = {
      x: fromLeft ? -46 : W + 46,
      y: 24,
      vx: (fromLeft ? 1 : -1) * (58 + Math.random() * 22),
      vy: 0,
      state: 'fly',
      rot: 0,
      willFall: Math.random() < 0.25,
      fallAtX: randInt(WALL_L + 150, WALL_R - 150),
    };
    showToast('Дрон прораба облетает объект…');
    AudioSys.tone(660, 0.1, 'square', 0.045);
  }

  function droneUpdate(dt) {
    if (!drone) {
      game.droneTimer -= dt;
      if (game.droneTimer <= 0) spawnDrone();
      return;
    }
    const D = drone;

    if (D.state === 'fly') {
      D.x += D.vx * dt;
      if (D.willFall && Math.abs(D.x - D.fallAtX) < 14) {
        D.state = 'fall';
        D.vy = 30;
        AudioSys.tone(880, 0.12, 'sawtooth', 0.06);
      } else if ((D.vx > 0 && D.x > W + 60) || (D.vx < 0 && D.x < -60)) {
        drone = null;
        game.droneTimer = 30 + Math.random() * 26;
      }
      return;
    }

    // падение
    D.vy += GRAVITY * dt;
    D.x += D.vx * 0.25 * dt;
    D.y += D.vy * dt;
    D.rot += 6 * dt;
    for (const fy of game.floorYs) {
      if (D.y + 10 >= fy) {
        shake = 16;
        AudioSys.caught();
        addFloater(D.x, fy - 40, 'ДРОН УПАЛ!', '#f87171');
        showToast('Дрон прораба рухнул на объект — стройка начинается заново!');
        drone = null;
        startLevel(game.level);
        return;
      }
    }
    if (D.y > H + 40) { drone = null; game.droneTimer = 30 + Math.random() * 26; }
  }

  // ================ ПРОВЕРКА ГЕНПОДРЯДЧИКА ================
  // Приезжает раз в ~30-60 с: поймает на перекуре — штраф, чисто — премия.
  function inspectNow() {
    game.inspectTimer = 34 + Math.random() * 26;
    const px = player.x + player.w / 2;
    const py = player.y;
    if (lenin && (lenin.state === 'smoke' || lenin.state === 'call')) {
      const fine = 25;
      game.score = Math.max(0, game.score - fine);
      game.combo = 0;
      game.comboTimer = 0;
      player.stun = Math.max(player.stun, 1.0);
      shake = 10;
      AudioSys.alarm();
      addFloater(px, py - 14, '−' + fine + ' ШТРАФ', '#f87171');
      showToast('Генподрядчик заметил перекур: штраф −' + fine + '!');
    } else {
      game.score += 10;
      addFloater(px, py - 14, '+10 ПОРЯДОК', '#86efac');
      AudioSys.comboUp();
    }
    updateHud();
  }

  function inspectUpdate(dt) {
    game.inspectTimer -= dt;
    if (game.inspectTimer <= 0) inspectNow();
  }

  // ================= ЗАТОПЛЕНИЕ (КРАН ДИМЫ) =================
  function forceFlood() {
    game.flood = { t: 16, T: 16 };
    game.debuff = { type: 'wet', t: 16 };
    showToast('Кран дал течь — уровень затапливает!');
    AudioSys.alarm();
  }

  function drawFlood() {
    if (!game.flood) return;
    const rise = 1 - game.flood.t / game.flood.T; // 0 → 1
    const top = H - rise * H * 0.42;
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.20)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, top + 5);
    for (let x = 0; x <= W; x += 42) {
      ctx.lineTo(x, top + Math.sin(game.time * 2.6 + x * 0.045) * 5);
    }
    ctx.lineTo(W, top + 5);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // блики на воде
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 42) {
      const y = top + Math.sin(game.time * 2.6 + x * 0.045) * 5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ================= СТРОГИЙ МАКС =================
  // Врывается, разыскивает Ленина, догоняет и выгоняет его. Перекуры — мимо.
  function summonMax() {
    if (!lenin || max) return null;
    const offset = (Math.random() < 0.5 ? -1 : 1) * 110;
    max = {
      floor: lenin.floor,
      x: clamp(lenin.x + offset, WALL_L + 40, WALL_R - 70),
      w: 24, h: 40,
      t: 26,
      facing: 1,
    };
    showToast('Строгий Макс ворвался на объект! Гонится за Лениным.');
    AudioSys.tone(110, 0.22, 'square', 0.07);
  }

  function leaveMax(msg) {
    max = null;
    game.maxTimer = 26 + Math.random() * 20;
    if (msg) showToast(msg);
  }

  function maxUpdate(dt) {
    if (!max) {
      game.maxTimer -= dt;
      if (game.maxTimer <= 0) {
        if (lenin) summonMax();
        else game.maxTimer = 7 + Math.random() * 8; // придёт, как только появится Ленин
      }
      return;
    }
    const M = max;

    if (!lenin) { // Ленин сбежал сам — Макс махнул рукой
      leaveMax('Ленин скрылся, Макс ни с чем ушёл смотреть другой объект.');
      return;
    }

    // гонится: заметно быстрее Ленина (46 px/с)
    const dir = Math.sign(lenin.x - M.x);
    if (dir !== 0) { M.x += dir * 100 * dt; M.facing = dir; }

    if (Math.abs(M.x - lenin.x) < 22) {
      // ДОГНАЛ: перекур под запретом, Ленин гоним с объекта
      const wasSmoke = lenin.state === 'smoke';
      const wasCall = lenin.state === 'call';
      const lx = lenin.x;
      leaveLenin('Макс разогнал Ленина: Ильич удирал с доской под мышкой!');
      addFloater(lx, game.floorYs[M.floor] - 64, 'ПОПАЛСЯ, ЛЕНИН!', '#86efac');
      if (wasSmoke || wasCall) {
        addFloater(player.x + player.w / 2, player.y - 12, 'МАКС СОРВАЛ ПЕРЕКУР — РАБОТАЙ!', '#86efac');
      }
      AudioSys.comboUp();
      leaveMax('Макс доволен: порядок наведён.');
      return;
    }

    M.t -= dt;
    if (M.t <= 0) leaveMax('Макс потерял Ленина из виду и ушёл.');
  }

  function drawMax() {
    if (!max) return;
    const M = max;
    const fy = game.floorYs[M.floor];
    const bob = Math.sin(game.time * 11) * 1.5;

    ctx.save();
    ctx.translate(M.x, fy);
    ctx.translate(0, bob);
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 1, 11, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    if (M.facing < 0) ctx.scale(-1, 1);

    // ноги
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6, -10, 4.5, 10);
    ctx.fillRect(2, -10, 4.5, 10);
    // строгий тёмный костюм
    ctx.fillStyle = '#1f2937';
    rr(-9, -30, 18, 21, 3); ctx.fill();
    // красный галстук
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-1.5, -28, 3, 10);
    // бумажки в руке (проверка смены)
    ctx.fillStyle = '#e2e8f0';
    ctx.save();
    ctx.rotate(-0.35);
    ctx.fillRect(9, -30, 7, 10);
    ctx.restore();
    // руки
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-12, -28, 3.5, 14);
    // голова: строгие брови, ни бороды ни кепки
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -35, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-6, -41, 12, 3); // волосы
    ctx.fillRect(-3, -38.5, 2.5, 1.6); // брови нахмурены
    ctx.fillRect(1, -38.5, 2.5, 1.6);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(1.5, -36, 2, 1.5); // рот линией
    ctx.restore();

    // злой пузырь во время погони
    const pulse = 0.55 + 0.45 * Math.sin(game.time * 10);
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    rr(M.x - 52, fy - 86, 104, 20, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = pulse;
    ctx.fillText('ГДЕ ЛЕНИН?!', M.x, fy - 71);
    ctx.restore();
  }

  function tryLayCable() {
    if (game.state !== 'play' || installing.timer > 0 || player.stun > 0) return;
    if (leninForce()) { addFloater(lenin.x, game.floorYs[lenin.floor] - 64, 'ПЕРЕКУР!', '#fbbf24'); return; }    const spot = nearestSpot(false);
    if (!spot) {
      const any = nearestSpot(true);
      if (any) showToast('Трасса уже проложена — ставь прибор (Space)');
      return;
    }
    const total = 0.85 * (has('crimper') ? 0.5 : 1) * (game.object.pace > 1 ? 1.1 : 1) *
      (game.char ? game.char.cable : 1) *
      (game.debuff && game.debuff.type === 'nosupply' ? 3 : 1) *
      (game.buffState.quick ? 0.55 : 1);
    installing = { timer: total, total, spot, kind: 'cable' };
    AudioSys.tone(420, 0.06, 'square', 0.06);
  }

  function tryInstall() {
    if (game.state !== 'play' || installing.timer > 0 || player.stun > 0) return;
    if (leninForce()) { addFloater(lenin.x, game.floorYs[lenin.floor] - 64, 'ПЕРЕКУР!', '#fbbf24'); return; }
    if (game.acceptance) { tryAccept(); return; }
    const spot = nearestSpot(true);
    if (!spot) {
      const bare = nearestSpot(false);
      if (bare) showToast('Сначала проложи кабель — жми C');
      else if (game.acceptance) tryAccept();
      return;
    }
    const total = 0.95 * (has('screwdriver') ? 0.55 : 1) * game.object.pace *
      (game.char ? game.char.install : 1) *
      (game.buffState.quick ? 0.55 : 1);
    installing = { timer: total, total, spot, kind: 'install' };
    AudioSys.installStart();
  }

  function finishCable() {
    const s = installing.spot;
    installing = { timer: 0, total: 0, spot: null, kind: null };
    if (!s) return;
    s.cabled = true;
    game.cables.push({ x1: BOX_X, y1: game.floorYs[s.floor] - 30, x2: s.x, floor: s.floor, hot: 1 });
    const gained = 4;
    game.score += gained;
    addFloater(BOX_X, game.floorYs[s.floor] - 44, '+кабель', game.object.pal.wire);
    AudioSys.tone(700, 0.08, 'sine', 0.08, 950);
    updateHud();
  }

  function comboMultiplier() { return 1 + Math.min(Math.max(game.combo - 1, 0), 10) * 0.1; }

  function finishInstall() {
    const spot = installing.spot;
    installing = { timer: 0, total: 0, spot: null, kind: null };
    AudioSys.installStop();
    if (!spot) return;
    const device = DEVICES[spot.type];

    // ==== удача персонажа ====
    const lucky = game.char && Math.random() < game.char.luck;
    if (!lucky) {
      if (game.char && game.char.plumber) {
        // Дима промазал — поставил кран
        spot.done = true;
        spot.san = true;
        game.installed += 1;
        game.combo = 0;
        game.comboTimer = 0;
        const gained = 2;
        game.score += gained;
        addFloater(spot.x, spot.y - 14, 'кран +2', '#a5f3fc');
        AudioSys.comboUp();
        shake = Math.min(9, shake + 3);
        // кран может сорваться и затопить уровень
        if (Math.random() < 0.35) forceFlood();
        updateHud();
        if (game.score > game.best) { game.best = game.score; saveBest(); }
        if (game.installed >= game.goal) {
          if (game.object.boss) startAcceptance();
          else completeLevel();
        }
        return;
      }
      // брак: устройство придётся переделывать
      spot.brak = true;
      game.combo = 0;
      game.comboTimer = 0;
      addFloater(spot.x, spot.y - 14, 'БРАК!', '#f87171');
      // короткое замыкание: трасса может выгореть — тянуть заново
      if (spot.cabled && Math.random() < 0.5) {
        spot.cabled = false;
        game.cables = game.cables.filter((c) => !(c.floor === spot.floor && Math.abs(c.x2 - spot.x) < 2));
        spawnSparks(spot.x, spot.y, '#fb923c');
        addFloater(spot.x, spot.y - 36, 'КЗ! ТРАССА СГОРЕЛА', '#fb923c');
        AudioSys.alarm();
        shake = Math.min(10, shake + 5);
      }
      AudioSys.angry();
      shake = Math.min(9, shake + 4);
      updateHud();
      return;
    }

    spot.brak = false;
    spot.done = true;
    game.installed += 1;

    let base = device.points;
    if (has('multimeter')) base += 10;
    if (has('partner')) base = Math.round(base * 1.2);

    game.combo += 1;
    game.comboTimer = 7;
    let gained = Math.round(base * comboMultiplier());
    if (game.buffState.dbl) gained *= 2;
    game.score += gained;

    addFloater(spot.x, spot.y - 14, '+' + gained, device.color);
    spawnSparks(spot.x, spot.y, device.color);
    AudioSys.win();
    if (game.combo >= 3) AudioSys.comboUp();
    shake = Math.min(9, shake + 5);
    updateHud();

    if (game.score > game.best) { game.best = game.score; saveBest(); }

    if (game.installed >= game.goal) {
      if (game.object.boss) startAcceptance();
      else completeLevel();
    }
  }

  // ================= БОСС «ГЕНПОДРЯДЧИК» =================
  function laddersOnFloor(floor) {
    return game.ladders.filter((l) => l.lower === floor || l.upper === floor);
  }

  function bossUpdate(dt) {
    const b = boss;
    if (!b) return;
    if (b.angry > 0) b.angry -= dt;
    if (b.cooldown > 0) b.cooldown -= dt;
    if (game.acceptance) {
      // бежит к приёмке через все этажи
      bossNavigate(b, game.floorYs.length - 1, PANEL_X + 60, dt);
      checkBossAtPanel();
      return;
    }

    switch (b.mode) {
      case 'patrol': {
        if (b.wait > 0) { b.wait -= dt; break; }
        if (!b.target) {
          const tf = randInt(0, game.floorYs.length - 1);
          b.target = { floor: tf, x: randInt(WALL_L + 90, WALL_R - 90) };
        }
        bossNavigate(b, b.target.floor, b.target.x, dt);
        if (b.target && Math.abs(b.x - b.target.x) < 24 && b.floor === b.target.floor) {
          b.target = null; b.wait = 0.7 + Math.random() * 0.9;
        }
        break;
      }
      default: b.mode = 'patrol';
    }

    // ловит монтажника
    if (b.cooldown <= 0 && player.stun <= 0) {
      const pf = onFloorPlayer();
      if (pf === b.floor && Math.abs(b.x - (player.x + player.w / 2)) < (b.reach || 30)) catchPlayer();
    }
  }

  function bossGotoFloor(b, floor) {
    if (b.floor === floor || !b.path) return;
    b.target = { floor, x: randInt(WALL_L + 90, WALL_R - 90) };
  }

  function bossNavigate(b, tfloor, tx, dt) {
    if (b.floor !== tfloor) {
      const ladders = laddersOnFloor(b.floor);
      // floor 0 = верх здания; спуск — ladder.upper === floor, подъём — ladder.lower === floor
      const hor = tfloor > b.floor
        ? ladders.filter((l) => l.upper === b.floor)
        : ladders.filter((l) => l.lower === b.floor);
      if (!hor.length) { b.target = null; return; }
      const lad = hor.reduce((a, l) => (Math.abs(l.x - b.x) < Math.abs(a.x - b.x) ? l : a));
      bossWalk(b, lad.x, dt);
      if (Math.abs(b.x - lad.x) < 6) {
        const dir = tfloor > b.floor ? 1 : -1;
        b.y += dir * CLIMB_SPEED * 1.05 * dt;
        b.y = clamp(b.y, Math.min(lad.top, lad.bottom) - b.h, Math.max(lad.top, lad.bottom) - b.h);
        if ((dir === -1 && b.y <= lad.top - b.h + 1) || (dir === 1 && b.y >= lad.bottom - b.h - 1)) {
          b.floor = dir === -1 ? lad.upper : lad.lower;
          b.y = game.floorYs[b.floor] - b.h;
          b.target = null;
        }
      }
    } else {
      bossWalk(b, tx, dt);
    }
  }

  function bossWalk(b, tx, dt, mul) {
    const dir = Math.sign(tx - b.x);
    if (dir !== 0) {
      b.x = clamp(b.x + dir * b.speed * (mul || 1) * dt, WALL_L + 10, WALL_R - b.w - 10);
      if (dir) b.walk = (b.walk || 0) + 1;
    }
  }

  function catchPlayer() {
    const b = boss;
    b.cooldown = 2.2;
    player.stun = 1.0;
    const lost = Math.min(game.score, 15 + 5 * (game.cycle || 0));
    game.score -= lost;
    game.combo = 0;
    game.comboTimer = 0;
    b.angry = 2.5;
    shake = 12;
    AudioSys.caught();
    showToast('Генподрядчик поймал: −' + lost + '. Работай аккуратнее!');
    updateHud();
  }

  function startAcceptance() {
    game.acceptance = true;
    AudioSys.siren();
    showToast('Приёмка! Гонка к щиту АПС внизу — успей раньше генподрядчика!');
    if (boss) { boss.speed = Math.max(120, boss.speed + 30); }
  }

  function checkBossAtPanel() {
    const b = boss;
    if (Math.abs(b.x - (PANEL_X + 60)) < 40 && b.floor === game.floorYs.length - 1 && !b.arrived) {
      b.arrived = true;
      const lost = Math.min(game.score, 30);
      game.score -= lost;
      shake = 10;
      AudioSys.angry();
      showToast('Генподрядчик первый у щита: −' + lost + '. Всё равно сдай работы!');
      updateHud();
    }
  }

  function tryAccept() {
    if (!game.acceptance) return;
    const ground = onFloorPlayer() === game.floorYs.length - 1;
    const near = Math.abs(player.x - PANEL_X) < 70;
    if (!(ground && near)) return;
    const bonus = boss && boss.arrived ? 60 : 130;
    game.score += bonus;
    addFloater(PANEL_X, game.floorYs[game.floorYs.length - 1] - 40, '+' + bonus, '#4ade80');
    showToast('Работы приняты' + (boss && boss.arrived ? ' с замечаниями' : ' без замечаний!'));
    completeLevel();
  }

  // ================= ЧАСТИЦЫ =================
  function addFloater(x, y, text, color) {
    game.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }
  function spawnSparks(x, y, color) {
    for (let i = 0; i < 8; i++) {
      game.sparks.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 90, life: 0.5 + Math.random() * 0.3, color });
    }
  }

  function updateEffects(dt) {
    for (let i = game.floaters.length - 1; i >= 0; i--) {
      const f = game.floaters[i];
      f.life -= dt; f.y -= 32 * dt;
      if (f.life <= 0) game.floaters.splice(i, 1);
    }
    for (let i = game.sparks.length - 1; i >= 0; i--) {
      const s = game.sparks[i];
      s.life -= dt; s.vy += 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) game.sparks.splice(i, 1);
    }
    // пыль в лучах
    if (game.dust.length < 26) {
      game.dust.push({
        x: randInt(70, WALL_R - 70), y: TOP_Y + randInt(0, 340),
        vx: (Math.random() - 0.5) * 6, vy: 6 + Math.random() * 10, a: 0.05 + Math.random() * 0.1,
      });
    }
    for (const d of game.dust) {
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y > H - 60) { d.y = TOP_Y + 4; d.x = randInt(70, WALL_R - 70); }
    }
  }

  // ================= ОБНОВЛЕНИЕ =================
  let lastTickSec = -1;
  function update(dt) {
    game.time += dt;
    shake = Math.max(0, shake - 40 * dt);

    if (game.state !== 'play') { updateEffects(dt); return; }

    if (player.stun <= 0 && installing.timer <= 0) movePlayer(dt);
    if (installing.timer > 0) {
      installing.timer -= dt;
      if (installing.timer <= 0) (installing.kind === 'cable' ? finishCable() : finishInstall());
    }

    // дедлайн
    game.shiftTime -= dt;
    const sec = Math.ceil(Math.max(0, game.shiftTime));
    if (sec !== lastTickSec) {
      lastTickSec = sec;
      if (sec <= 10 && sec > 0) AudioSys.tick();
    }
    if (game.shiftTime <= 0) {
      const lost = Math.min(game.score, 40);
      game.score -= lost;
      game.combo = 0;
      game.timeouts += 1;
      game.shiftTime = game.shiftLimit * 0.35;
      AudioSys.alarm();
      shake = 14;
      game.failsAtLevel = (game.failsAtLevel || 0) + 1;

      // Макс строгий: два провала — предупреждение, третий (или злой рандом на 2-м) — увольнение
      if (game.failsAtLevel >= 3 || (game.failsAtLevel === 2 && Math.random() < 0.6)) {
        fireWorker();
      } else if (game.failsAtLevel === 2) {
        showToast('Макс вне себя: ещё один сорванный срок — и расчёт!');
        updateHud();
      } else {
        showToast('Смена сорвана! Генподрядчик в ярости: −' + lost + '. Макс ставит на вид.');
        updateHud();
      }
    }

    if (game.combo > 0 && !has('radio') && !game.buffState.guard && installing.timer <= 0 &&
        !(lenin && lenin.state === 'smoke')) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) { game.combo = 0; game.comboTimer = 0; }
    }

    // помехи
    game.eventTimer -= dt;
    if (game.eventTimer <= 0) {
      game.eventTimer = 20 + Math.random() * 14;
      const kinds = ['nosupply', 'wet', 'blackout'];
      const kind = kinds[randInt(0, kinds.length - 1)];
      game.debuff = { type: kind, t: kind === 'wet' ? 12 : 10 };
      if (kind === 'nosupply') showToast('Поставку гофры сорвало: кабели в 3 раза медленнее!');
      if (kind === 'wet') showToast('Трубу прорвало: полы мокрые — можно свалиться с лестницы!');
      if (kind === 'blackout') showToast('Свет вырубили — работаем фонариком!');
      AudioSys.alarm();
    }
    if (game.debuff) {
      game.debuff.t -= dt;
      if (game.debuff.t <= 0) game.debuff = null;
    }

    // начальник Ленин — ходит и отвлекает
    leninUpdate(dt);
    // дрон прораба и проверка генподрядчика
    droneUpdate(dt);
    inspectUpdate(dt);
    // строгий Макс — гоняет Ленина
    maxUpdate(dt);
    if (game.flood) {
      game.flood.t -= dt;
      if (game.flood.t <= 0) game.flood = null;
    }

    // улучшения
    game.buffTimer -= dt;
    if (game.buffTimer <= 0 && game.buffs.length < 2) {
      game.buffTimer = 22 + Math.random() * 14;
      const bk = ['turbo', 'quick', 'dbl', 'guard'][randInt(0, 3)];
      const names = { turbo: 'ТУРБО-БОТИНКИ', quick: 'СЪЁМНЫЙ ПАТРОН', dbl: 'ДВОЙНАЯ СМЕНА', guard: 'ЩИТ КОМБО' };
      game.buffs.push({
        floor: randInt(0, game.floorYs.length - 1),
        x: randInt(WALL_L + 160, WALL_R - 60),
        kind: bk,
        label: names[bk],
      });
    }
    for (let i = game.buffs.length - 1; i >= 0; i--) {
      const bu = game.buffs[i];
      if (bu.floor === onFloorPlayer() && Math.abs(bu.x - (player.x + player.w / 2)) < 28) {
        game.buffState[bu.kind] = 12;
        addFloater(bu.x, game.floorYs[bu.floor] - 46, bu.label, '#fde047');
        AudioSys.win();
        game.buffs.splice(i, 1);
      }
    }
    for (const k of Object.keys(game.buffState)) {
      if (game.buffState[k] > 0) {
        game.buffState[k] -= dt;
        if (game.buffState[k] <= 0) delete game.buffState[k];
      }
    }

    // бригада Шавката
    for (const h of game.squad) {
      if (h.job) {
        h.job.t -= dt;
        if (h.job.t <= 0) {
          const s = h.job.spot;
          if (h.job.kind === 'cable') {
            s.cabled = true;
            game.cables.push({ x1: BOX_X, y1: game.floorYs[s.floor] - 30, x2: s.x, floor: s.floor, hot: 1 });
            game.score += 2;
            addFloater(s.x, s.y - 10, '+кабель', '#7dd3fc');
          } else {
            s.brak = false;
            s.done = true;
            game.installed += 1;
            const pts = Math.max(1, Math.round(DEVICES[s.type].points * 0.5));
            game.score += pts;
            game.cables.push({ x1: BOX_X, y1: game.floorYs[s.floor] - 30, x2: s.x, floor: s.floor, hot: 1 });
            if (!s.cabled) s.cabled = true;
            addFloater(s.x, s.y - 10, '+' + pts + ' бригада', '#a7f3d0');
          }
          AudioSys.step();
          h.job = null;
        }
        continue;
      }
      h.timer -= dt;
      if (h.timer <= 0) {
        h.timer = 6 + Math.random() * 2.5;
        const target = game.spots.find((s) => s.floor === h.floor && !s.done && !s.cabled) ||
                       game.spots.find((s) => s.floor === h.floor && !s.done && !s.brak);
        if (target) {
          h.job = { spot: target, kind: target.cabled ? 'install' : 'cable', t: target.cabled ? 3.2 : 1.6 };
          h.x = target.x;
        }
      }
    }

    bossUpdate(dt);
    updateEffects(dt);
  }

  function updateHud() {
    setText(hud.level, String(game.level));
    setText(hud.score, String(game.score));
    setText(hud.goal, game.installed + ' / ' + game.goal);
    setText(hud.combo, game.combo > 0 ? 'x' + comboMultiplier().toFixed(1) : '—');
    setText(hud.best, String(game.best));
    const t = Math.max(0, Math.ceil(game.shiftTime));
    setText(hud.time, t + ' с');
    if (hud.timeCard) hud.timeCard.classList.toggle('danger', t <= 10 && game.state === 'play');
  }

  function completeLevel() {
    game.state = 'levelup';
    AudioSys.installStop();
    AudioSys.levelEnd();
    ovBtn.hidden = false;
    const next = game.level + 1;
    const nextUnlock = UNLOCKS[next];
    const objName = game.object.name;
    ovTitle.textContent = 'Объект сдан!';
    ovText.textContent = objName + ': ' + game.goal + ' устройств, очки: ' + game.score +
      (game.timeouts ? ' · смена срывалась ' + game.timeouts + ' раз' : ' · в дедлайн уложился');
    if (nextUnlock) {
      ovUnlock.innerHTML =
        '<div class="unlock"><span class="badge">НОВОЕ</span><b>' + nextUnlock.name + '</b><span>' + nextUnlock.desc + '</span></div>';
    } else {
      ovUnlock.innerHTML =
        '<div class="unlock"><span class="badge">ДАЛЬШЕ</span><b>Без ограничений</b><span>Объекты идут по кругу, задания растут — держи темп.</span></div>';
    }
    overlay.classList.remove('hidden');
  }

  function nextLevel() {
    if (game.state !== 'levelup') return;
    startLevel(game.level + 1);
  }
  function hideOverlay() { overlay.classList.add('hidden'); }

  // ================= УВОЛЬНЕНИЕ МАКСОМ =================
  // Объект каждый раз не сдан в срок — Макс пришёл с расчётным листом.
  function fireWorker() {
    game.state = 'fired';
    AudioSys.installStop();
    AudioSys.alarm();
    const who = game.char ? game.char.name : 'Начальник';
    if (game.score > game.best) { game.best = game.score; saveBest(); }
    ovTitle.textContent = 'МАКС ВАС УВОЛИЛ!';
    ovText.textContent = who + ' трижды сорвал смену на «' + game.object.name + '». ' +
      'Очки: ' + game.score + ' · рекорд: ' + game.best + '. ' +
      'Расчёт! Трудовая книжка — в дверь.';
    ovBtn.hidden = false;
    ovBtn.textContent = 'Заново этим же монтажником';
    ovUnlock.innerHTML =
      '<button class="charcard" data-goselect="1">' +
      '<span class="ce">👷</span><span class="cn">Позвать другого монтажника</span>' +
      '<span class="cs">выбери кого-то другого — смена начнётся с нуля</span></button>';
    overlay.classList.remove('hidden');
    showToast('Макс сказал: расчёт!');
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    const id = ++toastId;
    window.setTimeout(() => { if (id === toastId) toastEl.classList.add('hidden'); }, 3200);
  }

  // ================= ОТРИСОВКА =================
  let vignette = null;
  function getVignette() {
    if (!vignette) {
      vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
    }
    return vignette;
  }

  function drawBackground(pal) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, pal.sky1);
    sky.addColorStop(1, pal.sky2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // дальний город (параллакс-слоёный силуэт)
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    let bx = 0;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (bx < W) {
      const bw = 60 + rnd() * 90;
      const bh = 60 + rnd() * 200;
      ctx.fillRect(bx, H - 60 - bh, bw, bh);
      bx += bw + 14;
    }
    // ночные окна города
    ctx.fillStyle = 'rgba(255, 220, 120, 0.14)';
    for (let i = 0; i < 40; i++) {
      const wx = 20 + ((i * 97) % (W - 30));
      const wy = 120 + ((i * 61) % (H - 220));
      ctx.fillRect(wx, wy, 6, 8);
    }

    // строительная стена
    ctx.fillStyle = pal.wall;
    ctx.fillRect(WALL_L - 16, TOP_Y, WALL_R - WALL_L + 32, H - TOP_Y - 44);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = WALL_L; x < WALL_R; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, TOP_Y); ctx.lineTo(x, H - 44); ctx.stroke();
    }

    // ящики на складе
    if (game.object.crates) {
      for (const fy of game.floorYs) {
        for (let i = 0; i < 5; i++) {
          const cx = 620 + i * 52 + ((fy * 37) % 30);
          ctx.fillStyle = 'rgba(120, 90, 40, 0.55)';
          rr(cx, fy - 26, 40, 26, 3); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, fy - 26); ctx.lineTo(cx + 40, fy); ctx.stroke();
        }
      }
    }

    // окна с лучами
    drawWindow(90, 80, 150, 58, pal);
    drawWindow(430, 80, 130, 58, pal);
    drawWindow(700, 80, 170, 58, pal);

    // пыль
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const d of game.dust) {
      ctx.globalAlpha = d.a;
      ctx.fillRect(d.x, d.y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  function drawWindow(x, y, w, h, pal) {
    ctx.fillStyle = '#0b1628';
    ctx.fillRect(x, y, w, h);
    const glow = ctx.createLinearGradient(0, y, 0, y + h);
    glow.addColorStop(0, 'rgba(' + pal.beam + ', 0.2)');
    glow.addColorStop(1, 'rgba(' + pal.beam + ', 0.03)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();

    // наклонный луч
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const beam = ctx.createLinearGradient(x, y, x + 120, y + 300);
    beam.addColorStop(0, 'rgba(' + pal.beam + ', 0.12)');
    beam.addColorStop(1, 'rgba(' + pal.beam + ', 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + 150, y + 320); ctx.lineTo(x + 40, y + 320);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawFloor(fy) {
    const x = WALL_L - 12, w = WALL_R - WALL_L + 24;
    ctx.fillStyle = '#1b2740';
    ctx.fillRect(x, fy, w, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, fy, w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, fy + 14, w, 4);
  }

  function drawLadder(l) {
    ctx.strokeStyle = '#8ea3c4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(l.x - 9, l.top); ctx.lineTo(l.x - 9, l.bottom);
    ctx.moveTo(l.x + 9, l.top); ctx.lineTo(l.x + 9, l.bottom);
    ctx.stroke();
    ctx.strokeStyle = '#6d82a6';
    ctx.lineWidth = 2;
    for (let y = l.top + 9; y < l.bottom; y += 18) {
      ctx.beginPath(); ctx.moveTo(l.x - 9, y); ctx.lineTo(l.x + 9, y); ctx.stroke();
    }
  }

  function drawBoxes(pal) {
    // распаячные коробки на каждом этаже
    for (const fy of game.floorYs) {
      ctx.fillStyle = '#233752';
      rr(BOX_X - 14, fy - 52, 30, 26, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
      ctx.fillStyle = 'rgba(' + pal.wire + ', 0.9)';
      ctx.fillRect(BOX_X - 8, fy - 44, 5, 4);
      ctx.fillRect(BOX_X, fy - 44, 5, 4);
      ctx.fillRect(BOX_X + 8, fy - 44, 5, 4);
    }
  }

  function drawPanel(pal) {
    const fy = game.floorYs[game.floorYs.length - 1];
    ctx.fillStyle = '#1c2a45';
    rr(PANEL_X - 18, fy + 12, 70, 56, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
    ctx.fillStyle = pal.wire;
    for (let i = 0; i < 3; i++) ctx.fillRect(PANEL_X - 8 + i * 16, fy + 24, 7, 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(PANEL_X - 10, fy + 40, 54, 4);
    // красно-мигающий свет тревоги при приёмке
    if (game.acceptance || (boss && boss.angry > 0)) {
      const pulse = 0.5 + 0.5 * Math.sin(game.time * 9);
      ctx.fillStyle = 'rgba(248, 113, 113, ' + (0.4 * pulse).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(PANEL_X + 20, fy + 4, 13, Math.PI, 0); ctx.fill();
    }
  }

  function drawCable(c) {
    const grad = ctx.createLinearGradient(c.x1, 0, c.x2, 0);
    grad.addColorStop(0, 'rgba(148,163,184,0.9)');
    grad.addColorStop(1, game.object.pal.wire);
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.2;
    ctx.shadowColor = game.object.pal.wire;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(c.x1, c.y1);
    ctx.lineTo(c.x2, c.y1);
    ctx.lineTo(c.x2, c.y1 + 22);
    ctx.stroke();
    // бегущий импульс по трассе
    const t = (game.time * 0.6) % 1;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(c.x1 + (c.x2 - c.x1) * t - 4, c.y1 - 1.5, 8, 3);
    ctx.restore();
  }

  function drawLayingCable() {
    if (installing.kind !== 'cable' || !installing.spot) return;
    const s = installing.spot;
    const p = 1 - installing.timer / installing.total;
    const fy = game.floorYs[s.floor];
    const xEnd = BOX_X + (s.x - BOX_X) * p;
    ctx.save();
    ctx.strokeStyle = game.object.pal.wire;
    ctx.lineWidth = 3;
    ctx.shadowColor = game.object.pal.wire;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(BOX_X, fy - 30);
    ctx.lineTo(xEnd, fy - 30);
    if (p > 0.99) ctx.lineTo(s.x, fy - 58);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpot(s, active) {
    if (s.done) { if (s.san) drawFaucet(s.x, s.y); else drawDevice(s.x, s.y, s.type); return; }
    const device = DEVICES[s.type];
    const pulse = 0.55 + 0.45 * Math.sin(game.time * 3 + s.blink);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.shadowColor = device.color;
    ctx.shadowBlur = active === s ? 18 : 8;
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

    // брак — красный крест поверх
    if (s.brak) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-9, -9); ctx.lineTo(9, 9);
      ctx.moveTo(9, -9); ctx.lineTo(-9, 9);
      ctx.stroke();
      ctx.fillStyle = '#fca5a5';
      ctx.font = '700 10px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('БРАК', s.x, s.y - 22);
      ctx.restore();
    }

    if (active === s) {
      ctx.save();
      ctx.fillStyle = s.cabled ? '#bfdbfe' : game.object.pal.wire;
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.cabled ? 'SPACE' : 'C', s.x, s.y - 26);
      ctx.restore();
    }
  }

  function drawFaucet(x, y) {
    // кран, который «который Игорь» ставит вместо АПС
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#94a3b8';
    rr(-10, -4, 20, 10, 3); ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-2, -14, 4, 10);
    ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(7, -10); ctx.lineTo(5, -14); ctx.lineTo(-5, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(-4, 6, 8, 4);
    ctx.restore();
  }

  function drawBuffs() {
    for (const bu of game.buffs) {
      const fy = game.floorYs[bu.floor];
      const pulse = 0.5 + 0.5 * Math.sin(game.time * 5 + bu.x);
      ctx.save();
      ctx.translate(bu.x, fy - 24);
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 10 + 8 * pulse;
      ctx.fillStyle = '#1f2d4d';
      rr(-13, -13, 26, 26, 6); ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      rr(-13, -13, 26, 26, 6); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fde047';
      ctx.font = '500 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bu.kind === 'turbo' ? '⚡' : bu.kind === 'quick' ? '🔩' : bu.kind === 'dbl' ? 'x2' : '🛡', 0, 5);
      ctx.restore();
    }
  }

  function drawSquad() {
    for (const h of game.squad) {
      const fy = game.floorYs[h.floor];
      ctx.save();
      ctx.translate(h.x, fy);
      const walkBob = h.timer > 0.3 ? Math.sin(game.time * 14 + h.floor * 2) * 1.2 : 0;
      ctx.translate(0, walkBob);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 1, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1565c0';
      rr(-7, -20, 14, 16, 3); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.moveTo(-6, -20); ctx.lineTo(0, -27); ctx.lineTo(6, -20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-6, -4, 4, 4);
      ctx.fillRect(2, -4, 4, 4);
      ctx.restore();
      if (h.job) {
        const ratio = 1 - h.job.t / (h.job.kind === 'cable' ? 1.6 : 3.2);
        ctx.save();
        ctx.strokeStyle = 'rgba(226,232,240,0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(h.x, fy - 34, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = h.job.kind === 'cable' ? game.object.pal.wire : '#4ade80';
        ctx.beginPath(); ctx.arc(h.x, fy - 34, 7, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawDevice(x, y, type) {
    ctx.save();
    ctx.translate(x, y);
    const blink = 0.55 + 0.45 * Math.sin(game.time * 6 + x);

    if (type === 'smoke') {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'manual') {
      ctx.fillStyle = '#b91c1c';
      rr(-10, -12, 20, 24, 4); ctx.fill();
      ctx.fillStyle = '#fecaca';
      ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'heat') {
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(4, -4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke();
    } else if (type === 'siren') {
      ctx.fillStyle = '#facc15';
      rr(-11, -8, 22, 16, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, ' + blink.toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 15, -0.9, 0.9); ctx.stroke();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = '#38bdf8';
      rr(-11, -13, 22, 26, 4); ctx.fill();
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(-7, -8, 14, 6);
      ctx.fillStyle = 'rgba(74, 222, 128, ' + blink.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(-5, 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(248, 113, 113, ' + blink.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(0, 4, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(250, 204, 21, ' + blink.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(5, 4, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 18); ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    const walking = game.state === 'play' && installing.timer <= 0 && !p.climbing &&
      (keys.has('left') || keys.has('right')) && p.stun <= 0;
    const bob = walking ? Math.sin(game.time * 16) * 1.5 : 0;
    const stunned = p.stun > 0;

    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h);
    // мягкая тень
    const sh = ctx.createRadialGradient(0, 2, 2, 0, 2, 16);
    sh.addColorStop(0, 'rgba(0,0,0,0.4)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.translate(0, bob);
    if (p.facing < 0) ctx.scale(-1, 1);

    const legPhase = walking ? Math.sin(game.time * 16) * 3 : 0;
    if (p.climbing) {
      // поза лазания: руки вверх, ноги на перекладинах
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-7, -12 + Math.sin(game.time * 8) * 2, 6, 12);
      ctx.fillRect(1, -12 - Math.sin(game.time * 8) * 2, 6, 12);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(-9, -44 + Math.cos(game.time * 8) * 2, 4, 16);
      ctx.fillRect(5, -44 - Math.cos(game.time * 8) * 2, 4, 16);
    } else {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-7, -12 + legPhase * 0.4, 6, 12);
      ctx.fillRect(1, -12 - legPhase * 0.4, 6, 12);
      ctx.fillStyle = '#f97316';
      rr(-9, -30, 18, 20, 4); ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(-9, -26, 18, 3);
      ctx.fillRect(-9, -19, 18, 3);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(-12, -28, 4, 14);
      ctx.fillRect(8, -28, 4, 14);
      // инструмент/катушка в руке
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(12, -22, 3, 10);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(11, -24, 5, 4);
    }

    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -35, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = has('helmet') ? '#fde047' : '#eab308';
    ctx.beginPath(); ctx.arc(0, -38, 7.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(-9, -38.5, 18, 2.6);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(1.5, -36, 2, 1.5);
    ctx.restore();

    if (stunned) {
      // звёздочки
      for (let i = 0; i < 3; i++) {
        const a = game.time * 7 + i * 2.1;
        ctx.save();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(p.x + p.w / 2 + Math.cos(a) * 12 - 2, p.y - 8 + Math.sin(a) * 6, 4, 4);
        ctx.restore();
      }
    }
  }

  function drawDrone() {
    if (!drone) return;
    const D = drone;
    ctx.save();
    ctx.translate(D.x, D.y);
    if (D.state === 'fall') ctx.rotate(D.rot);
    // корпус
    ctx.fillStyle = '#101a30';
    rr(-14, -5, 28, 10, 4); ctx.fill();
    ctx.fillStyle = '#1f2d4d';
    rr(-10, -3, 20, 6, 3); ctx.fill();
    // мигалка
    const blinking = Math.sin(game.time * 10) > 0;
    ctx.fillStyle = blinking ? '#f87171' : '#7f1d1d';
    ctx.fillRect(-3, -9, 6, 4);
    // прожектор вниз
    if (D.state === 'fly') {
      const beam = ctx.createLinearGradient(0, 6, 0, 90);
      beam.addColorStop(0, 'rgba(253, 224, 71, 0.18)');
      beam.addColorStop(1, 'rgba(253, 224, 71, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-5, 5); ctx.lineTo(5, 5); ctx.lineTo(18, 90); ctx.lineTo(-18, 90);
      ctx.closePath(); ctx.fill();
    }
    // винты
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 2;
    for (const rx of [-11, 11]) {
      const pw = 9 + Math.sin(game.time * 40 + rx) * 3;
      ctx.beginPath(); ctx.moveTo(rx - pw, -7); ctx.lineTo(rx + pw, -7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx, -10); ctx.lineTo(rx, -5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawLenin() {
    if (!lenin) return;
    const L = lenin;
    const fy = game.floorYs[L.floor];
    const walking = L.state === 'walk';
    const bob = walking ? Math.sin(game.time * 7 + L.floor) * 1.4 : 0;

    ctx.save();
    ctx.translate(L.x, fy);
    ctx.translate(0, bob);
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 1, 12, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    if (L.facing < 0) ctx.scale(-1, 1);

    // ноги и костюм
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6, -10, 4.5, 10);
    ctx.fillRect(2, -10, 4.5, 10);
    ctx.fillStyle = '#334155';
    rr(-9, -30, 18, 21, 3); ctx.fill();
    // галстук
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-1.5, -28, 3, 9);
    // руки
    ctx.fillStyle = '#334155';
    ctx.fillRect(-12, -28, 3.5, 14);
    ctx.fillRect(8.5, -28, 3.5, 14);
    // сигарета в перекуре
    if (L.state === 'smoke') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(10, -22, 5, 2);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(15, -22, 2, 2);
      // дым
      for (let i = 0; i < 3; i++) {
        const t = (game.time * 1.6 + i * 0.7) % 2.2;
        ctx.fillStyle = 'rgba(226, 232, 240, ' + (0.32 * (1 - t / 2.2)).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(16, -25 - t * 9, 2.5 + t * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // голова: лысина, борода-козлик
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -35, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f2a26';
    ctx.beginPath(); ctx.moveTo(2, -31); ctx.quadraticCurveTo(0, -27, -2, -31); ctx.lineTo(-2, -33); ctx.lineTo(2, -33); ctx.closePath(); ctx.fill();
    // кепка
    ctx.fillStyle = '#3f4653';
    ctx.beginPath(); ctx.arc(0, -37, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(-7.5, -37.5, 14.5, 2.4);
    ctx.fillRect(4, -37.5, 6, 2); // козырёк
    ctx.restore();

    // пузырь «ПЕРЕКУР!» при зове
    if (L.state === 'call') {
      const pulse = 0.6 + 0.4 * Math.sin(game.time * 9);
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      const bw = 78;
      rr(L.x - bw / 2, fy - 88, bw, 22, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = pulse;
      ctx.fillText('ПЕРЕКУР!', L.x, fy - 72);
      ctx.restore();
    }
  }

  function drawBoss() {
    if (!boss) return;
    const b = boss;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);

    const sh = ctx.createRadialGradient(0, 2, 2, 0, 2, 18);
    sh.addColorStop(0, 'rgba(0,0,0,0.38)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.ellipse(0, 2, 18, 5, 0, 0, Math.PI * 2); ctx.fill();

    const wob = Math.sin(game.time * 10) * 1.2;
    ctx.translate(0, wob);

    // скорбная фигура: животик, планшет, рогатая каска
    ctx.fillStyle = '#334155';
    ctx.fillRect(-8, -14, 7, 14);
    ctx.fillRect(2, -14, 7, 14);
    ctx.fillStyle = '#2563eb';
    rr(-13, -34, 26, 22, 5); ctx.fill();
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(-13, -30, 26, 3);
    // планшет
    ctx.fillStyle = '#e2e8f0';
    rr(10, -28, 8, 12, 2); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(11.5, -26.5, 5, 9);
    // голова
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(0, -40, 7, 0, Math.PI * 2); ctx.fill();
    // белая каска
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(0, -43, 8, Math.PI, 0); ctx.fill();
    ctx.fillRect(-10, -43.5, 20, 2.6);
    // брови: сердитые при angry
    ctx.fillStyle = b.angry > 0 ? '#dc2626' : '#1e293b';
    ctx.fillRect(1, -41, 4, 1.6);
    ctx.save();
    ctx.rotate(b.angry > 0 ? -0.4 : -0.15);
    ctx.fillRect(0.5, -42.5, 4, 1.6);
    ctx.restore();
    ctx.restore();

    // подпись при приёмке
    if (game.acceptance) {
      ctx.fillStyle = 'rgba(248,113,113,0.9)';
      ctx.font = '700 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ПРИЁМКА', b.x + b.w / 2, b.y - 54);
    }
  }

  function drawInstallProgress() {
    if (installing.timer <= 0) return;
    const ratio = 1 - installing.timer / installing.total;
    const cx = player.x + player.w / 2;
    const cy = player.y - 14;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = installing.kind === 'cable' ? game.object.pal.wire : '#4ade80';
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, 12, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2); ctx.stroke();
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
    const pal = game.object.pal;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawBackground(pal);
    for (const fy of game.floorYs) drawFloor(fy);
    for (const l of game.ladders) drawLadder(l);
    drawBoxes(pal);
    for (const c of game.cables) drawCable(c);
    drawPanel(pal);
    drawFlood();
    const activeSpot = installing.spot || nearestSpot();
    for (const s of game.spots) drawSpot(s, activeSpot);
    drawLayingCable();
    drawBuffs();
    drawSquad();
    drawLenin();
    drawMax();
    drawPlayer();
    drawBoss();
    drawDrone();
    drawInstallProgress();
    drawEffects();

    ctx.restore();

    // виньетка
    ctx.fillStyle = getVignette();
    ctx.fillRect(0, 0, W, H);

    // затемнение для школы
    if (game.object.dark) {
      const ny = player.y + player.h / 2;
      const nx = player.x + player.w / 2;
      const darkGrad = ctx.createRadialGradient(nx, ny, 60, nx, ny, W * 0.75);
      darkGrad.addColorStop(0, 'rgba(2, 6, 12, 0)');
      darkGrad.addColorStop(1, 'rgba(2, 6, 12, ' + game.object.dark.toFixed(2) + ')');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // блэкаут-помеха: густая тьма с фонариком
    if (game.debuff && game.debuff.type === 'blackout') {
      const ny = player.y + player.h / 2;
      const nx = player.x + player.w / 2;
      const bo = ctx.createRadialGradient(nx, ny, 70, nx, ny, W * 0.7);
      bo.addColorStop(0, 'rgba(1, 3, 8, 0)');
      bo.addColorStop(1, 'rgba(1, 3, 8, 0.8)');
      ctx.fillStyle = bo;
      ctx.fillRect(0, 0, W, H);
    }

    // красная тревога при дедлайне
    if (game.state === 'play' && game.shiftTime <= 10) {
      const pulse = (0.5 + 0.5 * Math.sin(game.time * 8)) * 0.28;
      ctx.fillStyle = 'rgba(220, 38, 38, ' + pulse.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // нижняя строка
    ctx.fillStyle = 'rgba(7, 11, 22, 0.85)';
    ctx.fillRect(0, H - 34, W, 34);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Объект: ' + game.object.name + ' · монтаж АПС · ' + (game.char ? game.char.name : '—'), 18, H - 13);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Смена ' + game.level + ' · осталось ' + (game.goal - game.installed), W - 18, H - 13);
  }

  // ================= ВВОД =================
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    Space: 'action', KeyE: 'action',
    KeyC: 'cable', KeyQ: 'cable',
    Enter: 'enter', KeyR: 'restart', KeyM: 'mute',
  };

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    // выбор персонажа цифрами 1..6
    if (game.state === 'select') {
      if (/^Digit[1-6]$/.test(e.code)) {
        e.preventDefault();
        chooseChar(CHARACTERS[Number(e.code.slice(5)) - 1].id);
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        chooseChar(game.char ? game.char.id : loadCharId());
        return;
      }
    }
    if (!action) return;
    e.preventDefault();
    AudioSys.unlock();
    if (e.repeat) return;

    if (action === 'restart') {
      if (game.state !== 'select') resetGame();
      return;
    }
    if (action === 'enter') {
      if (game.state === 'fired') { resetGame(); return; }
      if (game.state === 'levelup') { nextLevel(); return; }
    }
    if (action === 'mute') { AudioSys.setMuted(!AudioSys.muted); return; }
    if (action === 'action') { tryInstall(); return; }
    if (action === 'cable') { tryLayCable(); return; }
    keys.add(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  });
  window.addEventListener('blur', () => keys.clear());

  if (muteBtn) muteBtn.addEventListener('click', () => AudioSys.setMuted(!AudioSys.muted));

  ovUnlock.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-char]');
    if (btn) { AudioSys.unlock(); chooseChar(btn.getAttribute('data-char')); }
    const go = e.target.closest('[data-goselect]');
    if (go) { AudioSys.unlock(); openSelect(); }
  });

  const charBtn = document.getElementById('btn-char');
  if (charBtn) charBtn.addEventListener('click', () => { AudioSys.unlock(); openSelect(); });

  ovBtn.addEventListener('click', () => {
    if (game.state === 'fired') resetGame();
    else nextLevel();
  });

  document.addEventListener('pointerdown', () => AudioSys.unlock(), { once: true });

  const touchButtons = document.querySelectorAll('[data-k]');
  touchButtons.forEach((button) => {
    const key = button.getAttribute('data-k');
    const press = (e) => {
      e.preventDefault();
      AudioSys.unlock();
      if (key === 'action') { tryInstall(); return; }
      if (key === 'cable') { tryLayCable(); return; }
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

  // ================= ДЖОЙСТИК + ВЕСЬ ЭКРАН =================
  const joyEl = document.getElementById('joy');
  const joyKnob = document.getElementById('joy-knob');
  const joyState = { id: null, ox: 0, oy: 0 };
  const joyTouch = new URLSearchParams(location.search).has('touch') ||
    window.matchMedia('(pointer: coarse)').matches;

  function joyClearKeys() {
    keys.delete('left'); keys.delete('right'); keys.delete('up'); keys.delete('down');
  }

  function joyApply(dx, dy) {
    joyClearKeys();
    const T = 0.36;
    if (dx > T) keys.add('right'); else if (dx < -T) keys.add('left');
    if (dy > T) keys.add('down'); else if (dy < -T) keys.add('up');
  }

  function joyMove(px, py) {
    let dx = (px - joyState.ox) / 46;
    let dy = (py - joyState.oy) / 46;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    joyApply(dx, dy);
    if (joyKnob) joyKnob.style.transform = 'translate(' + Math.round(dx * 38) + 'px,' + Math.round(dy * 38) + 'px)';
  }

  function joyHide() {
    joyState.id = null;
    joyClearKeys();
    if (joyEl) joyEl.hidden = true;
    if (joyKnob) joyKnob.style.transform = 'translate(0,0)';
  }

  function tryFullscreen() {
    const de = document.documentElement;
    if (!document.fullscreenElement) {
      if (de.requestFullscreen) de.requestFullscreen().catch(() => {});
    }
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  }

  if (joyEl) {
    stageEl.addEventListener('pointerdown', (e) => {
      if (!joyTouch || joyState.id !== null) return;
      joyState.id = e.pointerId;
      joyState.ox = e.clientX;
      joyState.oy = e.clientY;
      joyEl.style.left = e.clientX - stageEl.getBoundingClientRect().left + 'px';
      joyEl.style.top = e.clientY - stageEl.getBoundingClientRect().top + 'px';
      joyEl.hidden = false;
      joyMove(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyState.id) return;
      joyMove(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerId === joyState.id) joyHide();
    });
    window.addEventListener('pointercancel', () => joyHide());
  }

  stageEl.addEventListener('pointerdown', (e) => {
    if (!joyTouch) return;
    tryFullscreen();
  }, { once: true });

  const fullBtn = document.getElementById('btn-full');
  if (fullBtn) fullBtn.addEventListener('click', () => { AudioSys.unlock(); tryFullscreen(); });

  // ================= ЗАПУСК =================
  function fitStage() {
    const rect = stageEl.getBoundingClientRect();
    const availW = Math.max(120, rect.width - (joyTouch ? 0 : 8));
    const availH = Math.max(120, rect.height - (joyTouch ? 0 : 0));
    const scale = Math.min(availW / W, availH / H);
    canvas.style.width = Math.round(W * scale) + 'px';
    canvas.style.height = Math.round(H * scale) + 'px';
  }
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 120));
  fitStage();

  window.__aps = {
    game, player, keys, unlocked, get boss() { return boss; },
    spots: () => game.spots, floors: () => game.floorYs,
    chars: () => CHARACTERS, chooseChar, openSelect,
    startLevel, tryInstall, tryLayCable, tryAccept, nextLevel, resetGame,
    summonLenin, lenin: () => lenin, fitStage, tryFullscreen,
    drone: () => drone, forceDroneDrop: () => { if (!drone) spawnDrone(); if (drone) { drone.state = 'fall'; drone.vy = 30; } },
    inspectForce: inspectNow, forceFlood,
    summonMax, max: () => max, fireWorker,
    audio: AudioSys,
  };

  game.best = loadBest();
  startLevel(1);
  openSelect();

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
