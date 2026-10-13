from flask import Flask, render_template, request, jsonify
import json
import os
import random

app = Flask(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "temtems.json")

with open(DATA_FILE, "r", encoding="utf-8") as f:
    TEMTEM_DATA = json.load(f)

TEMTEM_LOOKUP = {t["name"].lower(): t for t in TEMTEM_DATA}


# ---------- Phase 1 ----------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/search")
def search():
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify({"error": "Please enter a Temtem name."}), 400

    temtem = TEMTEM_LOOKUP.get(query)
    if not temtem:
        for name, data in TEMTEM_LOOKUP.items():
            if name.startswith(query):
                temtem = data
                break

    if not temtem:
        return jsonify({"error": f"No Temtem found for '{query}'."}), 404

    return jsonify(temtem)


# ---------- Phase 2: Autocomplete ----------
@app.route("/suggest")
def suggest():
    """Return up to 8 Temtem names matching the query prefix/substring."""
    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify([])

    # Prefix matches first, then substring matches
    prefix = [t["name"] for t in TEMTEM_DATA if t["name"].lower().startswith(query)]
    contains = [
        t["name"] for t in TEMTEM_DATA
        if query in t["name"].lower() and t["name"] not in prefix
    ]
    return jsonify((prefix + contains)[:8])


# ---------- Phase 2: Battle ----------
@app.route("/battle")
def battle():
    return render_template("battle.html")


@app.route("/all-temtems")
def all_temtems():
    """Return lightweight list for the battle page selectors."""
    return jsonify([
        {
            "name": t["name"],
            "number": t["number"],
            "image": t["image"],
            "hp": t["hp"],
            "type": list(t["type"].keys()),
        }
        for t in TEMTEM_DATA
    ])


@app.route("/random-teams")
def random_teams():
    """Return 6 unique random Temtems split into two teams of 3."""
    if len(TEMTEM_DATA) < 6:
        return jsonify({"error": "Not enough Temtems in the data file."}), 400

    picks = random.sample(TEMTEM_DATA, 6)
    slim = lambda t: {
        "name": t["name"],
        "number": t["number"],
        "image": t["image"],
        "hp": t["hp"],
        "type": list(t["type"].keys()),
    }
    return jsonify({
        "player1": [slim(t) for t in picks[:3]],
        "player2": [slim(t) for t in picks[3:]],
    })


if __name__ == "__main__":
    app.run(debug=True)
