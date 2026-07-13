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


def configure_logging():
    handler = RotatingFileHandler(LOG_PATH, maxBytes=512_000, backupCount=2, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler])


def load_config():
    if not CONFIG_PATH.exists():
        raise RuntimeError("Не найден config.json. Запусти install.ps1.")
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    phrases = [normalize_phrase(value) for value in config.get("wake_phrases", [])]
    config["wake_phrases"] = [value for value in phrases if value]
    config["send_phrase"] = normalize_phrase(config.get("send_phrase", "отправь"))
    config["cancel_phrase"] = normalize_phrase(config.get("cancel_phrase", "отмена"))
    if not config["wake_phrases"]:
        raise RuntimeError("В config.json не указана ключевая фраза.")
    return config


def normalize_phrase(value):
    return " ".join(str(value or "").lower().replace("ё", "е").split())


def create_recognizer(model, phrases):
    grammar = json.dumps([*phrases, "[unk]"], ensure_ascii=False)
    return KaldiRecognizer(model, SAMPLE_RATE, grammar)


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
    command_parts = []

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

    microphone = config.get("microphone")
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
            if mode == "command" and now - command_started_at > config.get("command_timeout_seconds", 90):
                logger.info("Ожидание команды завершено по тайм-ауту")
                mode = "wake"
                command_recognizer.Reset()
                command_parts.clear()
                beep("cancel")

            recognizer = wake_recognizer if mode == "wake" else command_recognizer
            if not recognizer.AcceptWaveform(chunk):
                continue
            result = normalize_phrase(json.loads(recognizer.Result()).get("text", ""))
            if not result or result == "[unk]":
                continue

            if mode == "wake" and result in config["wake_phrases"]:
                logger.info("Распознана ключевая фраза: %s", result)
                beep("awake")
                mode = "command"
                command_started_at = now
                command_parts.clear()
                command_recognizer.Reset()
            elif mode == "command":
                if result == config["cancel_phrase"]:
                    logger.info("Диктовка отменена")
                    beep("cancel")
                    mode = "wake"
                    command_parts.clear()
                    wake_recognizer.Reset()
                    continue

                should_send = result == config["send_phrase"] or result.endswith(f" {config['send_phrase']}")
                spoken_part = result[: -len(config["send_phrase"])].strip() if should_send else result
                if spoken_part:
                    command_parts.append(spoken_part)
                if not should_send:
                    continue

                prompt = " ".join(command_parts).strip()
                if not prompt:
                    logger.info("Пустая команда не отправлена")
                    beep("error")
                    mode = "wake"
                    wake_recognizer.Reset()
                    continue
                logger.info("Отправка команды: %s", prompt)
                try:
                    submit_prompt(prompt, config.get("composer_bottom_offset", 88))
                    beep("sent")
                except Exception:
                    logger.exception("Не удалось отправить команду")
                    beep("error")
                finally:
                    mode = "wake"
                    command_parts.clear()
                    wake_recognizer.Reset()

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
