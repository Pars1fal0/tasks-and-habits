import atexit
import ctypes
from ctypes import wintypes
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import queue
import sys
import time
import winsound

import sounddevice as sd
from vosk import KaldiRecognizer, Model, SetLogLevel

from codex_control import submit_prompt


ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "model" / "vosk-model-small-ru-0.22"
CONFIG_PATH = ROOT / "config.json"
PID_PATH = ROOT / "assistant.pid"
LOG_PATH = ROOT / "assistant.log"
SAMPLE_RATE = 16_000
DEFAULT_SEND_PHRASES = ("отправь", "отправить", "отправляй")
DEFAULT_WAKE_PHRASES = (
    "кодекс работай",
    "кодекс работать",
    "кодекс слушай",
    "кодекса работай",
    "кодекса работать",
    "кодекс работа",
)
PHRASE_WORD_ALIASES = {
    "кодекса": "кодекс",
    "кодек": "кодекс",
}


def configure_logging():
    handler = RotatingFileHandler(LOG_PATH, maxBytes=512_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler])


def load_config():
    if not CONFIG_PATH.exists():
        raise RuntimeError("Не найден config.json. Запусти install.ps1.")
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    phrases = [normalize_phrase(value) for value in [*config.get("wake_phrases", []), *DEFAULT_WAKE_PHRASES]]
    config["wake_phrases"] = list(dict.fromkeys(value for value in phrases if value))
    configured_send_phrases = [
        config.get("send_phrase", "отправь"),
        *config.get("send_phrases", []),
        *DEFAULT_SEND_PHRASES,
        "отправь сообщение",
        "отправить сообщение",
    ]
    config["send_phrases"] = list(
        dict.fromkeys(normalize_phrase(value) for value in configured_send_phrases if normalize_phrase(value))
    )
    config["cancel_phrase"] = normalize_phrase(config.get("cancel_phrase", "отмена"))
    if not config["wake_phrases"]:
        raise RuntimeError("В config.json не указана ключевая фраза.")
    return config


def normalize_phrase(value):
    words = str(value or "").lower().replace("ё", "е").split()
    return " ".join(PHRASE_WORD_ALIASES.get(word, word) for word in words)


def create_recognizer(model, phrases):
    grammar = json.dumps([*phrases, "[unk]"], ensure_ascii=False)
    return KaldiRecognizer(model, SAMPLE_RATE, grammar)


def split_send_phrase(result, send_phrases):
    for phrase in sorted(send_phrases, key=len, reverse=True):
        if result == phrase:
            return "", True
        suffix = f" {phrase}"
        if result.endswith(suffix):
            return result[: -len(suffix)].strip(), True
    return result, False


def should_auto_send(command_parts, last_activity_at, now, delay_seconds):
    return bool(command_parts) and last_activity_at > 0 and now - last_activity_at >= delay_seconds


def beep(kind):
    sounds = {
        "awake": [(880, 90), (1175, 110)],
        "sent": [(1175, 80), (1568, 120)],
        "cancel": [(660, 100), (440, 130)],
        "error": [(330, 180), (260, 220)],
    }
    for frequency, duration in sounds[kind]:
        winsound.Beep(frequency, duration)


def acquire_single_instance():
    kernel32 = ctypes.windll.kernel32
    kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    kernel32.CreateMutexW.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    handle = kernel32.CreateMutexW(None, False, "Local\\CodexVoiceAssistant")
    if not handle:
        raise RuntimeError("Не удалось создать блокировку голосового помощника.")
    if kernel32.GetLastError() == 183:
        kernel32.CloseHandle(handle)
        raise RuntimeError("Голосовой помощник уже запущен.")
    PID_PATH.write_text(str(os.getpid()), encoding="ascii")

    def release():
        PID_PATH.unlink(missing_ok=True)
        kernel32.CloseHandle(handle)

    atexit.register(release)
    return handle


def run():
    configure_logging()
    logger = logging.getLogger("codex-voice")
    acquire_single_instance()
    config = load_config()
    if not MODEL_DIR.exists():
        raise RuntimeError("Не найдена модель Vosk. Запусти install.ps1.")

    SetLogLevel(-1)
    logger.info("Загрузка облегчённой русской модели Vosk")
    model = Model(str(MODEL_DIR))
    wake_recognizer = create_recognizer(model, config["wake_phrases"])
    command_recognizer = KaldiRecognizer(model, SAMPLE_RATE)
    audio_queue = queue.Queue(maxsize=12)
    mode = "wake"
    command_started_at = 0.0
    last_command_activity_at = 0.0
    command_parts = []
    live_partial = ""

    def audio_callback(data, frames, timing, status):
        if status:
            logger.warning("Состояние микрофона: %s", status)
        try:
            audio_queue.put_nowait(bytes(data))
        except queue.Full:
            try:
                audio_queue.get_nowait()
                audio_queue.put_nowait(bytes(data))
            except queue.Empty:
                pass

    def finish_command():
        nonlocal mode, last_command_activity_at, live_partial
        if live_partial:
            command_parts.append(live_partial)
        prompt = " ".join(command_parts).strip()
        if not prompt:
            logger.info("Пустая команда не отправлена")
            beep("error")
        else:
            logger.info("Отправка команды: %s", prompt)
            try:
                submit_prompt(prompt, config.get("composer_bottom_offset", 88))
                beep("sent")
            except Exception:
                logger.exception("Не удалось отправить команду")
                beep("error")
        mode = "wake"
        last_command_activity_at = 0.0
        live_partial = ""
        command_parts.clear()
        wake_recognizer.Reset()

    def clear_audio_queue():
        while True:
            try:
                audio_queue.get_nowait()
            except queue.Empty:
                return

    microphone = config.get("microphone")
    try:
        device_info = sd.query_devices(microphone, "input")
        logger.info("Микрофон: %s", device_info.get("name", microphone))
    except Exception:
        logger.warning("Не удалось получить сведения о выбранном микрофоне")
    logger.info("Помощник запущен. Фразы активации: %s", ", ".join(config["wake_phrases"]))
    with sd.RawInputStream(
        samplerate=SAMPLE_RATE,
        blocksize=4_000,
        device=microphone,
        dtype="int16",
        channels=1,
        callback=audio_callback,
    ):
        while True:
            chunk = audio_queue.get()
            now = time.monotonic()
            auto_send_enabled = config.get("auto_send_enabled", False) is True
            auto_send_seconds = max(0.8, float(config.get("auto_send_seconds", 2.0)))
            if auto_send_enabled and mode == "command" and should_auto_send(
                [*command_parts, live_partial],
                last_command_activity_at,
                now,
                auto_send_seconds,
            ):
                logger.info("Автоматическая отправка после паузы %.1f с", auto_send_seconds)
                finish_command()
                continue
            if mode == "command" and now - command_started_at > config.get("command_timeout_seconds", 90):
                logger.info("Ожидание команды завершено по тайм-ауту")
                mode = "wake"
                command_recognizer.Reset()
                command_parts.clear()
                live_partial = ""
                last_command_activity_at = 0.0
                beep("cancel")

            recognizer = wake_recognizer if mode == "wake" else command_recognizer
            accepted = recognizer.AcceptWaveform(chunk)
            if not accepted:
                if mode != "command":
                    continue
                partial = normalize_phrase(json.loads(command_recognizer.PartialResult()).get("partial", ""))
                if partial and partial != live_partial:
                    live_partial = partial
                    last_command_activity_at = now
                spoken_part, should_send = split_send_phrase(partial, config["send_phrases"])
                if not should_send:
                    continue
                live_partial = spoken_part
                finish_command()
                continue
            result = normalize_phrase(json.loads(recognizer.Result()).get("text", ""))
            if not result or result == "[unk]":
                continue

            if mode == "wake" and result in config["wake_phrases"]:
                logger.info("Распознана ключевая фраза: %s", result)
                beep("awake")
                mode = "command"
                command_started_at = now
                last_command_activity_at = 0.0
                command_parts.clear()
                live_partial = ""
                command_recognizer.Reset()
                clear_audio_queue()
            elif mode == "command":
                if result == config["cancel_phrase"]:
                    logger.info("Диктовка отменена")
                    beep("cancel")
                    mode = "wake"
                    command_parts.clear()
                    live_partial = ""
                    last_command_activity_at = 0.0
                    wake_recognizer.Reset()
                    continue

                spoken_part, should_send = split_send_phrase(result, config["send_phrases"])
                if spoken_part:
                    command_parts.append(spoken_part)
                    last_command_activity_at = now
                live_partial = ""
                if not should_send:
                    continue
                finish_command()

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        pass
    except Exception as error:
        configure_logging()
        logging.getLogger("codex-voice").exception("Помощник остановлен: %s", error)
        beep("error")
        if sys.stdout and sys.stdout.isatty():
            print(f"Ошибка: {error}")
            print(f"Подробности: {LOG_PATH}")
        raise
