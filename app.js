// =============================================================================
//  Name: Radroach Races Simulation (5 Radroaches with Map Cycle Routing)
//  License: CC-BY-NC-4.0
//  Repository: https://github.com
// =============================================================================

(function() {
  let mainLoopInterval = null;
  let countdownTimer = null;

  // Screen Geometry Coordinates
  const SCREEN_WIDTH = 480;
  const SCREEN_HEIGHT = 320;
  
  const PLAY_AREA = { x1: 15, x2: SCREEN_WIDTH - 15, y1: 45, y2: SCREEN_HEIGHT - 25 };

  // Game States
  let gameState = 'TITLE_SCREEN'; // 'TITLE_SCREEN', 'COUNTDOWN', 'RACING', 'GAMEOVER'
  let winnerId = -1;
  let countdownValue = 3;

  // Radroach Configuration
  const BLOCK_SIZE = 14; 
  let radroaches = [];
  
  const SHAPE_NAMES = { 1: 'SQUARE', 2: 'TRIANGLE', 3: 'DIAMOND', 4: 'CROSS', 5: 'HEXAGON' };

  // Track Layout Blueprints & Fruit Goal Configurations
  let currentMapId = 0;
  let trackWalls = [];
  let goalPos = { x: 0, y: 0, w: 30, h: 30 }; 
  let startX = 0;
  let startYBase = 0;

  const MAP_BLUEPRINTS = [
    // Map 1: Winding S-Tunnel Architecture
    {
      goal: { x: 410, y: 140 },
      start: { x: 35, y: 55 },
      walls: [
        {x1: 20, y1: 170, x2: 320, y2: 170},
        {x1: 140, y1: 240, x2: 460, y2: 240},
        {x1: 320, y1: 45,  x2: 320, y2: 170},
        {x1: 140, y1: 170, x2: 140, y2: 295}
      ]
    },
    // Map 2: Central Funnel with Branching Paths
    {
      goal: { x: 420, y: 230 },
      start: { x: 35, y: 90 },
      walls: [
        {x1: 20, y1: 70,   x2: 200, y2: 70},
        {x1: 200, y1: 70,  x2: 200, y2: 190},
        {x1: 200, y1: 190, x2: 360, y2: 190},
        {x1: 100, y1: 190, x2: 100, y2: 295}
      ]
    },
    // Map 3: Core Labyrinth Obstacle Block
    {
      goal: { x: 410, y: 70 },
      start: { x: 35, y: 180 },
      walls: [
        {x1: 120, y1: 45,  x2: 120, y2: 160},
        {x1: 120, y1: 160, x2: 340, y2: 160},
        {x1: 240, y1: 210, x2: 460, y2: 210}
      ]
    },
    // Map 4: Dual Multi-Lane Corridor Split
    {
      goal: { x: 425, y: 145 },
      start: { x: 35, y: 110 },
      walls: [
        {x1: 100, y1: 90,  x2: 380, y2: 90},
        {x1: 100, y1: 230, x2: 380, y2: 230},
        {x1: 100, y1: 90,  x2: 100, y2: 230}
      ]
    },
    // Map 5: Diagonal Switchback Track
    {
      goal: { x: 390, y: 240 },
      start: { x: 35, y: 55 },
      walls: [
        {x1: 20, y1: 160,  x2: 380, y2: 160},
        {x1: 100, y1: 235, x2: 460, y2: 235}
      ]
    }
  ];

  let clickWatchHandle = null;

  function showTitleScreen() {
    gameState = 'TITLE_SCREEN';
    winnerId = -1;
    
    h.setColor(0).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    h.setColor(1).drawRect(PLAY_AREA.x1, PLAY_AREA.y1, PLAY_AREA.x2, PLAY_AREA.y2);
    
    // Header text rendering alignment blocks
    h.setFont("Monofonto23").setFontAlign(0, -1).setColor(3);
    h.drawString("Radroach Races", SCREEN_WIDTH / 2, PLAY_AREA.y1 + 10);
    
    // Background Fence Vector Line Blocks
    h.setColor(2);
    h.drawLine(PLAY_AREA.x1 + 40, 180, PLAY_AREA.x2 - 40, 180);
    h.drawLine(PLAY_AREA.x1 + 40, 200, PLAY_AREA.x2 - 40, 200);
    for (let fx = PLAY_AREA.x1 + 60; fx < PLAY_AREA.x2 - 40; fx += 35) {
      h.fillRect(fx, 150, fx + 15, 230);
    }
    
    // Background Grass Strand Elements
    for (let gx = PLAY_AREA.x1 + 20; gx < PLAY_AREA.x2 - 20; gx += 12) {
      h.drawLine(gx, 230, gx - 4, 210);
      h.drawLine(gx + 3, 230, gx + 6, 205);
    }

    // Centered Large Cockroach Vector Asset Graphics
    h.setColor(1);
    h.fillEllipse(SCREEN_WIDTH / 2 - 40, 165, SCREEN_WIDTH / 2 + 40, 215); // Shell
    h.fillCircle(SCREEN_WIDTH / 2, 150, 18); // Head
    // Antennae
    h.drawLine(SCREEN_WIDTH / 2 - 4, 138, SCREEN_WIDTH / 2 - 35, 105);
    h.drawLine(SCREEN_WIDTH / 2 + 4, 138, SCREEN_WIDTH / 2 + 35, 105);
    // Jointed Legs Vector Map Arrays
    h.drawPoly([SCREEN_WIDTH / 2 - 35, 165, SCREEN_WIDTH / 2 - 60, 175, SCREEN_WIDTH / 2 - 75, 200], false);
    h.drawPoly([SCREEN_WIDTH / 2 - 40, 190, SCREEN_WIDTH / 2 - 65, 200, SCREEN_WIDTH / 2 - 80, 230], false);
    h.drawPoly([SCREEN_WIDTH / 2 + 35, 165, SCREEN_WIDTH / 2 + 60, 175, SCREEN_WIDTH / 2 + 75, 200], false);
    h.drawPoly([SCREEN_WIDTH / 2 + 40, 190, SCREEN_WIDTH / 2 + 65, 200, SCREEN_WIDTH / 2 + 80, 230], false);

    // Interactive Action Interface Banners
    h.setFont("Monofonto16").setFontAlign(0, -1).setColor(3);
    h.drawString("PRESS LEFT KNOB TO START!", SCREEN_WIDTH / 2, PLAY_AREA.y2 - 25);

    h.flip();
    Pip.lastFlip = getTime();
    
    // Hook into left dial knob1 triggers for game initialization routing
    Pip.removeListener("knob1", handleKnobStart);
    Pip.on("knob1", handleKnobStart);
    
    clearWatch(clickWatchHandle);
    clickWatchHandle = setWatch(handleKnobStart, ENC1_PRESS, { repeat: true, edge: "rising", debounce: 50 });
  }

  function handleKnobStart() {
    if (gameState === 'TITLE_SCREEN') {
      Pip.audioStart('UI/OK.wav');
      Pip.removeListener("knob1", handleKnobStart);
      startCountdown();
    } else if (gameState === 'GAMEOVER') {
      Pip.playSound('TAB');
      showTitleScreen();
    }
  }

  function startCountdown() {
    gameState = 'COUNTDOWN';
    countdownValue = 3;
    
    // Automatically select map index routing before launching the timer
    currentMapId = Math.randInt(0, 4);
    const blueprint = MAP_BLUEPRINTS[currentMapId];
    trackWalls = blueprint.walls;
    goalPos.x = blueprint.goal.x;
    goalPos.y = blueprint.goal.y;
    startX = blueprint.start.x;
    startYBase = blueprint.start.y;

    // Grid layout array positioning configuration profiles
    radroaches = [
      { id: 1, shape: 'square',  x: startX, y: startYBase + 0,  vx: 1.0 + Math.random() * 2.2, vy: 0.8 + Math.random() * 1.5 },
      { id: 2, shape: 'triangle',x: startX, y: startYBase + 18, vx: 1.0 + Math.random() * 2.2, vy: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.5) },
      { id: 3, shape: 'diamond', x: startX, y: startYBase + 36, vx: 1.0 + Math.random() * 2.2, vy: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.5) },
      { id: 4, shape: 'cross',   x: startX, y: startYBase + 54, vx: 1.0 + Math.random() * 2.2, vy: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.5) },
      { id: 5, shape: 'hexagon', x: startX, y: startYBase + 72, vx: 1.0 + Math.random() * 2.2, vy: (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 1.5) }
    ];

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tickCountdown, 1000);
    tickCountdown(); // Primary instant invocation
  }

  function tickCountdown() {
    if (gameState !== 'COUNTDOWN') return;

    h.setColor(0).fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawTrack();
    
    // Draw radroaches stationary in ready positions during countdown checks
    h.setColor(1);
    for (let i = 0; i < radroaches.length; i++) {
      drawShape(radroaches[i]);
    }

    if (countdownValue > 0) {
      Pip.playSound('SCROLL');
      h.setFont("Monofonto96").setFontAlign(0, 0).setColor(3);
      h.drawString(countdownValue.toString(), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
      countdownValue--;
    } else {
      Pip.audioStart('UI/OK.wav');
      clearInterval(countdownTimer);
      countdownTimer = null;
      gameState = 'RACING';
    }

    h.flip();
    Pip.lastFlip = getTime();
  }

  function drawShape(r) {
    const cx = r.x + BLOCK_SIZE / 2;
    const cy = r.y + BLOCK_SIZE / 2;

    if (r.shape === 'square') {
      h.drawRect(r.x, r.y, r.x + BLOCK_SIZE, r.y + BLOCK_SIZE);
    } else if (r.shape === 'triangle') {
      h.drawPoly([cx, r.y, r.x + BLOCK_SIZE, r.y + BLOCK_SIZE, r.x, r.y + BLOCK_SIZE], true);
    } else if (r.shape === 'diamond') {
      h.drawPoly([cx, r.y, r.x + BLOCK_SIZE, cy, cx, r.y + BLOCK_SIZE, r.x, cy], true);
    } else if (r.shape === 'cross') {
      h.drawLine(cx, r.y, cx, r.y + BLOCK_SIZE);
      h.drawLine(r.x, cy, r.x + BLOCK_SIZE, cy);
    } else if (r.shape === 'hexagon') {
      const q = BLOCK_SIZE / 4;
      h.drawPoly([r.x + q, r.y, r.x + BLOCK_SIZE - q, r.y, r.x + BLOCK_SIZE, cy, r.x + BLOCK_SIZE - q, r.y + BLOCK_SIZE, r.x + q, r.y + BLOCK_SIZE, r.x, cy], true);
    }
  }

  function drawTrack() {
    h.setColor(1);
    h.drawRect(PLAY_AREA.x1, PLAY_AREA.y1, PLAY_AREA.x2, PLAY_AREA.y2);
    
    for (let i = 0; i < trackWalls.length; i++) {
      let w = trackWalls[i];
      h.drawLine(w.x1, w.y1, w.x2, w.y2);
    }
    
    // Draw Fruit Target Box Area Blocks
    h.setColor(3);
    h.fillRect(goalPos.x, goalPos.y, goalPos.x + goalPos.w, goalPos.y + goalPos.h);
    
    h.setColor(2);
    h.fillRect(goalPos.x + 12, goalPos.y - 6, goalPos.x + 18, goalPos.y); 
    h.fillRect(goalPos.x - 4, goalPos.y + 10, goalPos.x, goalPos.y + 16);
  }

  function checkWallCollision(r) {
    if (r.x <= PLAY_AREA.x1) { r.x = PLAY_AREA.x1; r.vx = -r.vx; }
    else if (r.x + BLOCK_SIZE >= PLAY_AREA.x2) { r.x = PLAY_AREA.x2 - BLOCK_SIZE; r.vx = -r.vx; }
    if (r.y <= PLAY_AREA.y1) { r.y = PLAY_AREA.y1; r.vy = -r.vy; }
    else if (r.y + BLOCK_SIZE >= PLAY_AREA.y2) { r.y = PLAY_AREA.y2 - BLOCK_SIZE; r.vy = -r.vy; }

    for (let i = 0; i < trackWalls.length; i++) {
      let w = trackWalls[i];
      
      if (r.x + BLOCK_SIZE >= Math.min(w.x1, w.x2) && r.x <= Math.max(w.x1, w.x2) &&
          r.y + BLOCK_SIZE >= Math.min(w.y1, w.y2) && r.y <= Math.max(w.y1, w.y2)) {
        
        if (Math.abs(w.y2 - w.y1) < 2) { 
          r.vy = -r.vy; 
          r.y += r.vy;
        } else if (Math.abs(w.x2 - w.x1) < 2) { 
          r.vx = -r.vx; 
          r.x += r.vx;
        }
      }
    }
  }

function updatePhysics() {
    if (gameState !== 'RACING') return;

    // Erase preceding positions to clear trail artifacts
    h.setColor(0);
    for (let i = 0; i < radroaches.length; i++) {
      h.fillRect(
        radroaches[i].x - 2, 
        radroaches[i].y - 2, 
        radroaches[i].x + BLOCK_SIZE + 2, 
        radroaches[i].y + BLOCK_SIZE + 2
      );
    }
    
    // Physics and intersection updates
    for (let i = 0; i < radroaches.length; i++) {
      let r = radroaches[i];
      r.x += r.vx;
      r.y += r.vy;
      
      checkWallCollision(r);

      // Verify intersection parameters against broad mutfruit box profiles
      if (r.x + BLOCK_SIZE >= goalPos.x && r.x <= goalPos.x + goalPos.w &&
          r.y + BLOCK_SIZE >= goalPos.y && r.y <= goalPos.y + goalPos.h) {
        gameState = 'GAMEOVER';
        winnerId = r.id;
        Pip.audioStart('UI/REWARD.wav');
        break;
      }
    }
    
    drawTrack();
    
    // Redraw all radroaches in new coordinate nodes
    h.setColor(1);
    for (let i = 0; i < radroaches.length; i++) {
      drawShape(radroaches[i]);
    }
    
    if (gameState === 'GAMEOVER') {
      displayWinner();
    }

    // Force display updates to match micro-intervals
    h.flip();
    Pip.lastFlip = getTime();
  }

  function displayWinner() {
    h.setColor(1).fillRect(SCREEN_WIDTH / 2 - 120, SCREEN_HEIGHT / 2 - 30, SCREEN_WIDTH / 2 + 120, SCREEN_HEIGHT / 2 + 30);
    h.setColor(0).drawRect(SCREEN_WIDTH / 2 - 118, SCREEN_HEIGHT / 2 - 28, SCREEN_WIDTH / 2 + 118, SCREEN_HEIGHT / 2 + 28);
    
    const nameStr = SHAPE_NAMES[winnerId] + " ROACH WINS!";
    h.setFont("Monofonto16").setFontAlign(0, -1);
    h.drawString(nameStr, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 18);
    
    h.setFont("Monofonto14");
    h.drawString("PRESS CLICK WHEEL TO RESTART ENGINE", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 8);
  }

  function mainLoop() {
    if (gameState === 'RACING') {
      updatePhysics();
    }
  }
  
  // Set default state environment
  showTitleScreen();
  mainLoopInterval = setInterval(mainLoop, 1000 / 60);
  
  // Return control configuration to core OS loaders
  return {
    id: "RADROACHRACES",
    notDefault: true,
    fullscreen: true,
    remove: function() {
      if (mainLoopInterval) {
        clearInterval(mainLoopInterval);
        mainLoopInterval = null;
      }
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      Pip.removeListener("knob1", handleKnobStart);
      clearWatch(clickWatchHandle);
      Pip.audioStop();
    }
  };
})();