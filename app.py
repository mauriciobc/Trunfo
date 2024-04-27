from flask import Flask, render_template, request
from game import Game

app = Flask(__name__)

@app.route("/")
def list_lobbies():
  # Simulate lobbies (replace with actual lobby management)
  lobbies = ["Dinosaurs (2/4 players)", "Mythical Creatures (1/4 players)"]
  return render_template("lobbies.html", lobbies=lobbies)

@app.route("/game/<game_name>")
def join_game(game_name):
  # Simulate game join (replace with actual game logic)
  if game_name == "dinosaurs":
    game = Game(game_name, 2)  # Pre-defined number of players for simplicity
    return render_template("game.html", game=game)
  else:
    return "Game not found."

if __name__ == "__main__":
  app.run(debug=True)
