// Simple test framework
const test = {
    results: { passed: 0, failed: 0 },
    assert: function(condition, message) {
        if (condition) {
            this.results.passed++;
            console.log('✅ PASS:', message);
        } else {
            this.results.failed++;
            console.error('❌ FAIL:', message);
        }
    },
    run: function() {
        console.log('\nTest Results:');
        console.log('Passed:', this.results.passed);
        console.log('Failed:', this.results.failed);
        console.log('Total:', this.results.passed + this.results.failed);
    }
};

// Import game functions
const gameState = window.gameState;
const DECK_DATA = window.DECK_DATA;
const shuffleDeck = window.shuffleDeck;
const dealCards = window.dealCards;

// Test cases
function testDeckShuffling() {
    const originalDeck = [...DECK_DATA.cards];
    const shuffledDeck = shuffleDeck(DECK_DATA.cards);
    
    // Test 1: Shuffled deck should have the same length
    test.assert(
        shuffledDeck.length === originalDeck.length,
        'Shuffled deck maintains the same number of cards'
    );
    
    // Test 2: Shuffled deck should contain all original cards
    const allCardsPresent = originalDeck.every(card => 
        shuffledDeck.some(shuffledCard => shuffledCard.name === card.name)
    );
    test.assert(
        allCardsPresent,
        'Shuffled deck contains all original cards'
    );
    
    // Test 3: Shuffled deck should be in a different order
    const isDifferentOrder = shuffledDeck.some((card, index) => 
        card.name !== originalDeck[index].name
    );
    test.assert(
        isDifferentOrder,
        'Shuffled deck is in a different order'
    );
}

function testGameLogic() {
    // Test 1: Initial game state
    test.assert(
        !gameState.gameStarted,
        'Game starts in non-started state'
    );
    
    // Test 2: Card dealing
    dealCards();
    const totalCards = DECK_DATA.cards.length;
    const expectedCardsPerPlayer = Math.ceil(totalCards / 2);
    
    test.assert(
        gameState.playerDeck.length === expectedCardsPerPlayer,
        'Player receives correct number of cards'
    );
    
    test.assert(
        gameState.computerDeck.length === Math.floor(totalCards / 2),
        'Computer receives correct number of cards'
    );
    
    // Test 3: Draw pile management
    test.assert(
        gameState.drawPile.length === 0,
        'Draw pile starts empty'
    );
}

function testAIBehavior() {
    // Test 1: AI attribute selection
    const computerCard = {
        name: "TestCard",
        size: 100,
        speed: 200,
        lifespan: 50,
        strength: 150
    };
    
    gameState.computerDeck = [computerCard];
    gameState.isPlayerTurn = false;
    gameState.gameStarted = true;
    
    // Simulate AI turn
    window.computerPlay();
    
    // AI should choose 'speed' as it's the highest value
    const selectedAttribute = document.querySelector('.attribute-button.selected');
    test.assert(
        selectedAttribute && selectedAttribute.dataset.attribute === 'speed',
        'AI selects attribute with highest value'
    );
}

function testWinConditions() {
    // Test 1: Game over detection when player has no cards
    gameState.playerDeck = [];
    gameState.computerDeck = [{ name: "Card" }];
    
    test.assert(
        window.checkGameOver(),
        'Game over detected when player has no cards'
    );
    
    // Test 2: Game over detection when computer has no cards
    gameState.playerDeck = [{ name: "Card" }];
    gameState.computerDeck = [];
    
    test.assert(
        window.checkGameOver(),
        'Game over detected when computer has no cards'
    );
}

// Run tests
function runAllTests() {
    console.log('Running tests...\n');
    
    console.log('Testing Deck Shuffling:');
    testDeckShuffling();
    
    console.log('\nTesting Game Logic:');
    testGameLogic();
    
    console.log('\nTesting AI Behavior:');
    testAIBehavior();
    
    console.log('\nTesting Win Conditions:');
    testWinConditions();
    
    test.run();
}

// Export test runner
window.runTests = runAllTests; 