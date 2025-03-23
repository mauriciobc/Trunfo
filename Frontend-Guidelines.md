Frontend Guidelines
The frontend design ensures an intuitive and engaging user experience:

    Card Display:
        Player’s Card: Show the card face-up with the theme, name, and all attributes (e.g., "Lion: Size: 250, Speed: 80, Lifespan: 15").
        Computer’s Card: Show face-down (card back) until comparison, then reveal the selected attribute’s value.
    Category Selection:
        Place clickable buttons next to each attribute on the player’s card.
        Highlight the selected category (e.g., with a color change) for clarity.
    Visual Feedback:
        After comparison, display a message (e.g., "You win the round!" or "Computer wins the round!").
        Show updated card counts (e.g., "Player: 15, Computer: 13") after each round.
        Animate card movement to the winner’s pile (optional for MVP, kept simple).
    Game Over Screen:
        Display a clear message (e.g., "You Win!" or "Computer Wins!") when the game ends.
        Include a "Restart" button to begin a new game.
    User Experience:
        Use a clean, minimal layout with readable fonts and high-contrast colors.
        Ensure responsiveness for desktop browsers (mobile support deferred to later iterations).
        Provide brief instructions or tooltips if needed (e.g., "Click a category to compare")
