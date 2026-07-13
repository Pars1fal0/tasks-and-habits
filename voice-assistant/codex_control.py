import logging
import time

from pywinauto import Desktop
from pywinauto.keyboard import send_keys


LOGGER = logging.getLogger("codex-voice")
def find_codex_window():
    candidates = []
    for window in Desktop(backend="uia").windows():
        try:
            if not window.is_visible():
                continue
            title = window.window_text().strip()
            if title in {"ChatGPT", "Codex"} or "Codex" in title:
                candidates.append((title in {"ChatGPT", "Codex"}, window.element_info.process_id, window))
        except Exception:
            continue
    if not candidates:
        raise RuntimeError("Окно Codex не найдено. Сначала открой приложение Codex.")
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][2]


def composer_point(window, bottom_offset=88):
    rectangle = window.rectangle()
    width = rectangle.width()
    height = rectangle.height()
    if width < 500 or height < 400:
        raise RuntimeError("Окно Codex слишком маленькое для безопасной отправки команды.")
    return width // 2, max(100, height - int(bottom_offset))


def literal_key_sequence(text):
    special = set("+^%~(){}")
    return "".join(f"{{{character}}}" if character in special else character for character in text)


def submit_prompt(text, bottom_offset=88):
    window = find_codex_window()
    if window.is_minimized():
        window.restore()
    window.set_focus()
    time.sleep(0.2)
    x, y = composer_point(window, bottom_offset)
    window.click_input(coords=(x, y))
    time.sleep(0.1)
    send_keys(literal_key_sequence(text), with_spaces=True, with_tabs=True, with_newlines=True, pause=0.001)
    time.sleep(0.15)
    send_keys("{ENTER}")
