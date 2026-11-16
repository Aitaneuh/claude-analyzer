' Runs the Claude Analyzer sync with no console window (used by Task Scheduler).
' Tries the LAN server first, then the public URL. The token is read from
' %USERPROFILE%\.claude-analyzer-token. Output is appended to %USERPROFILE%\.claude-analyzer-sync.log
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
home = sh.ExpandEnvironmentStrings("%USERPROFILE%")
urls = "http://192.168.1.10:6969,https://claude.aitaneuh.com"
logFile = home & "\.claude-analyzer-sync.log"

' Find node.exe even when PATH is minimal (Task Scheduler context).
node = "node"
candidates = Array(sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
                   sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\nodejs\node.exe")
For Each c In candidates
  If fso.FileExists(c) Then node = """" & c & """" : Exit For
Next

cmd = "cmd /c """ & node & " """ & here & "\sync.mjs"" --url """ & urls & """ >> """ & logFile & """ 2>&1"""
code = sh.Run(cmd, 0, True)
If code <> 0 Then
  Set f = fso.OpenTextFile(logFile, 8, True)
  f.WriteLine "[" & Now & "] sync exited with code " & code
  f.Close
End If
