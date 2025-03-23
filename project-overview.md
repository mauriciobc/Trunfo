Project Overview: Web-Based Single-Player Top Trumps Game

Goal: To develop a Minimum Viable Product (MVP) of a web-based single-player Top Trumps game where the user can compete against a computer opponent.

Target Audience: Individuals familiar with the basic rules of Top Trumps or those interested in learning.

Key Features (MVP):

    Single-player mode against a basic AI opponent.
    One pre-selected Top Trumps deck theme (e.g., Awesome Animals).
    Clear visual representation of player and computer cards.
    Intuitive user interface for category selection.
    Core game logic for comparing card attributes and determining round winners.
    Tracking of card counts for both players.
    Game over condition when one player has all the cards.
    Simple "Game Over" screen indicating the winner.

Technology Stack:

    HTML5
    CSS3
    JavaScript

Development Approach:

    Iterative development with a focus on core functionality for the MVP.
    Prioritize simplicity and efficiency in code and design.

Success Metrics:

    A fully playable single-player game with no critical bugs.
    Positive initial user experience.

.notes/task_list.md:
Task List: MVP Development

Phase 1: Project Setup and Core Game Logic (Estimated: Week 1-3)

    [ ] Set up project directory and basic file structure.
    [ ] Define the data structure for Top Trumps cards (JavaScript objects).
    [ ] Create the initial Top Trumps deck data.
    [ ] Implement function to shuffle the deck.
    [ ] Implement function to deal cards to player and computer.
    [ ] Implement core round logic:
        [ ] Track current player.
        [ ] Allow player to select a category.
        [ ] Retrieve attribute values for both cards.
        [ ] Compare values and determine the winner.
        [ ] Update card piles.
        [ ] Implement draw condition logic.

Phase 2: User Interface and Basic AI (Estimated: Week 4-7)

    [ ] Create basic HTML structure for the game interface.
    [ ] Apply basic CSS styling.
    [ ] Implement JavaScript to display the player's top card.
    [ ] Implement JavaScript to represent the computer's top card (initially face down).
    [ ] Add interactive elements (buttons) for category selection.
    [ ] Implement JavaScript event listeners for category selection.
    [ ] Implement basic AI opponent logic (select first available attribute).
    [ ] Implement JavaScript to reveal the computer's card value after selection.
    [ ] Implement JavaScript to update the visual representation of card counts.
    [ ] Implement JavaScript to display the round winner.

Phase 3: Game Flow and End Condition (Estimated: Week 8-9)

    [ ] Implement logic to manage the sequence of turns.
    [ ] Implement check for game over condition (one player has all cards).
    [ ] Implement "Game Over" screen with win/loss indication.
    [ ] Refine CSS styling for improved visual appeal.
    [ ] Implement basic user experience enhancements (e.g., instructions).

Phase 4: Testing and Refinement (Estimated: Week 10)

    [ ] Conduct thorough testing of all game functionalities.
    [ ] Identify and fix any bugs or issues.
    [ ] Review and refine game logic and user interface based on testing.
