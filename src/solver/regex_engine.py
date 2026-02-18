import re

def check_regex(pattern, text):
    if "" in text:
        return re.match(pattern, text) is not None
    return re.fullmatch(pattern, text) is not None
