Backend Structure
For the MVP, no backend is implemented; all logic resides in the frontend JavaScript. However, a potential backend structure is outlined for future scalability:

    API Endpoints (Future Consideration):
        POST /start-game: Initialize a new game, shuffle, and deal cards.
        POST /select-category: Accept a category choice, compare values, and return the round result.
        GET /game-state: Retrieve the current state (e.g., card piles, scores).
    Game Logic Functions:
        createDeck(): Generate a themed deck with card objects.
        shuffleDeck(): Randomize the deck order.
        dealCards(): Split the deck between player and computer.
        compareCards(category): Compare values and handle draws.
        updateState(winner): Move cards to the winner’s pile and check for game over.
    Data Structure:
        Card Object: { name: "Lion", theme: "Animals", attributes: { size: 250, speed: 80, lifespan: 15 } }
        Game State: { playerHand: [card1, card2, ...], computerHand: [card3, card4, ...], drawPile: [] }
    AI Logic:
        For the MVP, the AI selects the first attribute when it wins a round.
        Future enhancement: Smarter AI choosing the best attribute based on values.

