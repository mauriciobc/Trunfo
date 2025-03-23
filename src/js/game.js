// Game state
const gameState = {
    playerDeck: [],
    computerDeck: [],
    drawPile: [],
    isPlayerTurn: true,
    gameStarted: false
};

// Sample deck data (we'll expand this later)
const DECK_DATA = {
    theme: "Awesome Animals",
    cards: [
        { name: "Lion", size: 250, speed: 80, lifespan: 15 },
        { name: "Elephant", size: 400, speed: 40, lifespan: 70 },
        { name: "Cheetah", size: 150, speed: 120, lifespan: 12 },
        { name: "Giraffe", size: 500, speed: 60, lifespan: 25 },
        { name: "Gorilla", size: 180, speed: 40, lifespan: 40 },
        { name: "Kangaroo", size: 200, speed: 70, lifespan: 22 },
        { name: "Rhinoceros", size: 380, speed: 50, lifespan: 45 },
        { name: "Zebra", size: 220, speed: 65, lifespan: 25 }
    ]
};

// DOM Elements
const playerCardElement = document.getElementById('player-card');
const computerCardElement = document.getElementById('computer-card');
const playerCardsCount = document.getElementById('player-cards');
const computerCardsCount = document.getElementById('computer-cards');
const gameMessage = document.getElementById('game-message');
const startButton = document.getElementById('start-game');
const restartButton = document.getElementById('restart-game');

// Fisher-Yates shuffle algorithm
function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Deal cards to players
function dealCards() {
    const shuffledDeck = shuffleDeck(DECK_DATA.cards);
    const halfDeck = Math.ceil(shuffledDeck.length / 2);
    gameState.playerDeck = shuffledDeck.slice(0, halfDeck);
    gameState.computerDeck = shuffledDeck.slice(halfDeck);
    updateCardCounts();
}

// Update card counts display
function updateCardCounts() {
    playerCardsCount.textContent = gameState.playerDeck.length;
    computerCardsCount.textContent = gameState.computerDeck.length;
}

// Display card on the game board
function displayCard(card, element, showAttributes = true) {
    if (!card) return;

    const attributes = showAttributes ? `
        <ul class="attribute-list">
            ${Object.entries(card)
                .filter(([key]) => key !== 'name')
                .map(([key, value]) => `
                    <li>
                        <button class="attribute-button" data-attribute="${key}">
                            ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}
                        </button>
                    </li>
                `).join('')}
        </ul>
    ` : '';

    element.innerHTML = `
        <div class="card-content">
            <h3>${card.name}</h3>
            ${attributes}
        </div>
    `;

    if (showAttributes) {
        element.querySelectorAll('.attribute-button').forEach(button => {
            button.addEventListener('click', () => handleAttributeSelection(button.dataset.attribute));
        });
    }
}

// Handle attribute selection
function handleAttributeSelection(attribute) {
    if (!gameState.gameStarted || !gameState.isPlayerTurn) return;

    const playerCard = gameState.playerDeck[0];
    const computerCard = gameState.computerDeck[0];

    // Reveal computer's card
    displayCard(computerCard, computerCardElement, true);
    computerCardElement.classList.remove('card-back');

    // Compare values and determine winner
    const playerValue = playerCard[attribute];
    const computerValue = computerCard[attribute];

    let message;
    if (playerValue > computerValue) {
        message = "You win this round!";
        handleRoundWin('player');
    } else if (computerValue > playerValue) {
        message = "Computer wins this round!";
        handleRoundWin('computer');
    } else {
        message = "It's a draw!";
        handleDraw();
    }

    gameMessage.textContent = message;
    checkGameOver();
}

// Handle round win
function handleRoundWin(winner) {
    const playerCard = gameState.playerDeck.shift();
    const computerCard = gameState.computerDeck.shift();

    if (winner === 'player') {
        gameState.playerDeck.push(playerCard, computerCard);
        gameState.isPlayerTurn = true;
    } else {
        gameState.computerDeck.push(playerCard, computerCard);
        gameState.isPlayerTurn = false;
    }

    // Add any cards from draw pile
    if (gameState.drawPile.length > 0) {
        if (winner === 'player') {
            gameState.playerDeck.push(...gameState.drawPile);
        } else {
            gameState.computerDeck.push(...gameState.drawPile);
        }
        gameState.drawPile = [];
    }

    setTimeout(() => {
        updateCardCounts();
        startNextRound();
    }, 1500);
}

// Handle draw
function handleDraw() {
    const playerCard = gameState.playerDeck.shift();
    const computerCard = gameState.computerDeck.shift();
    gameState.drawPile.push(playerCard, computerCard);
    
    setTimeout(() => {
        updateCardCounts();
        startNextRound();
    }, 1500);
}

// Start next round
function startNextRound() {
    if (!checkGameOver()) {
        computerCardElement.classList.add('card-back');
        if (gameState.isPlayerTurn) {
            displayCard(gameState.playerDeck[0], playerCardElement, true);
            displayCard(null, computerCardElement, false);
            gameMessage.textContent = "Select an attribute to compare!";
        } else {
            // Computer's turn
            displayCard(gameState.playerDeck[0], playerCardElement, true);
            displayCard(null, computerCardElement, false);
            setTimeout(computerPlay, 1000);
        }
    }
}

// Computer play
function computerPlay() {
    if (!gameState.gameStarted || gameState.isPlayerTurn) return;

    const computerCard = gameState.computerDeck[0];
    const attributes = Object.keys(computerCard).filter(key => key !== 'name');
    const selectedAttribute = attributes[0]; // Always select first attribute for MVP

    handleAttributeSelection(selectedAttribute);
}

// Check for game over
function checkGameOver() {
    if (gameState.playerDeck.length === 0 || gameState.computerDeck.length === 0) {
        const winner = gameState.playerDeck.length > 0 ? "You win!" : "Computer wins!";
        gameMessage.textContent = `Game Over - ${winner}`;
        startButton.style.display = 'none';
        restartButton.style.display = 'inline-block';
        gameState.gameStarted = false;
        return true;
    }
    return false;
}

// Start game
function startGame() {
    gameState.gameStarted = true;
    gameState.isPlayerTurn = true;
    gameState.drawPile = [];
    dealCards();
    startButton.style.display = 'none';
    restartButton.style.display = 'none';
    startNextRound();
}

// Event listeners
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
