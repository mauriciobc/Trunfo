// Game state
const gameState = {
    playerDeck: [],
    computerDeck: [],
    drawPile: [],
    isPlayerTurn: true,
    gameStarted: false,
    isAnimating: false,
    roundHistory: [],
    score: {
        player: 0,
        computer: 0,
        draws: 0,
        roundsPlayed: 0
    }
};

// Sample deck data (we'll expand this later)
const DECK_DATA = {
    theme: "Awesome Animals",
    cards: [
        { name: "Lion", size: 250, speed: 80, lifespan: 15, strength: 95 },
        { name: "Elephant", size: 400, speed: 40, lifespan: 70, strength: 100 },
        { name: "Cheetah", size: 150, speed: 120, lifespan: 12, strength: 50 },
        { name: "Giraffe", size: 500, speed: 60, lifespan: 25, strength: 40 },
        { name: "Gorilla", size: 180, speed: 40, lifespan: 40, strength: 85 },
        { name: "Kangaroo", size: 200, speed: 70, lifespan: 22, strength: 60 },
        { name: "Rhinoceros", size: 380, speed: 50, lifespan: 45, strength: 90 },
        { name: "Zebra", size: 220, speed: 65, lifespan: 25, strength: 45 }
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
const rulesModal = document.getElementById('rules-modal');
const showRulesButton = document.getElementById('show-rules');
const closeRulesButton = document.getElementById('close-rules');

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

// Update card counts display with animation
function updateCardCounts() {
    const playerCount = gameState.playerDeck.length;
    const computerCount = gameState.computerDeck.length;
    
    animateNumber(playerCardsCount, parseInt(playerCardsCount.textContent), playerCount);
    animateNumber(computerCardsCount, parseInt(computerCardsCount.textContent), computerCount);
}

// Animate number counting
function animateNumber(element, start, end) {
    const duration = 500;
    const steps = 20;
    const stepValue = (end - start) / steps;
    let current = start;
    
    const animate = () => {
        current += stepValue;
        if ((stepValue > 0 && current >= end) || (stepValue < 0 && current <= end)) {
            element.textContent = end;
            return;
        }
        element.textContent = Math.round(current);
        requestAnimationFrame(animate);
    };
    
    animate();
}

// Display card on the game board
function displayCard(card, element, showAttributes = true) {
    if (!card) {
        element.innerHTML = '';
        return;
    }

    const attributes = showAttributes ? `
        <ul class="attribute-list">
            ${Object.entries(card)
                .filter(([key]) => key !== 'name')
                .map(([key, value]) => `
                    <li>
                        <button class="attribute-button" data-attribute="${key}">
                            <span>${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                            <span>${value}</span>
                        </button>
                    </li>
                `).join('')}
        </ul>
    ` : '';

    element.innerHTML = `
        <div class="card-content slide-in">
            <h3>${card.name}</h3>
            ${attributes}
        </div>
    `;

    if (showAttributes && gameState.isPlayerTurn) {
        element.querySelectorAll('.attribute-button').forEach(button => {
            button.addEventListener('click', () => handleAttributeSelection(button.dataset.attribute));
        });
    }
}

// Handle attribute selection
function handleAttributeSelection(attribute) {
    if (!gameState.gameStarted || !gameState.isPlayerTurn || gameState.isAnimating) return;

    gameState.isAnimating = true;
    const playerCard = gameState.playerDeck[0];
    const computerCard = gameState.computerDeck[0];

    // Highlight selected attribute
    const selectedButton = playerCardElement.querySelector(`[data-attribute="${attribute}"]`);
    selectedButton.classList.add('selected');

    // Reveal computer's card with animation
    computerCardElement.classList.remove('card-back');
    displayCard(computerCard, computerCardElement, true);

    // Compare values and determine winner
    const playerValue = playerCard[attribute];
    const computerValue = computerCard[attribute];

    setTimeout(() => {
        // Highlight winner and loser
        const playerButton = playerCardElement.querySelector(`[data-attribute="${attribute}"]`);
        const computerButton = computerCardElement.querySelector(`[data-attribute="${attribute}"]`);
        
        if (playerValue > computerValue) {
            playerButton.classList.add('winner');
            computerButton.classList.add('loser');
            showGameMessage("You win this round!", 'success');
            handleRoundWin('player', attribute);
        } else if (computerValue > playerValue) {
            playerButton.classList.add('loser');
            computerButton.classList.add('winner');
            showGameMessage("Computer wins this round!", 'error');
            handleRoundWin('computer', attribute);
        } else {
            playerButton.classList.add('selected');
            computerButton.classList.add('selected');
            showGameMessage("It's a draw!", '');
            handleDraw(attribute);
        }
    }, 500);
}

// Show game message with animation
function showGameMessage(message, type = '') {
    gameMessage.textContent = message;
    gameMessage.className = 'game-message slide-in';
    if (type) gameMessage.classList.add(type);
}

// Handle round win
function handleRoundWin(winner, attribute) {
    const playerCard = gameState.playerDeck.shift();
    const computerCard = gameState.computerDeck.shift();

    // Record round history for AI learning
    gameState.roundHistory.push({
        winner,
        attribute,
        playerCard,
        computerCard
    });

    // Update score
    gameState.score.roundsPlayed++;
    if (winner === 'player') {
        gameState.score.player++;
        gameState.playerDeck.push(playerCard, computerCard);
        gameState.isPlayerTurn = true;
        
        // Add card transfer animation
        computerCardElement.classList.add('transfer');
        setTimeout(() => {
            computerCardElement.classList.remove('transfer');
        }, 1000);
    } else {
        gameState.score.computer++;
        gameState.computerDeck.push(playerCard, computerCard);
        gameState.isPlayerTurn = false;
        
        // Add card transfer animation
        playerCardElement.classList.add('transfer');
        setTimeout(() => {
            playerCardElement.classList.remove('transfer');
        }, 1000);
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

    // Update game message with score
    const scoreMessage = `Score - You: ${gameState.score.player} | Computer: ${gameState.score.computer} | Draws: ${gameState.score.draws}`;
    showGameMessage(`${winner === 'player' ? "You win" : "Computer wins"} this round! ${scoreMessage}`, winner === 'player' ? 'success' : 'error');

    setTimeout(() => {
        updateCardCounts();
        gameState.isAnimating = false;
        startNextRound();
    }, 1500);
}

// Handle draw
function handleDraw(attribute) {
    const playerCard = gameState.playerDeck.shift();
    const computerCard = gameState.computerDeck.shift();
    gameState.drawPile.push(playerCard, computerCard);
    
    // Update score
    gameState.score.roundsPlayed++;
    gameState.score.draws++;
    
    // Record draw in history
    gameState.roundHistory.push({
        winner: 'draw',
        attribute,
        playerCard,
        computerCard
    });

    // Update game message with score
    const scoreMessage = `Score - You: ${gameState.score.player} | Computer: ${gameState.score.computer} | Draws: ${gameState.score.draws}`;
    showGameMessage(`It's a draw! ${scoreMessage}`);

    setTimeout(() => {
        updateCardCounts();
        gameState.isAnimating = false;
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
            showGameMessage("Select an attribute to compare!");
        } else {
            displayCard(gameState.playerDeck[0], playerCardElement, true);
            displayCard(null, computerCardElement, false);
            setTimeout(computerPlay, 1000);
        }
    }
}

// Improved computer AI
function computerPlay() {
    if (!gameState.gameStarted || gameState.isPlayerTurn) return;

    const computerCard = gameState.computerDeck[0];
    const attributes = Object.entries(computerCard)
        .filter(([key]) => key !== 'name')
        .map(([key, value]) => ({ name: key, value }));

    // Strategy 1: Choose highest value
    let selectedAttribute = attributes.reduce((best, current) => 
        current.value > best.value ? current : best
    ).name;

    // Strategy 2: Learn from history (if available)
    if (gameState.roundHistory.length > 0) {
        const recentRounds = gameState.roundHistory.slice(-3);
        const successfulAttributes = recentRounds
            .filter(round => round.winner === 'computer')
            .map(round => round.attribute);

        if (successfulAttributes.length > 0) {
            // Prefer previously successful attributes if they have high values
            const bestHistoricalAttribute = successfulAttributes.find(attr => 
                computerCard[attr] >= Math.max(...attributes.map(a => computerCard[a.name])) * 0.8
            );
            if (bestHistoricalAttribute) {
                selectedAttribute = bestHistoricalAttribute;
            }
        }
    }

    handleAttributeSelection(selectedAttribute);
}

// Check for game over
function checkGameOver() {
    if (gameState.playerDeck.length === 0 || gameState.computerDeck.length === 0) {
        const isPlayerWinner = gameState.playerDeck.length > 0;
        const finalMessage = `Game Over!\n
            ${isPlayerWinner ? "Congratulations! You win!" : "Computer wins!"}\n
            Final Score:\n
            You: ${gameState.score.player} wins\n
            Computer: ${gameState.score.computer} wins\n
            Draws: ${gameState.score.draws}\n
            Total Rounds: ${gameState.score.roundsPlayed}`;
        
        showGameMessage(finalMessage.replace(/\n/g, '<br>'), isPlayerWinner ? 'success' : 'error');
        
        // Show game over screen
        showGameOverScreen(isPlayerWinner);
        
        startButton.style.display = 'none';
        restartButton.style.display = 'inline-block';
        gameState.gameStarted = false;
        return true;
    }
    return false;
}

// Show game over screen
function showGameOverScreen(isPlayerWinner) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content slide-in">
            <h2><i class="fas ${isPlayerWinner ? 'fa-trophy' : 'fa-robot'}"></i> Game Over</h2>
            <div class="rules-content">
                <h3>${isPlayerWinner ? "Congratulations! You Win!" : "Computer Wins!"}</h3>
                <div class="final-stats">
                    <p>Final Statistics:</p>
                    <ul>
                        <li>Your Wins: ${gameState.score.player}</li>
                        <li>Computer Wins: ${gameState.score.computer}</li>
                        <li>Draws: ${gameState.score.draws}</li>
                        <li>Total Rounds: ${gameState.score.roundsPlayed}</li>
                    </ul>
                </div>
            </div>
            <button class="btn" onclick="this.closest('.modal').remove(); startGame();">
                <i class="fas fa-redo"></i> Play Again
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Start game
function startGame() {
    gameState.gameStarted = true;
    gameState.isPlayerTurn = true;
    gameState.drawPile = [];
    gameState.roundHistory = [];
    gameState.isAnimating = false;
    gameState.score = {
        player: 0,
        computer: 0,
        draws: 0,
        roundsPlayed: 0
    };
    
    // Reset UI
    gameMessage.className = 'game-message';
    gameMessage.textContent = '';
    startButton.style.display = 'none';
    restartButton.style.display = 'none';
    
    // Remove any existing game over screen
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    dealCards();
    startNextRound();
}

// Event listeners
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
showRulesButton.addEventListener('click', showRules);
closeRulesButton.addEventListener('click', hideRules);

// Close modal when clicking outside
rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
        hideRules();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rulesModal.style.display === 'flex') {
        hideRules();
    }
});

// Initialize game
showGameMessage("Click 'Start Game' to begin!");

// Add these functions after the existing functions
function showRules() {
    rulesModal.style.display = 'flex';
    rulesModal.classList.add('slide-in');
}

function hideRules() {
    rulesModal.classList.remove('slide-in');
    rulesModal.style.display = 'none';
}
