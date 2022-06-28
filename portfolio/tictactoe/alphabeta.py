import math
from copy import deepcopy

X = "X"
O = "O"
EMPTY = None

def player(board):
    """
    Returns player who has the next turn on a board.
    """
    # Initialize counters for Xs and Os in board
    count = 0

    # Count Xs and Os
    for row in board:
        for element in row:
            if element == X:
                count += 1
            elif element == O:
                count -= 1
    # If there are less Xs or the same as Os it's X's turn
    return X if count == 0 else O


def actions(board):
    """
    Returns set of all possible actions (i, j) available on the board.
    """
    if terminal(board):
        return (0, 0)
    # Initialize set to store all possible moves
    moves = set()

    # Look at every coordinate. If a cell is empty add a touple (row, col) to moves
    for row in range(3):
        for col in range(3):
            if board[row][col] == EMPTY:
                moves.add((row, col))
    # Return the set of all possible moves
    return moves


def result(board, action):
    """
    Returns the board that results from making move (i, j) on the board.
    """
    # If action is not valid raise exception
    if action not in actions(board):
        raise Exception("Invalid action")
    
    # Make a copy of board because we don't want to change the original
    result_board = deepcopy(board)
    
    # Make the move/action and return new board
    result_board[action[0]][action[1]] = player(board)
    return result_board


def winner(board):
    """
    Returns the winner of the game, if there is one.
    """
    d1 = d2 = 0
    for i in range(3):
        h = v = 0

        cell_d1 = board[2-i][i]
        if cell_d1 == X:
            d1 += 1
        elif cell_d1 == O:
            d1 -= 1
        
        for j in range(3):
            # check rows
            cell_h = board[i][j]
            if cell_h == X:
                h += 1
            elif cell_h == O:
                h -= 1
            
            # check columns
            cell_v = board[j][i]
            if cell_v == X:
                v += 1
            elif cell_v == O:
                v -= 1
            
            # check diagonal (0,0), (2, 2) 
            if i == j:
                if cell_h == X:
                    d2 += 1
                elif cell_h == O:
                    d2 -= 1
            
            # check if 3
            if h == 3 or v == 3 or d1 == 3 or d2 == 3:
                return X
            if h == -3 or v == -3 or d1 == -3 or d2 == -3:
                return O
    return None


def terminal(board):
    """
    Returns True if game is over, False otherwise.
    """
    if not any(EMPTY in row for row in board) or winner(board) != None:
        return True
    return False


def utility(board):
    """
    Returns 1 if X has won the game, -1 if O has won, 0 otherwise.
    """
    if winner(board) == X:
        return 1
    elif winner(board) == O:
        return -1
    return 0

def minimax(board):
    """
    Returns the optimal action for the current player on the board.
    """
    if terminal(board):
        return None
    
    best = ()
    if player(board) == X:
        v = -math.inf
        for action in actions(board):
            new_max = max(v, min_value(result(board, action)))
            if new_max > v:
                v = new_max
                best = action
    else:
        v = math.inf
        for action in actions(board):
            new_min = min(v, max_value(result(board, action)))
            if new_min < v:
                v = new_min
                best = action
    return best


def max_value(board):
    if terminal(board):
        return utility(board)
    v = -math.inf
    for action in actions(board):
        v = max(v, min_value(result(board, action)))
    
    return v


def min_value(board):
    if terminal(board):
        return utility(board)
    v = math.inf
    for action in actions(board):
        v = min(v, max_value(result(board, action)))
    
    return v