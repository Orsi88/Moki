; "Open in Moki" on a folder and on a folder's background in Explorer (issue #58). SHELL_CONTEXT = HKCU or HKLM,
; the install mode the user chose (nsis.perMachine is false, so both are offered). Windows 11 shows it under "Show more options".
!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\Moki" "" "Open in Moki"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\Moki" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\shell\Moki\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Moki" "" "Open in Moki"
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Moki" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Moki\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%V"'
!macroend
!macro customUnInstall
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\shell\Moki"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\Directory\Background\shell\Moki"
!macroend
