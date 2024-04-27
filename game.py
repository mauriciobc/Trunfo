from random import shuffle

class Game:
  def __init__(self, deck_name, num_players):
    self.deck_name = deck_name
    self.players = [[] for _ in range(num_players)]  # Player hands
    self.discard_pile = []
    self.current_category = None
    self.deal_cards(CARDS)  # Replace CARDS with your card data

  def deal_cards(self, card_data):
    shuffle(card_data)
    for player in self.players:
      player.extend(card_data[:5])  # Deal 5 cards to each player
      del card_data[:5]  # Remove dealt cards from deck

  def play_round(self, player_index, category):
    self.current_category = category
    played_cards = []
    for player in self.players:
      card = player.pop(player_index)  # Player plays chosen card
      played_cards.append(card)
    winner_index = self.find_winner(played_cards, category)
    self.discard_pile.extend(played_cards)
    return winner_index

  def find_winner(self, cards, category):
    winning_card = max(cards, key=lambda card: card[category])
    return cards.index(winning_card)

# Example usage
game = Game("Dinosaurs", 2)
winner_index = game.play_round(0, "frill_length")  # Player 1 plays first, category: frill_length
print(f"Player {winner_index + 1} wins the round!")
