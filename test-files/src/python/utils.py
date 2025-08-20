import subprocess

def save_tree(tree):
    with open("tree.txt", "r") as file:
        file.write(tree)


def save_tokens(tokens):
    with open("tokens.txt", "r") as file:
        file.write(tokens)


def exec_script(script, code):
    