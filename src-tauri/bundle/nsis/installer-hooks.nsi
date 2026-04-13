!macro customInstall
    ; ── Add install dir to system PATH ──
    EnVar::SetHKLM
    EnVar::AddValue "PATH" "$INSTDIR"

    ; ── Register xNote as a program ──
    WriteRegStr HKCR "xNote" "" "xNote Text Editor"
    WriteRegStr HKCR "xNote\DefaultIcon" "" "$INSTDIR\xnote.exe,0"
    WriteRegStr HKCR "xNote\shell\open\command" "" '"$INSTDIR\xnote.exe" "%1"'

    ; ── File associations (Open With) ──
    WriteRegStr HKCR ".txt\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".md\OpenWithProgids"   "xNote" ""
    WriteRegStr HKCR ".json\OpenWithProgids" "xNote" ""
    WriteRegStr HKCR ".ts\OpenWithProgids"   "xNote" ""
    WriteRegStr HKCR ".js\OpenWithProgids"   "xNote" ""
    WriteRegStr HKCR ".rs\OpenWithProgids"   "xNote" ""
    WriteRegStr HKCR ".py\OpenWithProgids"   "xNote" ""
    WriteRegStr HKCR ".css\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".html\OpenWithProgids" "xNote" ""
    WriteRegStr HKCR ".yaml\OpenWithProgids" "xNote" ""
    WriteRegStr HKCR ".toml\OpenWithProgids" "xNote" ""
    WriteRegStr HKCR ".yml\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".xml\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".csv\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".sh\OpenWithProgids"   "xNote" ""
    WriteRegStr HKCR ".ini\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".log\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".cpp\OpenWithProgids"  "xNote" ""
    WriteRegStr HKCR ".c\OpenWithProgids"    "xNote" ""
    WriteRegStr HKCR ".h\OpenWithProgids"    "xNote" ""

    ; ── "Edit with xNote" context menu for ALL files ──
    WriteRegStr HKCR "*\shell\xNote" "" "Edit with xNote"
    WriteRegStr HKCR "*\shell\xNote" "Icon" "$INSTDIR\xnote.exe,0"
    WriteRegStr HKCR "*\shell\xNote\command" "" '"$INSTDIR\xnote.exe" "%1"'

    ; ── "Open folder in xNote" on folder background right-click ──
    WriteRegStr HKCR "Directory\Background\shell\xNote" "" "Open folder in xNote"
    WriteRegStr HKCR "Directory\Background\shell\xNote" "Icon" "$INSTDIR\xnote.exe,0"
    WriteRegStr HKCR "Directory\Background\shell\xNote\command" "" '"$INSTDIR\xnote.exe" "%V"'

    ; ── Refresh shell so changes appear immediately ──
    System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUninstall
    ; ── Remove from PATH ──
    EnVar::SetHKLM
    EnVar::DeleteValue "PATH" "$INSTDIR"

    ; ── Remove program registration ──
    DeleteRegKey HKCR "xNote"

    ; ── Remove file association entries ──
    DeleteRegValue HKCR ".txt\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".md\OpenWithProgids"   "xNote"
    DeleteRegValue HKCR ".json\OpenWithProgids" "xNote"
    DeleteRegValue HKCR ".ts\OpenWithProgids"   "xNote"
    DeleteRegValue HKCR ".js\OpenWithProgids"   "xNote"
    DeleteRegValue HKCR ".rs\OpenWithProgids"   "xNote"
    DeleteRegValue HKCR ".py\OpenWithProgids"   "xNote"
    DeleteRegValue HKCR ".css\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".html\OpenWithProgids" "xNote"
    DeleteRegValue HKCR ".yaml\OpenWithProgids" "xNote"
    DeleteRegValue HKCR ".toml\OpenWithProgids" "xNote"
    DeleteRegValue HKCR ".yml\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".xml\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".csv\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".sh\OpenWithProgids"   "xNote"
    DeleteRegValue HKCR ".ini\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".log\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".cpp\OpenWithProgids"  "xNote"
    DeleteRegValue HKCR ".c\OpenWithProgids"    "xNote"
    DeleteRegValue HKCR ".h\OpenWithProgids"    "xNote"

    ; ── Remove context menu entries ──
    DeleteRegKey HKCR "*\shell\xNote"
    DeleteRegKey HKCR "Directory\Background\shell\xNote"

    ; ── Refresh shell ──
    System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
