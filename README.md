# TRUNFO Card Game

A web-based implementation of the classic Top Trumps card game, where players compare numerical attributes of cards to win rounds and collect cards from their opponent.

## Features

- Single-player gameplay against a computer opponent
- Themed deck of cards (currently featuring "Awesome Animals")
- Interactive card display with clickable attributes
- Score tracking and game state management
- Responsive design for desktop browsers

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript

## Project Structure

```
src/
├── index.html      # Main game interface
├── css/
│   └── styles.css  # Game styles
├── js/
│   └── game.js     # Game logic
└── assets/         # Future: images and other assets
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/trunfo.git
   ```

2. Open `src/index.html` in your web browser to start playing.

## How to Play

1. Click "Start Game" to begin
2. On your turn:
   - View your card's attributes
   - Click an attribute to compare with the computer's card
3. The player with the higher value wins both cards
4. In case of a draw, cards go to a draw pile
5. The winner of the next round claims the draw pile
6. Game ends when one player collects all cards

## Development

The project is organized into milestones:

1. Core Game Logic ✓
   - Basic game structure
   - Card management
   - Round logic

2. User Interface and Basic AI (In Progress)
   - Card display
   - Attribute selection
   - Simple computer opponent

3. Game Flow and Win Conditions (Planned)
   - Turn management
   - Draw handling
   - Game over conditions

4. Testing and Polish (Planned)
   - Bug fixes
   - UI improvements
   - Performance optimization

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by the classic Top Trumps card game
- Built as a learning project for web development 