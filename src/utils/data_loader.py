import json

def load_puzzle(path):

    with open(path) as f:
        return json.load(f)
