try:
    from colorama import Fore, Style, init

    init(autoreset=True)
except ImportError:
    print("Peringatan: library 'colorama' tidak ditemukan. Output tidak akan berwarna.")

    class Fore:
        YELLOW = GREEN = MAGENTA = CYAN = BLUE = RED = WHITE = ""

    class Style:
        RESET_ALL = ""
