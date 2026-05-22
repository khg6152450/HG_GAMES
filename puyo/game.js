// Puyo Puyo Puzzle Engine
// 6 Columns x 12 Rows Grid

const COLS = 6;
const ROWS = 12;
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

let grid = Array(ROWS).fill().map(() => Array(COLS).fill(null));

// Player states
let currentPair = null; // { pivot: {r, c, color}, child: {r, c, color}, dir: 0 } (dir: 0=N, 1=E, 2=S, 3=W)
let nextPair = null;

let score = 0;
let highScore = localStorage.getItem('puyo-high-score') || 0;
let chains = 0;
let isLockBoard = false;
let isGameOver = false;

// Game loop / intervals
let dropInterval = null;
let baseSpeed = 800; // ms
let currentSpeed = baseSpeed;

// Audio context
let audioCtx = null;

// DOM Elements
const boardEl = document.getElementById('game-board');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const comboBanner = document.getElementById('combo-banner');
const nextContainer = document.getElementById('next-puyo-container');
const menuOverlay = document.getElementById('menu-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('final-score');

// Directions offset N, E, S, W
const DIR_OFFSETS = [
    { r: -1, c: 0 }, // 0: North
    { r: 0, c: 1 },  // 1: East
    { r: 1, c: 0 },  // 2: South
    { r: 0, c: -1 }  // 3: West
];

// Initialize DOM gridcells
function createBoardDOM() {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            boardEl.appendChild(cell);
        }
    }
    highScoreEl.innerText = highScore;
}

// Generate new random puyo pair
function generatePuyoPair() {
    return {
        pivot: { r: 0, c: 2, color: getRandomColor() },
        child: { r: -1, c: 2, color: getRandomColor() },
        dir: 0
    };
}

function getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// Start Game from overlay
function startGame() {
    menuOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
    resetGame();
}

function resetGame() {
    grid = Array(ROWS).fill().map(() => Array(COLS).fill(null));
    score = 0;
    chains = 0;
    isLockBoard = false;
    isGameOver = false;
    currentSpeed = baseSpeed;
    scoreEl.innerText = score;
    
    createBoardDOM();
    
    nextPair = generatePuyoPair();
    spawnPuyo();
    
    // Reset timer
    clearInterval(dropInterval);
    dropInterval = setInterval(gameTick, currentSpeed);
}

function spawnPuyo() {
    if (isGameOver) return;
    
    currentPair = nextPair;
    nextPair = generatePuyoPair();
    renderNextPreview();
    
    // Check game over right at spawn point
    const p = currentPair.pivot;
    const c = currentPair.child;
    if (grid[p.r][p.c] !== null) {
        triggerGameOver();
        return;
    }
    
    renderBoard();
}

// Main game clock tick
function gameTick() {
    if (isLockBoard || isGameOver) return;
    
    if (!movePair(1, 0)) {
        lockPair();
    }
}

// Move pair by row/col offset
function movePair(dr, dc) {
    if (isLockBoard || isGameOver) return false;
    
    const p = currentPair.pivot;
    const c = currentPair.child;
    
    const newPr = p.r + dr;
    const newPc = p.c + dc;
    const newCr = c.r + dr;
    const newCc = c.c + dc;
    
    if (isValidPosition(newPr, newPc) && isValidPosition(newCr, newCc)) {
        p.r = newPr;
        p.c = newPc;
        c.r = newCr;
        c.c = newCc;
        renderBoard();
        return true;
    }
    return false;
}

// Validate boundary and collision
function isValidPosition(r, c) {
    if (r < 0) {
        // Child can temporarily rotate above grid, but must be within column bounds
        return c >= 0 && c < COLS;
    }
    return r < ROWS && c >= 0 && c < COLS && grid[r][c] === null;
}

// Rotation with Wall-Kick support
function rotatePair(clockwise) {
    if (isLockBoard || isGameOver) return;
    
    const p = currentPair.pivot;
    const c = currentPair.child;
    
    // Calculate new direction
    const newDir = (currentPair.dir + (clockwise ? 1 : 3)) % 4;
    const offset = DIR_OFFSETS[newDir];
    
    // Attempted child coordinates
    let newCr = p.r + offset.r;
    let newCc = p.c + offset.c;
    
    // Wall kick options: (0,0), (0, -1) Left, (0, 1) Right, (1, 0) Down, (-1, 0) Up
    const kicks = [
        { dr: 0, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
        { dr: 1, dc: 0 },
        { dr: -1, dc: 0 }
    ];
    
    for (let kick of kicks) {
        const testPr = p.r + kick.dr;
        const testPc = p.c + kick.dc;
        const testCr = newCr + kick.dr;
        const testCc = newCc + kick.dc;
        
        if (isValidPosition(testPr, testPc) && isValidPosition(testCr, testCc)) {
            p.r = testPr;
            p.c = testPc;
            c.r = testCr;
            c.c = testCc;
            currentPair.dir = newDir;
            playClickSound();
            renderBoard();
            return;
        }
    }
}

// Locks current pair, separates them, and cascades gravity
function lockPair() {
    isLockBoard = true;
    clearInterval(dropInterval);
    
    const p = currentPair.pivot;
    const c = currentPair.child;
    
    // Lock both Puyos into matrix (if child is above screen, clip it or place it at row 0)
    if (p.r >= 0) grid[p.r][p.c] = { color: p.color };
    if (c.r >= 0) grid[c.r][c.c] = { color: c.color };
    
    currentPair = null;
    renderBoard();
    
    // Cascade gravity
    setTimeout(() => {
        const moved = applyGravity();
        if (moved) {
            renderBoard();
            playCascadeSound();
        }
        
        // Enter Chain matching phase
        setTimeout(() => {
            processChains();
        }, 180);
    }, 150);
}

// Gravity logic: drops everything to bottom
function applyGravity() {
    let moved = false;
    for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c] === null) {
                for (let kr = r - 1; kr >= 0; kr--) {
                    if (grid[kr][c] !== null) {
                        grid[r][c] = grid[kr][c];
                        grid[kr][c] = null;
                        moved = true;
                        break;
                    }
                }
            }
        }
    }
    return moved;
}

// Flood Fill match logic
function findMatches() {
    let visited = Array(ROWS).fill().map(() => Array(COLS).fill(false));
    let matchGroup = [];
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] && !visited[r][c]) {
                const color = grid[r][c].color;
                const group = [];
                dfs(r, c, color, group, visited);
                if (group.length >= 4) {
                    matchGroup.push(...group);
                }
            }
        }
    }
    return matchGroup;
}

function dfs(r, c, color, group, visited) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (visited[r][c]) return;
    if (!grid[r][c] || grid[r][c].color !== color) return;
    
    visited[r][c] = true;
    group.push({ r, c });
    
    dfs(r - 1, c, color, group, visited);
    dfs(r + 1, c, color, group, visited);
    dfs(r, c - 1, color, group, visited);
    dfs(r, c + 1, color, group, visited);
}

// Clear connected groups recursively
function processChains() {
    const matches = findMatches();
    
    if (matches.length > 0) {
        chains++;
        
        // Mark pop animation in DOM
        matches.forEach(({ r, c }) => {
            const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
            if (cell) {
                const puyoEl = cell.querySelector('.puyo');
                if (puyoEl) {
                    puyoEl.classList.add('pop');
                    puyoEl.classList.remove('wiggle');
                }
            }
        });
        
        playPopSound(chains);
        showCombo(chains);
        
        // Calculate score with exponential chain weight
        const chainBonus = Math.pow(2, chains - 1) * 8;
        const popScore = matches.length * 10 * chains + chainBonus;
        score += popScore;
        scoreEl.innerText = score;
        
        // Update speed based on score milestones
        currentSpeed = Math.max(200, baseSpeed - Math.floor(score / 500) * 80);
        
        // Delay to let pop animation complete, then update grid matrix
        setTimeout(() => {
            matches.forEach(({ r, c }) => {
                grid[r][c] = null;
            });
            
            applyGravity();
            renderBoard();
            
            // Wait for blocks to land, then check next chain link
            setTimeout(() => {
                processChains();
            }, 250);
        }, 300);
        
    } else {
        // No matches found, release lock
        hideCombo();
        chains = 0;
        isLockBoard = false;
        
        // Check game over condition
        if (grid[0][2] !== null) {
            triggerGameOver();
        } else {
            spawnPuyo();
            // Restart fall interval
            clearInterval(dropInterval);
            dropInterval = setInterval(gameTick, currentSpeed);
        }
    }
}

// Web Audio API Synthesizers
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playPopSound(chain) {
    initAudio();
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    const pitch = 220 + (chain * 110); // Escalates pitch with chains
    osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitch * 2, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function playClickSound() {
    initAudio();
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function playCascadeSound() {
    initAudio();
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, audioCtx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
}

// UI Combo alerts
function showCombo(chainCount) {
    comboBanner.innerText = `${chainCount} CHAIN!`;
    comboBanner.classList.add('active');
}

function hideCombo() {
    comboBanner.classList.remove('active');
}

// Game Over handler
function triggerGameOver() {
    isGameOver = true;
    clearInterval(dropInterval);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('puyo-high-score', highScore);
    }
    
    finalScoreEl.innerText = score;
    gameoverOverlay.classList.add('active');
}

// Go back to main start menu
function showMenu() {
    clearInterval(dropInterval);
    menuOverlay.classList.add('active');
    gameoverOverlay.classList.remove('active');
}

// Render Next preview window
function renderNextPreview() {
    if (!nextPair) return;
    nextContainer.innerHTML = '';
    
    // Create elements in N direction stack
    const child = document.createElement('div');
    child.className = `puyo ${nextPair.child.color}`;
    
    const pivot = document.createElement('div');
    pivot.className = `puyo ${nextPair.pivot.color}`;
    
    nextContainer.appendChild(child);
    nextContainer.appendChild(pivot);
}

// Compute lowest ghost target position for preview
function getGhostRow() {
    if (!currentPair) return null;
    const p = currentPair.pivot;
    const c = currentPair.child;
    
    let dr = 0;
    while (isValidPosition(p.r + dr + 1, p.c) && isValidPosition(c.r + dr + 1, c.c)) {
        dr++;
    }
    return dr;
}

// Render complete grid state
function renderBoard() {
    // 1. Reset all cells
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.innerHTML = '';
    });
    
    // 2. Render static locked blocks
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== null) {
                const cell = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    const puyo = document.createElement('div');
                    puyo.className = `puyo ${grid[r][c].color}`;
                    
                    // Add visual connections
                    const adj = checkAdjacency(r, c, grid[r][c].color);
                    if (adj.up) puyo.classList.add('connect-up');
                    if (adj.down) puyo.classList.add('connect-down');
                    if (adj.left) puyo.classList.add('connect-left');
                    if (adj.right) puyo.classList.add('connect-right');
                    
                    cell.appendChild(puyo);
                }
            }
        }
    }
    
    // 3. Render ghost preview (if pair is dropping)
    if (currentPair && !isLockBoard) {
        const p = currentPair.pivot;
        const c = currentPair.child;
        const dr = getGhostRow();
        
        if (dr > 0) {
            const grP = p.r + dr;
            const grC = c.r + dr;
            
            if (grP >= 0) {
                const cellP = boardEl.querySelector(`.cell[data-row="${grP}"][data-col="${p.c}"]`);
                if (cellP) {
                    const ghost = document.createElement('div');
                    ghost.className = `puyo ghost ${p.color}`;
                    cellP.appendChild(ghost);
                }
            }
            if (grC >= 0) {
                const cellC = boardEl.querySelector(`.cell[data-row="${grC}"][data-col="${c.c}"]`);
                if (cellC) {
                    const ghost = document.createElement('div');
                    ghost.className = `puyo ghost ${c.color}`;
                    cellC.appendChild(ghost);
                }
            }
        }
        
        // 4. Render current active pair on top
        if (p.r >= 0) {
            const cell = boardEl.querySelector(`.cell[data-row="${p.r}"][data-col="${p.c}"]`);
            if (cell) {
                const puyo = document.createElement('div');
                puyo.className = `puyo ${p.color} wiggle`;
                cell.appendChild(puyo);
            }
        }
        if (c.r >= 0) {
            const cell = boardEl.querySelector(`.cell[data-row="${c.r}"][data-col="${c.c}"]`);
            if (cell) {
                const puyo = document.createElement('div');
                puyo.className = `puyo ${c.color} wiggle`;
                cell.appendChild(puyo);
            }
        }
    }
}

// Helper to find visual connects between static cells
function checkAdjacency(r, c, color) {
    const adj = { up: false, down: false, left: false, right: false };
    if (r > 0 && grid[r-1][c] && grid[r-1][c].color === color) adj.up = true;
    if (r < ROWS - 1 && grid[r+1][c] && grid[r+1][c].color === color) adj.down = true;
    if (c > 0 && grid[r][c-1] && grid[r][c-1].color === color) adj.left = true;
    if (c < COLS - 1 && grid[r][c+1] && grid[r][c+1].color === color) adj.right = true;
    return adj;
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (isLockBoard || isGameOver || !currentPair) return;
    
    switch (e.key) {
        case 'ArrowLeft':
            movePair(0, -1);
            break;
        case 'ArrowRight':
            movePair(0, 1);
            break;
        case 'ArrowDown':
            movePair(1, 0);
            break;
        case 'ArrowUp':
        case 'x':
        case 'X':
            rotatePair(true); // Rotate CW
            break;
        case 'z':
        case 'Z':
            rotatePair(false); // Rotate CCW
            break;
        case ' ': // Hard drop instantly
            dropInstantly();
            break;
    }
});

function dropInstantly() {
    const dr = getGhostRow();
    if (dr > 0) {
        currentPair.pivot.r += dr;
        currentPair.child.r += dr;
        renderBoard();
        lockPair();
    }
}

// Mobile gamepads event bindings
let controllerInterval = null;
function startControllerAction(actionFunc, delay = 220, interval = 70) {
    clearInterval(controllerInterval);
    actionFunc();
    // Hold support (DAS auto-repeat logic)
    controllerInterval = setTimeout(() => {
        controllerInterval = setInterval(actionFunc, interval);
    }, delay);
}

function stopControllerAction() {
    clearInterval(controllerInterval);
}

// Register gamepad listeners
function setupGamepad() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnDown = document.getElementById('btn-down');
    
    const btnCw = document.getElementById('btn-rotate-cw');
    const btnCcw = document.getElementById('btn-rotate-ccw');
    
    // Left Move
    btnLeft.addEventListener('mousedown', (e) => { e.preventDefault(); initAudio(); startControllerAction(() => movePair(0, -1)); });
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); startControllerAction(() => movePair(0, -1)); });
    
    // Right Move
    btnRight.addEventListener('mousedown', (e) => { e.preventDefault(); initAudio(); startControllerAction(() => movePair(0, 1)); });
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); startControllerAction(() => movePair(0, 1)); });
    
    // Soft Drop
    btnDown.addEventListener('mousedown', (e) => { e.preventDefault(); initAudio(); startControllerAction(() => movePair(1, 0), 150, 40); });
    btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); startControllerAction(() => movePair(1, 0), 150, 40); });
    
    // Rotations
    btnCw.addEventListener('click', (e) => { e.preventDefault(); initAudio(); rotatePair(true); });
    btnCw.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); rotatePair(true); });
    
    btnCcw.addEventListener('click', (e) => { e.preventDefault(); initAudio(); rotatePair(false); });
    btnCcw.addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); rotatePair(false); });
    
    // Global clear holds
    window.addEventListener('mouseup', stopControllerAction);
    window.addEventListener('touchend', stopControllerAction);
}

// Core setup
createBoardDOM();
setupGamepad();
renderNextPreview();
