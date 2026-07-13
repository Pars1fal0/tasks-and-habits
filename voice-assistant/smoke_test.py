import tkinter as tk
import traceback

try:
    import win32gui
except ModuleNotFoundError as error:
    raise SystemExit("Voice assistant dependencies are missing. Run install.ps1, then use .venv\\Scripts\\python.exe smoke_test.py.") from error

from codex_control import activate_window, click_point, press_enter, send_unicode_text


EXPECTED = "Проверка Юникода: цель +15%"


def main():
    errors = []
    root = tk.Tk()
    root.title("Voice Assistant Input Test")
    root.geometry("640x180+100+100")
    entry = tk.Entry(root, font=("Segoe UI", 14))
    entry.pack(fill="x", padx=20, pady=50)
    entry.bind("<Return>", lambda _event: root.title(f"RESULT:{entry.get()}"))

    def report_error(error_type, error, error_traceback):
        errors.append(error)
        traceback.print_exception(error_type, error, error_traceback)
        root.destroy()

    root.report_callback_exception = report_error

    def run_test():
        handle = win32gui.FindWindow(None, "Voice Assistant Input Test")
        activate_window(handle)
        entry.update_idletasks()
        click_point(entry.winfo_rootx() + entry.winfo_width() // 2, entry.winfo_rooty() + entry.winfo_height() // 2)
        send_unicode_text(EXPECTED)
        press_enter()
        root.after(300, finish)

    def finish():
        actual = root.title().removeprefix("RESULT:")
        root.destroy()
        if actual != EXPECTED:
            errors.append(RuntimeError(f"Unicode input mismatch: {actual!r}"))
        else:
            print("voice assistant Win32 input smoke test passed")

    root.after(300, run_test)
    root.after(5_000, lambda: report_error(TimeoutError, TimeoutError("Input smoke test timed out"), None))
    root.mainloop()
    if errors:
        raise errors[0]


if __name__ == "__main__":
    main()
