import re

def check_regex(pattern, text):

    return re.search(pattern, text) is not None
