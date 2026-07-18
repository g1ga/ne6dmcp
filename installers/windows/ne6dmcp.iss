; Inno Setup script for NE6DMCP — per-user install, bundles a portable Node
; runtime + the app, and configures Claude Desktop on install / cleans it on
; uninstall. Compiled in CI with:
;   iscc /DNS4Version=x.y.z /DBundleDir=<path-to-bundle> installers\windows\ne6dmcp.iss
; The installer is UNSIGNED — users click through SmartScreen ("More info" ->
; "Run anyway"). This is documented in the README.

#ifndef NS4Version
  #define NS4Version "0.0.0"
#endif
#ifndef BundleDir
  #define BundleDir "..\..\dist-bundle\windows-x64"
#endif

[Setup]
AppId={{B7E3F1A2-9C4D-4E6B-8A1F-2D5C7E9F0A33}
AppName=NE6DMCP — Nord Electro 6D for Claude
AppVersion={#NS4Version}
AppPublisher=Gabriele Bulfon
AppSupportURL=https://github.com/gbulfon/ne6dmcp
DefaultDirName={localappdata}\Programs\NE6DMCP
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
OutputDir=.
OutputBaseFilename=NE6DMCP-{#NS4Version}-windows-x64-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=NE6DMCP — Nord Electro 6D for Claude
UninstallDisplayIcon={app}\runtime\node.exe

[Messages]
WelcomeLabel2=This installs the NE6DMCP server (a portable Node runtime + the app) and adds it to your Claude Desktop configuration.%n%nAfter installing, quit and reopen Claude Desktop. Remember to enable NRPN on the Nord (MIDI menu, page 7).

[Files]
Source: "{#BundleDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Run]
; Configure Claude Desktop for the installing user.
Filename: "{app}\runtime\node.exe"; \
  Parameters: """{app}\configure-claude.mjs"" --install --install-dir ""{app}"""; \
  StatusMsg: "Configuring Claude Desktop..."; Flags: runhidden waituntilterminated

[UninstallRun]
; Remove our entry from the Claude Desktop config on uninstall.
Filename: "{app}\runtime\node.exe"; \
  Parameters: """{app}\configure-claude.mjs"" --uninstall"; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveClaudeConfig"
