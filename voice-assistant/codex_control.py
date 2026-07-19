import ctypes
from ctypes import wintypes
import logging
import time

import win32api
import win32con
import win32gui


LOGGER = logging.getLogger("codex-voice")
KEYEVENTF_UNICODE = 0x0004
INPUT_KEYBOARD = 1
DWMWA_CLOAKED = 14
MIN_WINDOW_WIDTH = 500
MIN_WINDOW_HEIGHT = 400


class KeyboardInput(ctypes.Structure):
    _fields_ = [
        ("virtual_key", wintypes.WORD),
        ("scan_code", wintypes.WORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("extra_info", wintypes.WPARAM),
    ]


class MouseInput(ctypes.Structure):
    _fields_ = [
        ("x", wintypes.LONG),
        ("y", wintypes.LONG),
        ("mouse_data", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("extra_info", wintypes.WPARAM),
    ]


class HardwareInput(ctypes.Structure):
    _fields_ = [
        ("message", wintypes.DWORD),
        ("parameter_low", wintypes.WORD),
        ("parameter_high", wintypes.WORD),
    ]


class InputUnion(ctypes.Union):
    _fields_ = [("keyboard", KeyboardInput), ("mouse", MouseInput), ("hardware", HardwareInput)]


class Input(ctypes.Structure):
    _anonymous_ = ("data",)
    _fields_ = [("type", wintypes.DWORD), ("data", InputUnion)]


def is_cloaked_window(handle):
    cloaked = wintypes.DWORD()
    try:
        result = ctypes.windll.dwmapi.DwmGetWindowAttribute(
            handle,
            DWMWA_CLOAKED,
            ctypes.byref(cloaked),
            ctypes.sizeof(cloaked),
        )
    except (AttributeError, OSError):
        return False
    return result == 0 and bool(cloaked.value)


def window_size(handle):
    left, top, right, bottom = win32gui.GetWindowRect(handle)
    return max(0, right - left), max(0, bottom - top)


def candidate_score(handle, title):
    width, height = window_size(handle)
    usable = width >= MIN_WINDOW_WIDTH and height >= MIN_WINDOW_HEIGHT
    exact_title = title in {"ChatGPT", "Codex"}
    foreground = handle == win32gui.GetForegroundWindow()
    return usable, foreground, width * height, exact_title


def find_codex_window():
    candidates = []

    def collect(handle, _):
        if not win32gui.IsWindowVisible(handle) or is_cloaked_window(handle):
            return
        title = win32gui.GetWindowText(handle).strip()
        if title in {"ChatGPT", "Codex"} or "Codex" in title:
            candidates.append((candidate_score(handle, title), handle, title))

    win32gui.EnumWindows(collect, None)
    if not candidates:
        raise RuntimeError("Окно Codex не найдено. Сначала открой приложение Codex.")
    candidates.sort(key=lambda candidate: candidate[0], reverse=True)
    score, handle, title = candidates[0]
    width, height = window_size(handle)
    LOGGER.info(
        "Выбрано окно Codex: %s (handle=%s, size=%sx%s, usable=%s)",
        title,
        handle,
        width,
        height,
        score[0],
    )
    return handle


def composer_point(handle, bottom_offset=88):
    client_left, client_top, client_right, client_bottom = win32gui.GetClientRect(handle)
    left, top = win32gui.ClientToScreen(handle, (client_left, client_top))
    right, bottom = win32gui.ClientToScreen(handle, (client_right, client_bottom))
    width = right - left
    height = bottom - top
    if width < MIN_WINDOW_WIDTH or height < MIN_WINDOW_HEIGHT:
        raise RuntimeError("Окно Codex слишком маленькое для безопасной отправки команды.")
    return left + width // 2, bottom - int(bottom_offset)


def wait_until_usable(handle, timeout_seconds=3.0):
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        width, height = window_size(handle)
        client_left, client_top, client_right, client_bottom = win32gui.GetClientRect(handle)
        client_width = client_right - client_left
        client_height = client_bottom - client_top
        if (
            width >= MIN_WINDOW_WIDTH
            and height >= MIN_WINDOW_HEIGHT
            and client_width >= MIN_WINDOW_WIDTH
            and client_height >= MIN_WINDOW_HEIGHT
        ):
            return
        time.sleep(0.05)
    width, height = window_size(handle)
    raise RuntimeError(f"Окно Codex не удалось развернуть для ввода команды ({width}x{height}).")


def activate_window(handle):
    if win32gui.IsIconic(handle):
        win32gui.ShowWindow(handle, win32con.SW_RESTORE)
    else:
        win32gui.ShowWindow(handle, win32con.SW_SHOW)
    width, height = window_size(handle)
    if width < MIN_WINDOW_WIDTH or height < MIN_WINDOW_HEIGHT:
        win32gui.ShowWindow(handle, win32con.SW_MAXIMIZE)
        wait_until_usable(handle)
    try:
        win32gui.SetForegroundWindow(handle)
    except Exception:
        win32api.keybd_event(win32con.VK_MENU, 0, 0, 0)
        try:
            win32gui.SetForegroundWindow(handle)
        finally:
            win32api.keybd_event(win32con.VK_MENU, 0, win32con.KEYEVENTF_KEYUP, 0)
    win32gui.BringWindowToTop(handle)


def wait_until_active(handle, timeout_seconds=2.0):
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if win32gui.GetForegroundWindow() == handle:
            return
        time.sleep(0.05)
    raise RuntimeError("Не удалось активировать основное окно Codex.")


def click_point(x, y):
    previous = win32api.GetCursorPos()
    try:
        win32api.SetCursorPos((x, y))
        win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
        win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
    finally:
        win32api.SetCursorPos(previous)


def send_unicode_text(text):
    encoded = text.encode("utf-16-le")
    code_units = [int.from_bytes(encoded[index : index + 2], "little") for index in range(0, len(encoded), 2)]
    inputs = []
    for code_unit in code_units:
        inputs.append(Input(type=INPUT_KEYBOARD, keyboard=KeyboardInput(0, code_unit, KEYEVENTF_UNICODE, 0, 0)))
        inputs.append(
            Input(
                type=INPUT_KEYBOARD,
                keyboard=KeyboardInput(0, code_unit, KEYEVENTF_UNICODE | win32con.KEYEVENTF_KEYUP, 0, 0),
            ),
        )
    if not inputs:
        return
    input_array = (Input * len(inputs))(*inputs)
    sent = ctypes.windll.user32.SendInput(len(input_array), input_array, ctypes.sizeof(Input))
    if sent != len(input_array):
        error_code = ctypes.windll.kernel32.GetLastError()
        raise RuntimeError(f"Windows приняла только {sent} из {len(input_array)} событий ввода (ошибка {error_code}).")


def press_enter():
    win32api.keybd_event(win32con.VK_RETURN, 0, 0, 0)
    win32api.keybd_event(win32con.VK_RETURN, 0, win32con.KEYEVENTF_KEYUP, 0)


def submit_prompt(text, bottom_offset=88):
    handle = find_codex_window()
    activate_window(handle)
    wait_until_active(handle)
    wait_until_usable(handle)
    click_point(*composer_point(handle, bottom_offset))
    time.sleep(0.15)
    if win32gui.GetForegroundWindow() != handle:
        raise RuntimeError("Окно Codex потеряло фокус перед вводом команды.")
    send_unicode_text(text)
    time.sleep(0.2)
    press_enter()
