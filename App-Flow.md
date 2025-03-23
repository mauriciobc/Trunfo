App Flow
The app flow describes the sequence of actions from game start to finish:

    Start Game
        Create a deck of Top Trumps cards based on a single theme.
        Shuffle the deck using a randomization algorithm (e.g., Fisher-Yates).
        Deal the cards equally into two face-down piles for the player and computer.
    Player’s Turn
        Display the player’s top card with all attributes and values.
        Present clickable buttons for the player to select a category.
        If the computer won the previous round, it selects the first attribute from its top card.
    Comparison
        Reveal the computer’s top card value for the selected category.
        Compare the player’s and computer’s values to determine the winner (highest value wins).
    Update Game State
        Transfer both cards to the winner’s pile, placed at the bottom.
        In a draw, set the cards aside; the next round’s winner claims them.
        Update the displayed card counts for both player and computer.
    Check for Game Over
        If either pile is empty (i.e., one player has all cards), end the game.
        Display a "Game Over" screen indicating the winner (player or computer).
    Repeat
        The winner of the round selects the category for the next round.
        Continue until the game over condition is met.
