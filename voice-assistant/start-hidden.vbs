Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
python = fso.BuildPath(root, ".venv\Scripts\pythonw.exe")
script = fso.BuildPath(root, "assistant.py")
CreateObject("WScript.Shell").Run Chr(34) & python & Chr(34) & " " & Chr(34) & script & Chr(34), 0, False
