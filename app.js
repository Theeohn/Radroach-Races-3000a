// =============================================================================
//  Name: Radroach Races
//  License: CC-BY-NC-4.0
//  Repository: https://github.com/Theeohn/Radroach-Races
// =============================================================================

(function() {
  let mainLoopInterval = null;
  let countdownTimer = null;

  // Game States
  let gameState = 'TITLE_SCREEN';
  let winnerId = -1;
  let countdownValue = 5;
  let currentMapId = 0;
  let trackWalls = [];
  let goalPos = { x: 0, y: 0, w: 14, h: 14 };
  let startX = 0;
  let startYBase = 0;
  let radroaches = [];

  // Sound limiter — max 2 bounce sound instances at once
  let bounceSoundCount = 0;

  const SHAPE_NAMES = { 1: 'SQUARE', 2: 'TRIANGLE', 3: 'DIAMOND', 4: 'CROSS', 5: 'HEXAGON' };

  // Per-shape geometry. "half" is the visual half-extent used when drawing
  // (square/diamond scaled per spec; triangle/cross/hexagon keep the
  // original 7px half-extent). "hitR" is the invisible circular hitbox
  // radius, set to exactly reach that shape's farthest vertex — verts
  // rest just inside the circle, never poking out.
  const SHAPES = {
    square:   { half: 6.72, hitR: 9.51 }, // 7 * 0.96, corner = half*sqrt(2) = 9.5035
    triangle: { half: 7,    hitR: 9.91 }, // bottom corners farthest = sqrt(7^2+7^2) = 9.8995
    diamond:  { half: 7.28, hitR: 7.29 }, // 7 * 1.04, verts already on the radius = 7.28
    cross:    { half: 7,    hitR: 7.63 }, // arm half-len 7, half-width 3 -> sqrt(7^2+3^2) = 7.6158
    hexagon:  { half: 7,    hitR: 7.83 }  // top/bottom verts at q=3.5 in from corner = sqrt(3.5^2+7^2) = 7.8262
  };

  // Play area: 480x320 screen, with margin
  // PLAY_AREA: x1=18, x2=465, y1=18, y2=298

  // MAP_BLUEPRINTS derived from Horse Race Test map images.
  // Walls are line segments (x1,y1)-(x2,y2) representing internal barriers.
  // Outer boundary enforcement is handled by PLAY_AREA bounce logic.
  // Start positions are from the yellow START box (top-left region of each map).
  // Goal positions are from the checkered flag square in each map image.
  //
  // Map coordinate space: 480x320, play area inset x1=18, x2=465, y1=18, y2=298.
  // Wall coordinates are scaled/mapped from each image's proportional layout.

  const MAP_BLUEPRINTS = [
    // Map 1: S-shaped winding tunnel with two horizontal corridors and two vertical connectors.
    // Start: top-left. Goal: center-right area (checkered flag near x=340, y=240 in image).
    {
      goal: { x: 375, y: 200 },
      start: { x: 30, y: 55 },
      walls: [
        // Upper horizontal divider — splits top corridor from mid section
        { x1: 18,  y1: 155, x2: 270, y2: 155 },
        // Lower horizontal divider — creates bottom corridor
        { x1: 200, y1: 220, x2: 465, y2: 220 },
        // Left vertical connector — joins upper and mid dividers.
        // Starts at y=80 (not the pen's top edge) so a 35px gap remains at the
        // top-right corner of the start pen — wide enough for a 14px roach to escape through.
        { x1: 270, y1: 80,  x2: 270, y2: 155 },
        // Right vertical connector — joins mid and lower dividers
        { x1: 200, y1: 155, x2: 200, y2: 285 }
      ]
    },
    // Map 2: Large open floor with a central U-shaped funnel and a left side pocket.
    // Start: top-left. Goal: center (checkered flag near x=270, y=215 in image).
    {
      goal: { x: 40, y: 65 },
      start: { x: 30, y: 100 },
      walls: [
        // Top horizontal bar cutting upper-right off
        { x1: 18,  y1: 95,  x2: 185, y2: 95  },
        // Vertical drop from top bar — forms left wall of funnel
        { x1: 185, y1: 95,  x2: 185, y2: 200 },
        // Bottom of funnel — horizontal join
        { x1: 185, y1: 200, x2: 310, y2: 200 },
        // Left side pocket wall — partial vertical on left
        { x1: 80,  y1: 200, x2: 80,  y2: 285 }
      ]
    },
    // Map 3: Jagged rocky terrain with a diagonal central obstacle and upper corridor blocker.
    // Start: top-left. Goal: left-center (checkered flag near x=250, y=235 in image).
    {
      goal: { x: 340, y: 50 },
      start: { x: 30, y: 185 },
      walls: [
        // Upper wall — cuts off top passage, forcing left or right routing
        { x1: 100, y1: 55,  x2: 100, y2: 170 },
        // Mid horizontal — central barrier across map
        { x1: 100, y1: 170, x2: 310, y2: 170 },
        // Lower right horizontal — forces lower path on right side
        { x1: 210, y1: 220, x2: 465, y2: 220 }
      ]
    },
    // Map 4: Boxy corridors with a large hollow central rectangle (room with no exit until corners).
    // Start: top-left. Goal: left-center pocket (checkered flag near x=65, y=215 in image).
    {
      goal: { x: 415, y: 205 },
      start: { x: 30, y: 110 },
      walls: [
        // Top bar of central box
        { x1: 130, y1: 105, x2: 385, y2: 105 },
        // Bottom bar of central box
        { x1: 130, y1: 245, x2: 385, y2: 245 },
        // Left bar of central box
        { x1: 130, y1: 105, x2: 130, y2: 245 },
        // Right bar of central box
        { x1: 385, y1: 105, x2: 385, y2: 245 }
      ]
    },
    // Map 5: Organic blob terrain with a winding path. Two horizontal bands create level splits.
    // Start: top-left. Goal: right-center (checkered flag near x=390, y=210 in image).
    {
      goal: { x: 42, y: 272 },
      start: { x: 30, y: 55 },
      walls: [
        // Upper horizontal band — forces traffic to split above or below
        { x1: 18,  y1: 165, x2: 355, y2: 165 },
        // Lower horizontal band — second level split
        { x1: 90,  y1: 240, x2: 465, y2: 240 }
      ]
    }
  ];

  // ─── Title Screen ─────────────────────────────────────────────────────────

  function showTitleScreen() {
    gameState = 'TITLE_SCREEN';
    winnerId = -1;

    h.setColor(0).fillRect(0, 0, 480, 320);
    h.setColor(2).drawRect(18, 18, 465, 298);

    h.setFont("Monofonto23").setFontAlign(0, -1).setColor(3);
    h.drawString("Radroach Races", 240, 55);

    // Fence backdrop
    h.setColor(2);
    h.drawLine(55, 180, 425, 180);
    h.drawLine(55, 200, 425, 200);
    for (let fx = 75; fx < 425; fx += 35) {
      h.fillRect(fx, 150, fx + 15, 230);
    }

    // Grass tufts
    for (let gx = 35; gx < 445; gx += 12) {
      h.drawLine(gx, 230, gx - 4, 210);
      h.drawLine(gx + 3, 230, gx + 6, 205);
    }

    // Cockroach vector art
    h.setColor(3);
    h.fillEllipse(200, 165, 280, 215);
    h.fillCircle(240, 150, 18);
    h.drawLine(236, 138, 205, 105);
    h.drawLine(244, 138, 275, 105);
    h.drawPoly([205, 165, 180, 175, 165, 200], false);
    h.drawPoly([200, 190, 175, 200, 160, 230], false);
    h.drawPoly([275, 165, 300, 175, 315, 200], false);
    h.drawPoly([280, 190, 305, 200, 320, 230], false);

    h.setFont("Monofonto16").setFontAlign(0, -1).setColor(3);
    h.drawString("PRESS LEFT WHEEL TO START!", 240, 270);

    h.flip();
    Pip.lastFlip = getTime();

    Pip.onExclusive("knob1", handleKnobStart);
  }

  function handleKnobStart(dir) {
    if (dir !== 0) return;
    if (gameState === 'TITLE_SCREEN') {
      Pip.audioStart('HOLO/RADROACH_RACES/BUGLE.WAV');
      startCountdown();
    } else if (gameState === 'GAMEOVER') {
      showTitleScreen();
    }
  }

  // ─── Countdown ────────────────────────────────────────────────────────────

  function startCountdown() {
    gameState = 'COUNTDOWN';
    countdownValue = 5;

    currentMapId = Math.randInt(5);
    const bp = MAP_BLUEPRINTS[currentMapId];
    trackWalls = bp.walls;
    goalPos.x = bp.goal.x;
    goalPos.y = bp.goal.y;
    startX = bp.start.x;
    startYBase = bp.start.y;

    // Initialise radroaches DVD-logo style: each gets its own random angle,
    // so every roach heads off in a near-random direction from the start.
    // Speed magnitude stays constant (3 px/tick); only the angle varies.
    // Position is tracked as a center point (cx, cy) since every hitbox
    // is now a circle drawn around that center.
    radroaches = [
      { id: 1, shape: 'square',   cx: startX + 7, cy: startYBase + 7,      vx: 0, vy: 0 },
      { id: 2, shape: 'triangle', cx: startX + 7, cy: startYBase + 7 + 18, vx: 0, vy: 0 },
      { id: 3, shape: 'diamond',  cx: startX + 7, cy: startYBase + 7 + 36, vx: 0, vy: 0 },
      { id: 4, shape: 'cross',    cx: startX + 7, cy: startYBase + 7 + 54, vx: 0, vy: 0 },
      { id: 5, shape: 'hexagon',  cx: startX + 7, cy: startYBase + 7 + 72, vx: 0, vy: 0 }
    ];
    for (let i = 0; i < radroaches.length; i++) {
      setRandomVelocity(radroaches[i], 3);
    }

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tickCountdown, 1000);
    tickCountdown();
  }

  function tickCountdown() {
    if (gameState !== 'COUNTDOWN') return;

    h.setColor(0).fillRect(0, 0, 480, 320);
    drawTrack();

    for (let i = 0; i < radroaches.length; i++) {
      drawShape(radroaches[i]);
    }

    if (countdownValue > 0) {
      h.setFont("Monofonto96").setFontAlign(0, 0).setColor(3);
      h.drawString(countdownValue.toString(), 240, 160);
      countdownValue--;
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      gameState = 'RACING';
    }

    h.flip();
    Pip.lastFlip = getTime();
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  // Each roach is drawn with a double-stroke outline — the same silhouette
  // traced twice, the second pass inset by 1px — so the line reads as
  // roughly 2px thick instead of a single hairline, plus the brightest
  // palette color (3) instead of the track's color (1) so roaches stand
  // out clearly against the track/walls. Size and fill are unchanged —
  // only stroke weight and color increase visibility.
  function drawShape(r) {
    const s = SHAPES[r.shape], cx = r.cx, cy = r.cy, hf = s.half, hf2 = hf - 1;
    h.setColor(3);

    if (r.shape === 'square') {
      h.drawRect(cx - hf, cy - hf, cx + hf, cy + hf);
      h.drawRect(cx - hf2, cy - hf2, cx + hf2, cy + hf2);
    } else if (r.shape === 'triangle') {
      h.drawPoly([cx, cy - hf, cx + hf, cy + hf, cx - hf, cy + hf], true);
      h.drawPoly([cx, cy - hf2, cx + hf2, cy + hf2, cx - hf2, cy + hf2], true);
    } else if (r.shape === 'diamond') {
      h.drawPoly([cx, cy - hf, cx + hf, cy, cx, cy + hf, cx - hf, cy], true);
      h.drawPoly([cx, cy - hf2, cx + hf2, cy, cx, cy + hf2, cx - hf2, cy], true);
    } else if (r.shape === 'cross') {
      const w1 = 3, w2 = 2;
      h.drawPoly([
        cx - w1, cy - hf,  cx + w1, cy - hf,  cx + w1, cy - w1,
        cx + hf, cy - w1,  cx + hf, cy + w1,  cx + w1, cy + w1,
        cx + w1, cy + hf,  cx - w1, cy + hf,  cx - w1, cy + w1,
        cx - hf, cy + w1,  cx - hf, cy - w1,  cx - w1, cy - w1
      ], true);
      h.drawPoly([
        cx - w2, cy - hf2,  cx + w2, cy - hf2,  cx + w2, cy - w2,
        cx + hf2, cy - w2,  cx + hf2, cy + w2,  cx + w2, cy + w2,
        cx + w2, cy + hf2,  cx - w2, cy + hf2,  cx - w2, cy + w2,
        cx - hf2, cy + w2,  cx - hf2, cy - w2,  cx - w2, cy - w2
      ], true);
    } else if (r.shape === 'hexagon') {
      const q = hf / 2, q2 = hf2 / 2;
      h.drawPoly([cx - hf + q, cy - hf, cx + hf - q, cy - hf, cx + hf, cy, cx + hf - q, cy + hf, cx - hf + q, cy + hf, cx - hf, cy], true);
      h.drawPoly([cx - hf2 + q2, cy - hf2, cx + hf2 - q2, cy - hf2, cx + hf2, cy, cx + hf2 - q2, cy + hf2, cx - hf2 + q2, cy + hf2, cx - hf2, cy], true);
    }
  }

  function drawTrack() {
    h.setColor(3);
    h.drawRect(18, 18, 465, 298);

    for (let i = 0; i < trackWalls.length; i++) {
      const w = trackWalls[i];
      h.drawLine(w.x1, w.y1, w.x2, w.y2);
    }

    // Map label top-left
    h.setFont("Monofonto14").setFontAlign(-1, -1).setColor(2);
    h.drawString("Map " + (currentMapId + 1), 21, 21);

    // Goal marker (bright block, same footprint as a radroach)
    h.setColor(3);
    h.fillRect(goalPos.x, goalPos.y, goalPos.x + goalPos.w, goalPos.y + goalPos.h);
    // Stem detail above goal
    h.setColor(2);
    h.fillRect(goalPos.x + 4, goalPos.y - 6, goalPos.x + 10, goalPos.y);
    h.fillRect(goalPos.x - 4, goalPos.y + 4, goalPos.x, goalPos.y + 10);
  }

  // ─── Physics ──────────────────────────────────────────────────────────────

  // Set a roach's velocity to a random angle at the given speed magnitude.
  // Used both for the initial DVD-logo-style launch and for the small
  // randomised kick applied after every bounce.
  function setRandomVelocity(r, speed) {
    // Random angle in [0, 2*PI). Math.randInt(360) gives a degree value,
    // converted to radians — avoids floating point random() per the no-Math.random rule.
    const deg = Math.randInt(360);
    const rad = deg * 0.017453292519943295;
    r.vx = Math.cos(rad) * speed;
    r.vy = Math.sin(rad) * speed;
  }

  // Nudge an existing velocity vector by a random angle (±40°) while
  // preserving its speed — keeps the DVD-logo "near random, not truly random"
  // bounce: a real reflection, with a touch of unpredictability so paths
  // never repeat the exact same loop.
  function jitterVelocity(r) {
    const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
    const curAngle = Math.atan2(r.vy, r.vx);
    const jitterDeg = Math.randInt(9) - 40;
    const newAngle = curAngle + jitterDeg * 0.017453292519943295;
    r.vx = Math.cos(newAngle) * speed;
    r.vy = Math.sin(newAngle) * speed;
  }

  function checkWallCollision(r) {  "ram";
    let bounced = false;
    const hr = SHAPES[r.shape].hitR;

    // Play area boundary bounce — circle vs the four play-area edges
    if (r.cx - hr <= 18) {
      r.cx = 18 + hr; r.vx = Math.abs(r.vx); bounced = true;
    } else if (r.cx + hr >= 465) {
      r.cx = 465 - hr; r.vx = -Math.abs(r.vx); bounced = true;
    }
    if (r.cy - hr <= 18) {
      r.cy = 18 + hr; r.vy = Math.abs(r.vy); bounced = true;
    } else if (r.cy + hr >= 298) {
      r.cy = 298 - hr; r.vy = -Math.abs(r.vy); bounced = true;
    }

    // Internal wall bounce — walls are axis-aligned segments, so treat
    // each as a thick band of half-width = hitbox radius around the line.
    for (let i = 0; i < trackWalls.length; i++) {
      const w = trackWalls[i];
      const wx1 = Math.min(w.x1, w.x2);
      const wx2 = Math.max(w.x1, w.x2);
      const wy1 = Math.min(w.y1, w.y2);
      const wy2 = Math.max(w.y1, w.y2);

      // Broad overlap check using the roach's own hitbox radius as buffer
      if (r.cx + hr >= wx1 - hr && r.cx - hr <= wx2 + hr &&
          r.cy + hr >= wy1 - hr && r.cy - hr <= wy2 + hr) {

        if (wy2 - wy1 < 6) {
          // Horizontal wall — flip vy
          r.vy = -r.vy;
          r.cy += r.vy * 2;
          bounced = true;
        } else if (wx2 - wx1 < 6) {
          // Vertical wall — flip vx
          r.vx = -r.vx;
          r.cx += r.vx * 2;
          bounced = true;
        }
      }
    }

    if (bounced) {
      jitterVelocity(r);
    }
  }

  // Roach-vs-roach collision: circle-vs-circle. Each roach reflects its
  // own velocity off the collision normal (the line between the two
  // centers) and keeps its own pre-collision speed — no inertia/speed
  // is exchanged between roaches, matching the wall-bounce behaviour of
  // "direction changes, speed never does." A small separating push keeps
  // overlapping circles from sticking, then the same DVD-logo jitter as
  // a wall bounce is applied to each.
  function checkRoachCollisions() {  "ram";
    for (let i = 0; i < radroaches.length; i++) {
      for (let j = i + 1; j < radroaches.length; j++) {
        const a = radroaches[i];
        const b = radroaches[j];
        const rSum = SHAPES[a.shape].hitR + SHAPES[b.shape].hitR;

        const dx = a.cx - b.cx;
        const dy = a.cy - b.cy;
        const distSq = dx * dx + dy * dy;

        if (distSq < rSum * rSum && distSq > 0) {
          const dist = Math.sqrt(distSq);
          // Unit collision normal, pointing from b toward a
          const nx = dx / dist, ny = dy / dist;

          // Separate so circles no longer overlap
          const overlap = (rSum - dist) / 2;
          a.cx += nx * overlap; a.cy += ny * overlap;
          b.cx -= nx * overlap; b.cy -= ny * overlap;

          // Reflect each roach's own velocity across the normal (mirror
          // the component along the normal) — same speed in, same speed
          // out, only direction changes, just like a wall bounce.
          const aDot = a.vx * nx + a.vy * ny;
          a.vx -= 2 * aDot * nx; a.vy -= 2 * aDot * ny;

          const bDot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * bDot * nx; b.vy -= 2 * bDot * ny;

          jitterVelocity(a);
          jitterVelocity(b);
        }
      }
    }
  }

  function updatePhysics() {  "ram";
    if (gameState !== 'RACING') return;

    // Erase previous positions
    h.setColor(0);
    for (let i = 0; i < radroaches.length; i++) {
      const r = radroaches[i];
      const hr = SHAPES[r.shape].hitR;
      h.fillRect(r.cx - hr - 2, r.cy - hr - 2, r.cx + hr + 2, r.cy + hr + 2);
    }

    // Move and check wall/edge collisions
    for (let i = 0; i < radroaches.length; i++) {
      const r = radroaches[i];
      r.cx += r.vx;
      r.cy += r.vy;

      checkWallCollision(r);
    }

    // Roach-vs-roach collisions (after movement, before goal check)
    checkRoachCollisions();

    // Goal collision — only one roach can occupy the mutfruit
    for (let i = 0; i < radroaches.length; i++) {
      const r = radroaches[i];
      const hr = SHAPES[r.shape].hitR;
      if (r.cx + hr >= goalPos.x && r.cx - hr <= goalPos.x + goalPos.w &&
          r.cy + hr >= goalPos.y && r.cy - hr <= goalPos.y + goalPos.h) {
        gameState = 'GAMEOVER';
        winnerId = r.id;
        Pip.audioStart('HOLO/RADROACH_RACES/WINNER.WAV');
        break;
      }
    }

    drawTrack();

    for (let i = 0; i < radroaches.length; i++) {
      drawShape(radroaches[i]);
    }

    if (gameState === 'GAMEOVER') {
      displayWinner();
    }

    h.flip();
    Pip.lastFlip = getTime();
  }

  function displayWinner() {
    h.setColor(0).fillRect(120, 130, 360, 190);
    h.setColor(3).drawRect(122, 132, 358, 188);

    h.setFont("Monofonto16").setFontAlign(0, -1).setColor(2);
    h.drawString(SHAPE_NAMES[winnerId] + " ROACH WINS!", 240, 142);
    h.setFont("Monofonto14");
    h.drawString("PRESS LEFT WHEEL TO RESTART", 240, 168);
  }

  // ─── Main Loop ────────────────────────────────────────────────────────────

  function mainLoop() {
    if (gameState === 'RACING') {
      updatePhysics();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  showTitleScreen();
  mainLoopInterval = setInterval(mainLoop, 33); // ~30fps

  return {
    id: "RADROACHRACES",
    notDefault: true,
    fullscreen: true,
    remove: function() {
      if (mainLoopInterval) { clearInterval(mainLoopInterval); mainLoopInterval = null; }
      if (countdownTimer)   { clearInterval(countdownTimer);   countdownTimer = null; }
      Pip.removeListener("knob1", handleKnobStart);
      Pip.audioStop();
    }
  };
});