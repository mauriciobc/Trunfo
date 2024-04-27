from random import shuffle

class Card:
    def __init__(self, attributes):
        self.attributes = attributes

    def get_attribute(self, category):
        return self.attributes[category]


class Deck:
    def __init__(self, name, cards):
        self.name = name
        self.cards = cards

    def shuffle(self):
        shuffle(self.cards)

    def draw(self, num_cards):
        return [self.cards.pop() for _ in range(num_cards)]


class Player:
    def __init__(self, name):
        self.name = name
        self.hand = []

    def add_to_hand(self, cards):
        self.hand.extend(cards)

    def play_card(self, index):
        return self.hand.pop(index)


class Game:
    def __init__(self, deck, num_players):
        self.deck = deck
        self.players = [Player(f"Player {i+1}") for i in range(num_players)]
        self.discard_pile = []
        self.current_category = None
        self.winners = []
        self.initialize_game()

    def initialize_game(self):
        self.deck.shuffle()
        for player in self.players:
            player.add_to_hand(self.deck.draw(5))

    def play_round(self, player_index, category):
        played_cards = []
        for player in self.players:
            card = player.play_card(player_index)
            played_cards.append(card)
        winner_index = self.find_winner(played_cards, category)
        self.discard_pile.extend(played_cards)
        self.update_scores(winner_index)
        return winner_index

    def find_winner(self, cards, category):
        winning_card = max(cards, key=lambda card: card.get_attribute(category))
        return cards.index(winning_card)

    def update_scores(self, winner_index):
        self.players[winner_index].score += len(self.players)

    def check_for_end_of_game(self):
        active_players = [player for player in self.players if len(player.hand) > 0]
        if len(active_players) <= 1:
            self.determine_winner()
            return True
        return False

    def determine_winner(self):
        max_score = max([player.score for player in self.players])
        winners = [player for player in self.players if player.score == max