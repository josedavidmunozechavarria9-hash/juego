const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const powerStatusEl = document.getElementById('power-status');
const bonusStatusEl = document.getElementById('bonus-status');
const levelStatusEl = document.getElementById('level-status');
const restartButton = document.getElementById('restartButton');

const tileSize = 20;
const cols = 21;
const rows = 23;
const totalLevels = 2;

canvas.width = cols * tileSize;
canvas.height = rows * tileSize;

let score = 0;
let frightenedTimer = 0;
let gameOver = false;
let paused = false;
let currentLevel = 1;
let bonusSpawnCooldown = 180;
let levelTransitionTimer = 0;
let isTransitioning = false;
const powerRespawns = new Map();
const bonus = {
  active: false,
  x: 0,
  y: 0,
  ttl: 0,
  points: 200
};

function generateLevel2() {
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) return 1;
      if ((x % 6 === 0 && y % 2 === 0) || (y % 5 === 0 && x % 3 !== 0)) return 1;
      if ((x >= 4 && x <= 16 && y === 10) || (x === 10 && y >= 3 && y <= 19)) return 1;
      return 0;
    })
  );
}

const levels = [
  {
    name: 'Nivel 1',
    pacman: null,
    ghosts: [],
    map: [
      '111111111111111111111',
      '100000000100000000001',
      '101111011101110101101',
      '100000010000010000001',
      '111011010110110010111',
      '100010000010000010001',
      '101111110111111011101',
      '100000000000000000001',
      '111011111111111011111',
      '100010000000000010001',
      '101110111011101110101',
      '100000010000010000001',
      '111011010110110010111',
      '100010000010000010001',
      '101111011101110111101',
      '100000010000010000001',
      '111011110111110110111',
      '100000000000000000001',
      '101111011111011111101',
      '100000010000010000001',
      '110111000111000111011',
      '110111101111101111011',
      '100000000000000000001',
      '111111111111111111111',
    ]
  },
  {
    name: 'Nivel 2',
    pacman: null,
    ghosts: [],
    map:
[
      '111111111111111111111',
      '100000000100000000001',
      '101111011101110101101',
      '100000010000010000001',
      '111011010110110010111',
      '100010000010000010001',
      '101111110111111011101',
      '100000000000000000001',
      '111011111111111011111',
      '100010000000000010001',
      '101110111011101110101',
      '100000010000010000001',
      '111011010110110010111',
      '100010000010000010001',
      '101111011101110111101',
      '100000010000010000001',
      '111011110111110110111',
      '100000000000000000001',
      '101111011111011111101',
      '100000010000010000001',
      '110111000111000111011',
      '110111101111101111011',
      '100000000000000000001',
      '111111111111111111111',
      ]
  }
];

let map = [];
let pacman = { x: 0, y: 0, dirX: 0, dirY: 0, nextDirX: 0, nextDirY: 0, speed: 1, radius: 8 };
let ghosts = [];

function parseMap(levelData) {
  return levelData.map.map((row) => {
    if (Array.isArray(row)) {
      return row.map((cell) => Number(cell));
    }

    return row.split('').map((cell) => {
      if (cell === '1') return 1;
      if (cell === '2') return 2;
      if (cell === '3') return 3;
      if (cell === '4') return 4;
      return 0;
    });
  });
}

function getRandomZeroCell() {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      if (map[row][column] === 0) {
        cells.push({ x: column, y: row });
      }
    }
  }

  if (cells.length === 0) return null;
  return cells[Math.floor(Math.random() * cells.length)];
}

function addSewerTiles() {
  if (map.length === 0) return;
  map[10][1] = 4;
  map[10][cols - 2] = 4;
}

function findOpenCells() {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      if (map[row][column] === 0) {
        cells.push({ x: column * tileSize, y: row * tileSize });
      }
    }
  }
  return cells;
}

function getSpawnPoint(excluded = []) {
  const openCells = findOpenCells();
  const safeCells = openCells.filter((cell) => {
    const key = `${Math.round(cell.x / tileSize)},${Math.round(cell.y / tileSize)}`;
    return !excluded.includes(key);
  });

  if (safeCells.length === 0) {
    return { x: 9 * tileSize, y: 16 * tileSize };
  }

  return safeCells[Math.floor(Math.random() * safeCells.length)];
}

function loadLevel(levelIndex) {
  const level = levels[levelIndex - 1];
  map = parseMap(level);
  addSewerTiles();

  const spawnPoints = findOpenCells();
  const pacmanSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)] || { x: 9 * tileSize, y: 16 * tileSize };
  const occupied = new Set([`${Math.round(pacmanSpawn.x / tileSize)},${Math.round(pacmanSpawn.y / tileSize)}`]);

  pacman.x = pacmanSpawn.x;
  pacman.y = pacmanSpawn.y;
  pacman.dirX = 0;
  pacman.dirY = 0;
  pacman.nextDirX = 0;
  pacman.nextDirY = 0;

  ghosts = [];
  const centerSpawns = [
    { x: 10 * tileSize, y: 9 * tileSize },
    { x: 9 * tileSize, y: 10 * tileSize },
    { x: 11 * tileSize, y: 10 * tileSize },
    { x: 10 * tileSize, y: 11 * tileSize }
  ];

  centerSpawns.forEach((spawn, index) => {
    const gx = Math.round(spawn.x / tileSize);
    const gy = Math.round(spawn.y / tileSize);
    occupied.add(`${gx},${gy}`);

    ghosts.push({
      x: spawn.x,
      y: spawn.y,
      startX: gx,
      startY: gy,
      dirX: index % 2 === 0 ? 1 : -1,
      dirY: index === 2 ? -1 : 0,
      color: ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'][index],
      speed: 1
    });
  });

  bonus.active = false;
  bonusSpawnCooldown = 180;
  frightenedTimer = 0;
  levelTransitionTimer = 0;
  isTransitioning = false;
  powerRespawns.clear();
  levelStatusEl.textContent = level.name;
  powerStatusEl.textContent = 'Normal';
  powerStatusEl.className = 'status';
  bonusStatusEl.textContent = 'Listo';
  scoreEl.textContent = score;
}

function isWall(gx, gy) {
  if (gx < 0 || gx >= cols) return false;
  if (gy < 0 || gy >= rows) return true;
  return map[gy][gx] === 1;
}

const directions = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0]
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (!gameOver) paused = !paused;
    return;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = directions[key];

  if (direction) {
    event.preventDefault();
    pacman.nextDirX = direction[0];
    pacman.nextDirY = direction[1];
  }
});

window.addEventListener('blur', () => {
  paused = true;
});

restartButton.addEventListener('click', () => {
  window.location.reload();
});

function updatePacman() {
  if (pacman.x % tileSize === 0 && pacman.y % tileSize === 0) {
    const gx = pacman.x / tileSize;
    const gy = pacman.y / tileSize;

    if (map[gy] && map[gy][gx] === 0) {
      map[gy][gx] = 3;
      score += 50;
    } else if (map[gy] && map[gy][gx] === 2) {
      map[gy][gx] = 3;
      score += 50;
      frightenedTimer = 300;
      powerRespawns.set(`${gx},${gy}`, performance.now() + 30000);
    } else if (map[gy] && map[gy][gx] === 4) {
      const target = getRandomZeroCell();
      if (target) {
        pacman.x = target.x * tileSize;
        pacman.y = target.y * tileSize;
        pacman.dirX = 0;
        pacman.dirY = 0;
      }
    }

    if (!isWall(gx + pacman.nextDirX, gy + pacman.nextDirY)) {
      pacman.dirX = pacman.nextDirX;
      pacman.dirY = pacman.nextDirY;
    }

    if (isWall(gx + pacman.dirX, gy + pacman.dirY)) {
      pacman.dirX = 0;
      pacman.dirY = 0;
    }
  }

  pacman.x += pacman.dirX * pacman.speed;
  pacman.y += pacman.dirY * pacman.speed;

  if (pacman.x < 0) pacman.x = canvas.width - tileSize;
  if (pacman.x >= canvas.width) pacman.x = 0;
}

function updateGhost(ghost) {
  if (ghost.x % tileSize === 0 && ghost.y % tileSize === 0) {
    const gx = ghost.x / tileSize;
    const gy = ghost.y / tileSize;
    const possibleDirs = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: 0 }, { x: 1, y: 0 }
    ].filter((direction) => {
      if (isWall(gx + direction.x, gy + direction.y)) return false;
      if (direction.x === -ghost.dirX && direction.y === -ghost.dirY) return false;
      return true;
    });

    const validDirs = possibleDirs.length > 0 ? possibleDirs : [
      { x: -ghost.dirX, y: -ghost.dirY }
    ].filter((direction) => !isWall(gx + direction.x, gy + direction.y));

    if (validDirs.length > 0) {
      let chosen = validDirs[Math.floor(Math.random() * validDirs.length)];

      if (frightenedTimer === 0 && Math.random() < 0.6) {
        let minDist = Infinity;
        validDirs.forEach((direction) => {
          const dist = Math.hypot(
            (gx + direction.x) * tileSize - pacman.x,
            (gy + direction.y) * tileSize - pacman.y
          );
          if (dist < minDist) {
            minDist = dist;
            chosen = direction;
          }
        });
      }

      ghost.dirX = chosen.x;
      ghost.dirY = chosen.y;
    }
  }

  ghost.x += ghost.dirX * ghost.speed;
  ghost.y += ghost.dirY * ghost.speed;

  if (ghost.x < 0) ghost.x = canvas.width - tileSize;
  if (ghost.x >= canvas.width) ghost.x = 0;
}

function getBonusSpawnCell() {
  const occupiedPositions = new Set();
  ghosts.forEach((ghost) => {
    occupiedPositions.add(`${Math.round(ghost.x / tileSize)},${Math.round(ghost.y / tileSize)}`);
  });
  occupiedPositions.add(`${Math.round(pacman.x / tileSize)},${Math.round(pacman.y / tileSize)}`);

  const availablePositions = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      const value = map[row][column];
      const position = `${column},${row}`;
      if ((value === 0 || value === 2 || value === 3) && !occupiedPositions.has(position)) {
        availablePositions.push({ x: column, y: row });
      }
    }
  }

  if (availablePositions.length === 0) return null;
  return availablePositions[Math.floor(Math.random() * availablePositions.length)];
}

function spawnBonus() {
  const randomCell = getBonusSpawnCell();
  if (!randomCell) return;

  bonus.x = randomCell.x * tileSize + tileSize / 2;
  bonus.y = randomCell.y * tileSize + tileSize / 2;
  bonus.active = true;
  bonus.ttl = 420;
  bonusStatusEl.textContent = '¡BONUS!';
}

function updateBonus() {
  if (bonus.active) {
    bonus.ttl--;
    bonusStatusEl.textContent = '¡BONUS!';

    if (bonus.ttl <= 0) {
      bonus.active = false;
      bonusStatusEl.textContent = 'Listo';
    }
  } else {
    bonusSpawnCooldown--;
    if (bonusSpawnCooldown <= 0) {
      spawnBonus();
      bonusSpawnCooldown = 420 + Math.random() * 180;
    } else {
      bonusStatusEl.textContent = 'Listo';
    }
  }
}

function checkCollisions() {
  ghosts.forEach((ghost) => {
    if (Math.hypot(ghost.x - pacman.x, ghost.y - pacman.y) < 14) {
      if (frightenedTimer > 0) {
        score += 50;
        ghost.x = ghost.startX * tileSize;
        ghost.y = ghost.startY * tileSize;
      } else if (!gameOver) {
        gameOver = true;
        pacman.dirX = 0;
        pacman.dirY = 0;
        restartButton.hidden = false;
        alert(`¡Game Over! Puntuación final: ${score}`);
      }
    }
  });

  if (bonus.active) {
    const bonusDistance = Math.hypot(
      bonus.x - (pacman.x + 10),
      bonus.y - (pacman.y + 10)
    );

    if (bonusDistance < 14) {
      score += bonus.points;
      bonus.active = false;
      bonusSpawnCooldown = 300 + Math.random() * 180;
      bonusStatusEl.textContent = 'Bonus +200';
      frightenedTimer = Math.min(frightenedTimer + 480, 900);
      powerStatusEl.textContent = 'MODO CAZADOR';
      powerStatusEl.className = 'status power';
    }
  }
}

function startLevelTransition(nextLevel) {
  if (nextLevel > totalLevels || isTransitioning) return;

  isTransitioning = true;
  currentLevel = nextLevel;
  levelTransitionTimer = 600;
  powerStatusEl.textContent = 'INVENCIBLE 10s';
  powerStatusEl.className = 'status power';

  ghosts.forEach((ghost) => {
    ghost.x = ghost.startX * tileSize;
    ghost.y = ghost.startY * tileSize;
  });

  setTimeout(() => {
    loadLevel(currentLevel);
    isTransitioning = false;
  }, 1000);
}

function checkWin() {
  if (score >= 30000 && !gameOver) {
    gameOver = true;
    restartButton.hidden = false;
    alert(`¡Ganaste! Alcanzaste 30.000 puntos.`);
  }
}

function getRandomPowerPosition() {
  const occupiedPositions = new Set(powerRespawns.keys());
  ghosts.forEach((ghost) => {
    occupiedPositions.add(`${Math.round(ghost.x / tileSize)},${Math.round(ghost.y / tileSize)}`);
  });
  occupiedPositions.add(`${Math.round(pacman.x / tileSize)},${Math.round(pacman.y / tileSize)}`);

  const availablePositions = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      const position = `${column},${row}`;
      if (map[row][column] === 3 && !occupiedPositions.has(position)) {
        availablePositions.push({ x: column, y: row });
      }
    }
  }

  if (availablePositions.length === 0) return null;
  return availablePositions[Math.floor(Math.random() * availablePositions.length)];
}

function respawnCookies(now) {
  powerRespawns.forEach((respawnAt, position) => {
    if (now >= respawnAt) {
      const randomPosition = getRandomPowerPosition();
      if (!randomPosition) return;

      map[randomPosition.y][randomPosition.x] = 2;
      powerRespawns.delete(position);
    }
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < cols; column++) {
      const x = column * tileSize;
      const y = row * tileSize;

      if (map[row][column] === 1) {
        ctx.fillStyle = '#1919a6';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x, y, tileSize, tileSize);
      } else if (map[row][column] === 0) {
        ctx.fillStyle = '#ffb8ae';
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (map[row][column] === 2) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (map[row][column] === 4) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.fillStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.arc(x + 10, y + 10, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (bonus.active) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(bonus.x, bonus.y - 6);
    ctx.lineTo(bonus.x + 6, bonus.y);
    ctx.lineTo(bonus.x, bonus.y + 6);
    ctx.lineTo(bonus.x - 6, bonus.y);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(pacman.x + 10, pacman.y + 10, pacman.radius, 0.2 * Math.PI, 1.8 * Math.PI);
  ctx.lineTo(pacman.x + 10, pacman.y + 10);
  ctx.fill();

  ghosts.forEach((ghost) => {
    ctx.fillStyle = frightenedTimer > 0 ? '#0000ff' : ghost.color;
    ctx.beginPath();
    ctx.arc(ghost.x + 10, ghost.y + 8, 8, Math.PI, 0, false);
    ctx.lineTo(ghost.x + 18, ghost.y + 18);
    ctx.lineTo(ghost.x + 2, ghost.y + 18);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ghost.x + 7, ghost.y + 7, 2.5, 0, Math.PI * 2);
    ctx.arc(ghost.x + 13, ghost.y + 7, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function gameLoop(now) {
  if (gameOver) return;
  if (paused) {
    requestAnimationFrame(gameLoop);
    return;
  }

  if (isTransitioning) {
    requestAnimationFrame(gameLoop);
    return;
  }

  if (levelTransitionTimer > 0) {
    levelTransitionTimer--;
    frightenedTimer = 600;
    powerStatusEl.textContent = 'INVENCIBLE 10s';
    powerStatusEl.className = 'status power';
  }

  respawnCookies(now);
  updateBonus();

  if (frightenedTimer > 0) {
    frightenedTimer--;
    powerStatusEl.textContent = 'MODO CAZADOR';
    powerStatusEl.className = 'status power';
  } else {
    powerStatusEl.textContent = 'Normal';
    powerStatusEl.className = 'status';
  }

  updatePacman();
  ghosts.forEach(updateGhost);
  checkCollisions();
  checkWin();
  draw();
  scoreEl.textContent = score;

  requestAnimationFrame(gameLoop);
}

loadLevel(currentLevel);
requestAnimationFrame(gameLoop);
