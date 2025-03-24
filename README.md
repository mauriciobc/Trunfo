# TRUNFO - Top Trumps Game

A web-based single-player Top Trumps game built with vanilla JavaScript, HTML5, and CSS3. Play against a computer opponent in this classic card comparison game.

## 🎮 Play Now

Visit [https://mauriciobc.github.io/trunfo](https://mauriciobc.github.io/trunfo) to play the game online.

## 🎯 Features

- Single-player gameplay against an AI opponent
- Themed deck with unique attributes for each card
- Smooth animations and visual feedback
- Score tracking and game statistics
- Responsive design
- Error handling and loading states
- Comprehensive test suite

## 🎲 How to Play

1. The deck is split equally between you and the computer.
2. Each round, you'll see your top card with its attributes.
3. Choose an attribute to compare with the computer's card.
4. The player with the higher value wins both cards.
5. In case of a draw, the cards go to a draw pile.
6. The winner of the next round gets the draw pile too.
7. The game ends when one player has all the cards.

## 🛠️ Development

### Prerequisites

- Node.js (v20 or higher)
- npm (v9 or higher)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/trunfo.git
   cd trunfo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start a local development server (using any static file server):
   ```bash
   # Example using Python's built-in server
   python -m http.server 8000
   ```

4. Open http://localhost:8000/src in your browser.

### Project Structure

```
trunfo/
├── src/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── game.js
│   ├── tests/
│   │   └── game.test.js
│   └── index.html
├── build.js
├── package.json
└── README.md
```

### Building for Production

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

### Running Tests

1. Open the game in your browser
2. Click the "Run Tests" button in the game interface
3. Check the browser console for test results

## 🧪 Testing

The game includes a comprehensive test suite that covers:
- Card dealing and deck management
- Game logic and state management
- AI behavior and decision making
- Win conditions and game over states

## 🎨 Customization

### Adding New Card Decks

1. Open `src/js/game.js`
2. Modify the `DECK_DATA` object:
   ```javascript
   const DECK_DATA = {
       theme: "Your Theme",
       cards: [
           { name: "Card1", attribute1: value1, attribute2: value2 },
           // Add more cards...
       ]
   };
   ```

### Styling

1. Modify `src/css/styles.css` to customize the game's appearance
2. The game uses CSS variables for easy theme customization

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📦 Dependencies

Development dependencies:
- clean-css: CSS minification
- gh-pages: GitHub Pages deployment
- html-minifier: HTML minification
- terser: JavaScript minification

## 🔄 Version History

- 1.0.0: Initial release
  - Basic game functionality
  - Single-player mode
  - AI opponent
  - Test suite
  - Production build setup 