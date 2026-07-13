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


def find_codex_window():
    candidates = []

    def collect(handle, _):
        if not win32gui.IsWindowVisible(handle):
            return
        title = win32gui.GetWindowText(handle).strip()
        if title in {"ChatGPT", "Codex"} or "Codex" in title:
            candidates.append((title in {"ChatGPT", "Codex"}, handle, title))

    win32gui.EnumWindows(collect, None)
    if not candidates:
        raise RuntimeError("Окно Codex не найдено. Сначала открой приложение Codex.")
    candidates.sort(reverse=True)
    _, handle, title = candidates[0]
    LOGGER.info("Найдено окно Codex: %s (handle=%s)", title, handle)
    return handle


def composer_point(handle, bottom_offset=88):
    left, top, right, bottom = win32gui.GetWindowRect(handle)
    width = right - left
    height = bottom - top
    if width < 500 or height < 400:
        raise RuntimeError("Окно Codex слишком маленькое для безопасной отправки команды.")
    return left + width // 2, bottom - int(bottom_offset)


def activate_window(handle):
    if win32gui.IsIconic(handle):
        win32gui.ShowWindow(handle, win32con.SW_RESTORE)
    else:
        win32gui.ShowWindow(handle, win32con.SW_SHOW)
    try:
        win32gui.SetForegroundWindow(handle)
    except Exception:
        win32api.keybd_event(win32con.VK_MENU, 0, 0, 0)
        try:
            win32gui.SetForegroundWindow(handle)
        finally:
            win32api.keybd_event(win32con.VK_MENU, 0, win32con.KEYEVENTF_KEYUP, 0)
    win32gui.BringWindowToTop(handle)


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
    time.sleep(0.25)
    click_point(*composer_point(handle, bottom_offset))
    time.sleep(0.15)
    send_unicode_text(text)
    time.sleep(0.2)
    press_enter()
