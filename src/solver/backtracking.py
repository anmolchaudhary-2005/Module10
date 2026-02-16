from solver.regex_engine import check_regex

def solve(grid, puzzle, row=0, col=0):

    size = puzzle["size"]

    if row == size:
        return True

    next_row = row + (col+1)//size
    next_col = (col+1)%size

    for letter in puzzle["alphabet"]:

        grid[row][col] = letter

        row_string = "".join(grid[row])
        col_string = "".join([grid[r][col] for r in range(size)])

        if check_regex(puzzle["row_regex"][row], row_string):

            if check_regex(puzzle["col_regex"][col], col_string):

                if solve(grid, puzzle, next_row, next_col):
                    return True

    grid[row][col] = ""

    return False
