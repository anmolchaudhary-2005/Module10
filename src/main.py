from utils.data_loader import load_puzzle
from solver.grid import empty_grid
from solver.backtracking import solve

puzzle = load_puzzle("data/puzzle.json")

grid = empty_grid(puzzle["size"])

solve(grid, puzzle)

print("Solution:")
for row in grid:
    print(row)
