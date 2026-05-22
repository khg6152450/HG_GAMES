/**
 * 🍎 카드 데이터 설정
 * 나중에 개별 사진으로 바꾸고 싶을 때, image 속성에 경로를 입력하세요.
 * (예: image: 'assets/photo1.jpg')
 */
const CARD_SET = [
    { name: 'banana', emoji: '🍌', image: null },
    { name: 'grape', emoji: '🍇', image: null },
    { name: 'watermelon', emoji: '🍉', image: null },
    { name: 'pineapple', emoji: '🍍', image: null },
    { name: 'lemon', emoji: '🍋', image: null },
    { name: 'kiwi', emoji: '🥝', image: null },
    { name: 'blueberry', emoji: '🫐', image: null },
    { name: 'avocado', emoji: '🥑', image: null },
    { name: 'orange', emoji: '🍊', image: null },
    { name: 'strawberry', emoji: '🍓', image: null },
    { name: 'cherry', emoji: '🍒', image: null },
    { name: 'coconut', emoji: '🥥', image: null },
    { name: 'mango', emoji: '🥭', image: null },
    { name: 'pear', emoji: '🍐', image: null },
    { name: 'melon', emoji: '🍈', image: null },
    // 헷갈리는 붉은색 과일 대신 확실히 구분되는 동물 아이콘으로 배치
    { name: 'dog', emoji: '🐶', image: null },
    { name: 'cat', emoji: '🐱', image: null },
    { name: 'tiger', emoji: '🐯', image: null }
];

let cards = [];
let flippedCards = [];
let matchedCount = 0;
let moves = 0;
let timer = 0;
let timerInterval = null;
let isLockBoard = false;
let currentRows = 4;
let currentCols = 4;

const gridEl = document.getElementById('game-grid');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const menuOverlay = document.getElementById('menu-overlay');
const winOverlay = document.getElementById('win-overlay');

function initGame(rows, cols) {
    currentRows = rows;
    currentCols = cols;
    resetGame();
    menuOverlay.classList.remove('active');
}

function resetGame() {
    clearInterval(timerInterval);
    timer = 0;
    moves = 0;
    matchedCount = 0;
    flippedCards = [];
    isLockBoard = false;
    updateStats();
    
    // Prepare card list (pairs)
    const pairsCount = (currentRows * currentCols) / 2;
    const selectedCards = [...CARD_SET].slice(0, pairsCount);
    const gameCards = [...selectedCards, ...selectedCards];
    
    // Shuffle
    shuffle(gameCards);
    
    // Render
    renderGrid(gameCards);
    
    // Start timer on first flip
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function renderGrid(gameCards) {
    gridEl.innerHTML = '';
    gridEl.className = `game-grid grid-${currentRows}x${currentCols}`;
    
    gameCards.forEach((cardData, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.name = cardData.name;
        
        const content = cardData.image 
            ? `<img src="${cardData.image}" alt="${cardData.name}">`
            : `<span class="emoji">${cardData.emoji}</span>`;
            
        card.innerHTML = `
            <div class="card-face card-back"></div>
            <div class="card-face card-front">
                ${content}
            </div>
        `;
        
        card.addEventListener('click', () => flipCard(card));
        gridEl.appendChild(card);
    });
}

function flipCard(card) {
    if (isLockBoard) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    
    if (!timerInterval) startTimer();
    
    card.classList.add('flipped');
    flippedCards.push(card);
    
    if (flippedCards.length === 2) {
        moves++;
        updateStats();
        checkMatch();
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;
    const isMatch = card1.dataset.name === card2.dataset.name;
    
    if (isMatch) {
        card1.classList.add('matched');
        card2.classList.add('matched');
        matchedCount += 2;
        flippedCards = [];
        if (matchedCount === currentRows * currentCols) {
            winGame();
        }
    } else {
        isLockBoard = true;
        setTimeout(() => {
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
            isLockBoard = false;
        }, 1000);
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        updateStats();
    }, 1000);
}

function updateStats() {
    movesEl.innerText = moves;
    const mins = Math.floor(timer / 60).toString().padStart(2, '0');
    const secs = (timer % 60).toString().padStart(2, '0');
    timerEl.innerText = `${mins}:${secs}`;
}

function winGame() {
    clearInterval(timerInterval);
    setTimeout(() => {
        document.getElementById('final-stats').innerText = `${timerEl.innerText} / ${moves} moves`;
        winOverlay.classList.add('active');
    }, 600);
}

function showMenu() {
    winOverlay.classList.remove('active');
    menuOverlay.classList.add('active');
    clearInterval(timerInterval);
    timerInterval = null;
}

