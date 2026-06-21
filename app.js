// =============================================================================
//  Name: Radroach Races
//  Author: Theeohn Megistus
//  License: CC-BY-NC-4.0
//  Repository: https://github.com/Theeohn/Radroach-Races
// =============================================================================

(function() {
  const drawLineCached = h.drawLine.bind(h);

  const dirty = new Int16Array(20);

  let mainLoopInterval = null;
  let countdownTimer = null;

  // Game States
  let gameState = 'TITLE_SCREEN';
  let winnerId = -1;
  let countdownValue = 5;
  let currentMapId = 0;

  let trackWalls = new Int16Array(0);

  let goalPos = { x: 0, y: 0, w: 18, h: 18, hitW: 17, hitH: 17 };
  let startX = 0;
  let startYBase = 0;
  let radroaches = [];

  let trackDirty = 1;

  const SHAPE_NAMES = { 1: 'SQUARE', 2: 'TRIANGLE', 3: 'DIAMOND', 4: 'PENTAGON', 5: 'HEXAGON' };

  const SHAPES = {
    square:   { half: 8.6,   hitR: 11.0 },
    triangle: { half: 11.15, hitR: 11.4 },
    diamond:  { half: 9.86,  hitR: 11.4 },
    pentagon: { half: 9.78,  hitR: 11.4 },
    hexagon:  { half: 9.11,  hitR: 11.4 }
  };

  // ─── Map Data ─────────────────────────────────────────────────────────────
  //
  // Format per map entry in MAP_DATA:
  //   index+0 : goalX
  //   index+1 : goalY
  //   index+2 : startX
  //   index+3 : startY
  //   index+4 : wallCount  (number of walls)
  //   index+5 .. index+4+wallCount*4 : wall entries (x1,y1,x2,y2 each)

  const MAP_DATA = new Int16Array([
    // Map 1
    420, 205, 25, 90,  0,

    // Map 2
    42, 58, 30, 130,  4,
    18, 95, 185, 95,
    185, 95, 185, 200,
    185, 200, 310, 200,
    320, 18, 320, 85,

    // Map 3
    340, 50, 30, 185,  3,
    100, 60, 100, 170,
    100, 135, 310, 135,
    210, 220, 465, 220,

    // Map 4
    375, 192, 30, 45,  4,
    18, 155, 270, 155,
    200, 220, 465, 220,
    270, 95, 270, 155,
    200, 155, 200, 298,

    // Map 5
    60, 145, 63, 25,  4,
    18, 130, 365, 130,
    115, 205, 365, 205,
    115, 130, 115, 205,
    365, 130, 365, 205,

    // Map 6
    135, 31, 28, 190,  7,
    18, 180, 285, 180,
    285, 180, 285, 80,
    120, 80, 285, 80,
    120, 18, 120, 80,
    380, 100, 465, 100,
    380, 100, 380, 298,
    346, 18, 346, 56,

    // Map 7
    75, 250, 63, 30,  7,
    18, 136, 165, 136,
    218, 128, 323, 128,
    323, 128, 323, 90,
    100, 180, 205, 180,
    319, 220, 319, 298,
    18, 229, 180, 229
  ]);

  // Pre-compute the starting index in MAP_DATA for each map.
  const MAP_OFFSETS = new Int16Array(7);
  (function() {
    let pos = 0;
    for (let m = 0; m < 7; m++) {
      MAP_OFFSETS[m] = pos;
      pos += 5 + MAP_DATA[pos + 4] * 4;
    }
  })();

  // ─── Title Screen ─────────────────────────────────────────────────────────

  function showTitleScreen() {
    gameState = 'TITLE_SCREEN';
    winnerId = -1;

    h.setColor(0).fillRect(0, 0, 480, 320);
    h.setColor(2).drawRect(18, 18, 465, 298);

    h.setFont("Monofonto23").setFontAlign(0, -1).setColor(3);
    h.drawString("Radroach Races", 240, 55);

    h.setColor(2);
    h.drawLine(55, 180, 425, 180);
    h.drawLine(55, 200, 425, 200);
    for (let fx = 75; fx < 425; fx += 35) {
      h.fillRect(fx, 150, fx + 15, 230);
    }

    for (let gx = 35; gx < 445; gx += 12) {
      h.drawLine(gx, 230, gx - 4, 210);
      h.drawLine(gx + 3, 230, gx + 6, 205);
    }

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

    currentMapId = Math.randInt(7);
    const base = MAP_OFFSETS[currentMapId];
    const wallCount = MAP_DATA[base + 4];

    trackWalls = new Int16Array(wallCount * 4);
    for (let i = 0; i < wallCount; i++) {
      const src = base + 5 + i * 4;
      const dst = i * 4;
      trackWalls[dst]   = MAP_DATA[src];
      trackWalls[dst+1] = MAP_DATA[src+1];
      trackWalls[dst+2] = MAP_DATA[src+2];
      trackWalls[dst+3] = MAP_DATA[src+3];
    }

    goalPos.x  = MAP_DATA[base];
    goalPos.y  = MAP_DATA[base + 1];
    startX     = MAP_DATA[base + 2];
    startYBase = MAP_DATA[base + 3];

    // Shuffle spawn slots so roach order varies each race
    const slots = [0, 21, 42, 63, 84];
    for (let s = 4; s > 0; s--) {
      const sv = Math.randInt(s + 1);
      const tmp = slots[s]; slots[s] = slots[sv]; slots[sv] = tmp;
    }
    radroaches = [
      { id: 1, shape: 'square',   cx: startX + 7, cy: startYBase + 7 + slots[0], vx: 0, vy: 0, hitR: SHAPES.square.hitR },
      { id: 2, shape: 'triangle', cx: startX + 7, cy: startYBase + 7 + slots[1], vx: 0, vy: 0, hitR: SHAPES.triangle.hitR },
      { id: 3, shape: 'diamond',  cx: startX + 7, cy: startYBase + 7 + slots[2], vx: 0, vy: 0, hitR: SHAPES.diamond.hitR },
      { id: 4, shape: 'pentagon', cx: startX + 7, cy: startYBase + 7 + slots[3], vx: 0, vy: 0, hitR: SHAPES.pentagon.hitR },
      { id: 5, shape: 'hexagon',  cx: startX + 7, cy: startYBase + 7 + slots[4], vx: 0, vy: 0, hitR: SHAPES.hexagon.hitR }
    ];
    for (let i = 0; i < radroaches.length; i++) {
      setRandomVelocity(radroaches[i], 4);
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
      trackDirty = 1;
    }

    h.flip();
    Pip.lastFlip = getTime();
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────

  function drawShape(r) {
    const s = SHAPES[r.shape], cx = r.cx, cy = r.cy, hf = s.half, hf2 = hf - 1;
    h.setColor(3);

    if (r.shape === 'square') {
      h.drawRect(cx - hf, cy - hf, cx + hf, cy + hf);
      h.drawRect(cx - hf2, cy - hf2, cx + hf2, cy + hf2);
    } else if (r.shape === 'triangle') {
      h.drawPoly([cx, cy - hf, cx + hf * 0.866, cy + hf * 0.5, cx - hf * 0.866, cy + hf * 0.5], true);
      h.drawPoly([cx, cy - hf2, cx + hf2 * 0.866, cy + hf2 * 0.5, cx - hf2 * 0.866, cy + hf2 * 0.5], true);
    } else if (r.shape === 'diamond') {
      h.drawPoly([cx, cy - hf, cx + hf, cy, cx, cy + hf, cx - hf, cy], true);
      h.drawPoly([cx, cy - hf2, cx + hf2, cy, cx, cy + hf2, cx - hf2, cy], true);
    } else if (r.shape === 'pentagon') {
      h.drawPoly([
        cx, cy - hf,
        cx + hf * 0.951, cy - hf * 0.309,
        cx + hf * 0.588, cy + hf * 0.809,
        cx - hf * 0.588, cy + hf * 0.809,
        cx - hf * 0.951, cy - hf * 0.309
      ], true);
      h.drawPoly([
        cx, cy - hf2,
        cx + hf2 * 0.951, cy - hf2 * 0.309,
        cx + hf2 * 0.588, cy + hf2 * 0.809,
        cx - hf2 * 0.588, cy + hf2 * 0.809,
        cx - hf2 * 0.951, cy - hf2 * 0.309
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
    h.drawRect(19, 19, 464, 297);

    for (let i = 0; i < trackWalls.length; i += 4) {
      const lx1 = trackWalls[i], ly1 = trackWalls[i+1], lx2 = trackWalls[i+2], ly2 = trackWalls[i+3];
      drawLineCached(lx1, ly1, lx2, ly2);
      // Double-pixel width: offset by 1 on the thin axis so the line reads clearly
      const spanY = ly2 > ly1 ? ly2 - ly1 : ly1 - ly2;
      const spanX = lx2 > lx1 ? lx2 - lx1 : lx1 - lx2;
      if (spanY < spanX) {
        drawLineCached(lx1, ly1 + 1, lx2, ly2 + 1);
      } else {
        drawLineCached(lx1 + 1, ly1, lx2 + 1, ly2);
      }
    }

    h.setFont("Monofonto14").setFontAlign(-1, -1).setColor(2);
    h.drawString("Map " + (currentMapId + 1), 25, 25);

    h.setColor(3);
    h.fillRect(goalPos.x, goalPos.y, goalPos.x + goalPos.w, goalPos.y + goalPos.h);
    h.setColor(2);
    h.fillRect(goalPos.x + 6, goalPos.y - 8, goalPos.x + 11, goalPos.y);
    h.fillRect(goalPos.x - 6, goalPos.y + 6, goalPos.x, goalPos.y + 11);
  }

  // ─── Physics ──────────────────────────────────────────────────────────────

  function setRandomVelocity(r, speed) {
    const deg = Math.randInt(360);
    const rad = deg * 0.017453292519943295;
    r.vx = Math.cos(rad) * speed;
    r.vy = Math.sin(rad) * speed;
  }

  function jitterVelocity(r) {
    const speed = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
    const curAngle = Math.atan2(r.vy, r.vx);
    const jitterDeg = Math.randInt(21) - 10;
    const newAngle = curAngle + jitterDeg * 0.017453292519943295;
    r.vx = Math.cos(newAngle) * speed;
    r.vy = Math.sin(newAngle) * speed;
  }

  function checkWallCollision(r) {  "ram";

    // ── Border walls ─────────────────────────────────────────────────────────
    let bounced = false;
    const hr = r.hitR;

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

    // ── Interior walls: circle vs line-segment ────────────────────────────────

    for (let i = 0; i < trackWalls.length; i += 4) {
      const x1 = trackWalls[i],   y1 = trackWalls[i+1];
      const x2 = trackWalls[i+2], y2 = trackWalls[i+3];

      // Project roach center onto the segment, clamped to [0,1]
      const segDx = x2 - x1, segDy = y2 - y1;
      const lenSq = segDx * segDx + segDy * segDy;
      let t = lenSq > 0 ? ((r.cx - x1) * segDx + (r.cy - y1) * segDy) / lenSq : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;

      // Closest point on segment to roach center
      const clx = x1 + t * segDx;
      const cly = y1 + t * segDy;

      // Vector from closest point to roach center
      const ex = r.cx - clx;
      const ey = r.cy - cly;
      const distSq = ex * ex + ey * ey;

      if (distSq < hr * hr && distSq > 0) {
        const dist = Math.sqrt(distSq);
        // Outward normal: direction from wall toward roach center
        const nx = ex / dist;
        const ny = ey / dist;

        // Push roach out to just touching the wall surface
        const pen = hr - dist;
        r.cx += nx * pen;
        r.cy += ny * pen;

        // Reflect velocity along the outward normal
        const dot = r.vx * nx + r.vy * ny;
        if (dot < 0) {
          // Only reflect if moving toward the wall (avoids double-reflection)
          r.vx -= 2 * dot * nx;
          r.vy -= 2 * dot * ny;

          // Renormalize to preserve speed after reflection
          const spd = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
          if (spd > 0) { r.vx = r.vx / spd * 3; r.vy = r.vy / spd * 3; }

          jitterVelocity(r);
          bounced = true;
        }
      }
    }

    if (bounced) {
      const vxAbs = r.vx < 0 ? -r.vx : r.vx;
      const vyAbs = r.vy < 0 ? -r.vy : r.vy;
      let fixed = 0;
      if (r.cx - hr <= 19) {
        if (vxAbs < 1.5) { r.vx = 1.5; fixed = 1; }
      } else if (r.cx + hr >= 464) {
        if (vxAbs < 1.5) { r.vx = -1.5; fixed = 1; }
      }
      if (r.cy - hr <= 19) {
        if (vyAbs < 1.5) { r.vy = 1.5; fixed = 1; }
      } else if (r.cy + hr >= 297) {
        if (vyAbs < 1.5) { r.vy = -1.5; fixed = 1; }
      }
      if (fixed) {
        const spd = Math.sqrt(r.vx * r.vx + r.vy * r.vy);
        if (spd > 0) { r.vx = r.vx / spd * 3; r.vy = r.vy / spd * 3; }
      }
    }
  }

  function checkRoachCollisions() {  "ram";
    for (let i = 0; i < radroaches.length; i++) {
      for (let j = i + 1; j < radroaches.length; j++) {
        const a = radroaches[i];
        const b = radroaches[j];
        const rSum = a.hitR + b.hitR;

        const dx = a.cx - b.cx;
        const dy = a.cy - b.cy;
        const distSq = dx * dx + dy * dy;

        if (distSq < rSum * rSum && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist, ny = dy / dist;

          const overlap = rSum - dist;
          a.cx += nx * overlap * 0.5; a.cy += ny * overlap * 0.5;
          b.cx -= nx * overlap * 0.5; b.cy -= ny * overlap * 0.5;

          const relVel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (relVel >= 0) continue;

          const aN = a.vx * nx + a.vy * ny;
          const bN = b.vx * nx + b.vy * ny;

          a.vx += (bN - aN) * nx; a.vy += (bN - aN) * ny;
          b.vx += (aN - bN) * nx; b.vy += (aN - bN) * ny;

          let sMag = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
          if (sMag > 0) { a.vx = a.vx / sMag * 4; a.vy = a.vy / sMag * 4; }
          sMag = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (sMag > 0) { b.vx = b.vx / sMag * 4; b.vy = b.vy / sMag * 4; }
          jitterVelocity(a);
          jitterVelocity(b);
        }
      }
    }
  }

  function updatePhysics() {  "ram";
    if (gameState !== 'RACING') return;

    if (trackDirty) {
      trackDirty = 0;
      h.setColor(0).fillRect(0, 0, 480, 320);
      drawTrack();
      for (let i = 0; i < radroaches.length; i++) drawShape(radroaches[i]);
      h.flip();
      Pip.lastFlip = getTime();
      return;
    }

    let dIdx = 0;
    h.setColor(0);
    for (let i = 0; i < radroaches.length; i++) {
      const r = radroaches[i];
      const hr = r.hitR;
      const dx1 = r.cx - hr - 2, dy1 = r.cy - hr - 2;
      const dx2 = r.cx + hr + 2, dy2 = r.cy + hr + 2;

      h.fillRect(dx1, dy1, dx2, dy2);

      dirty[dIdx++] = dx1;
      dirty[dIdx++] = dy1;
      dirty[dIdx++] = dx2;
      dirty[dIdx++] = dy2;
    }

    for (let i = 0; i < radroaches.length; i++) {
      const r = radroaches[i];
      r.cx += r.vx;
      r.cy += r.vy;
      checkWallCollision(r);
    }
    checkRoachCollisions();

    // Loop through the fixed 20 entries (5 roaches * 4 rect values)
    for (let i = 0; i < 20; i += 4) {
      h.setClipRect(dirty[i], dirty[i+1], dirty[i+2], dirty[i+3]);
      drawTrack();
      h.setClipRect(0, 0, 480, 320);
    }

    for (let i = 0; i < radroaches.length; i++) {
      const r = radroaches[i];
      const hr = r.hitR;
      if (r.cx + hr >= goalPos.x && r.cx - hr <= goalPos.x + goalPos.hitW &&
          r.cy + hr >= goalPos.y && r.cy - hr <= goalPos.y + goalPos.hitH) {
        gameState = 'GAMEOVER';
        winnerId = r.id;
        Pip.audioStart('HOLO/RADROACH_RACES/WINNER.WAV');
        break;
      }
    }

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
    h.drawString("PRESS LEFT WHEEL TO RACE AGAIN!", 240, 168);
  }

  // ─── Main Loop ────────────────────────────────────────────────────────────

  function mainLoop() {
    if (gameState === 'RACING') {
      updatePhysics();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  showTitleScreen();
  mainLoopInterval = setInterval(mainLoop, 21); // ~20fps

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