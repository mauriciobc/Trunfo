Product Documentation: Web-Based Single-Player TRUNFO Game
Overview
This document outlines the development plan and technical details for a Minimum Viable Product (MVP) of a web-based single-player Top Trumps game. Top Trumps is a globally recognized card game where players compare numerical statistics across various categories to win their opponent’s cards. The MVP focuses on delivering a functional and engaging single-player experience, pitting the user against a computer-controlled opponent. The development strategy emphasizes essential gameplay mechanics and a lean approach for rapid deployment.
How to Play

    Start Game: The game begins with a shuffled deck of Top Trumps cards themed around a single category (e.g., "Awesome Animals"), divided equally between the player and the computer into two face-down piles.
    Select Category: The player views their top card, which displays multiple numerical attributes, and selects one category to compare with the computer’s top card.
    Compare Values: The computer reveals its top card’s value for the chosen category. The higher value wins the round.
    Update Card Piles: The winner takes both cards, placing them at the bottom of their pile. In case of a draw, the cards are set aside, and the next round’s winner claims them along with the current round’s cards.
    Game Continuation: The winner of the round selects the category for the next round. This continues until one player has all the cards.
    Game Over: The game ends when one player collects all the cards, displaying a win or loss message.

Features

    Single-Player Mode: Compete against a basic AI opponent.
    Single Themed Deck: A predefined deck (e.g., "Awesome Animals") with attributes like "Size," "Speed," and "Lifespan."
    Intuitive UI: Clear card displays, clickable category selection, and visual feedback on round outcomes.
    Core Gameplay: Shuffling, dealing, comparing, and card collection with draw handling.

