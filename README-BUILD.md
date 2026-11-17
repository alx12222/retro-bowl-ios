# Retro Bowl Modded — one-click iOS IPA build

Build an iOS `.ipa` of the modded game from Windows. The actual Xcode work
runs on a free GitHub-hosted macOS runner — your PC never needs Xcode.

## Prereqs (one time)

1. **Git**: `winget install -e --id Git.Git`
2. **GitHub CLI**: `winget install -e --id GitHub.cli`
3. Log in: `gh auth login` (choose GitHub.com, HTTPS, authenticate via browser)

## Build

Double-click **`build-on-windows.bat`**. It will:

1. Initialize a git repo in this folder if one doesn't already exist.
2. Create a private GitHub repo `retro-bowl-ios` under your account (or link
   to it if it already exists) and push the current contents.
3. Trigger the **Build iOS IPA** workflow on GitHub Actions.
4. Stream the build log in the terminal (~12 min first run).
5. Download the IPA to `dist\RetroBowlModded.ipa`.

Run it again anytime after you change files — it will commit, push, rebuild,
and overwrite `dist\RetroBowlModded.ipa`.

## Installing the unsigned IPA on iPhone

The IPA is unsigned (no Apple Developer account involved). Pair it with one
of these at install time:

- **AltStore / SideStore** — free Apple ID, re-sign every 7 days
- **Sideloadly** — desktop tool, same free-ID flow
- **TrollStore** — permanent installs on compatible iOS versions
- **Xcode on a Mac** — if you ever get a $99/yr dev account

## Project layout

```
.
├── www/                    ← the modded Retro Bowl (WebView content)
│   ├── index.html
│   ├── mod-menu.js
│   └── html5game/
├── package.json            ← Capacitor deps
├── capacitor.config.json   ← app ID / webDir / iOS options
├── .github/workflows/
│   └── build-ios.yml       ← macOS build pipeline
├── build-on-windows.bat    ← one-click Windows trigger
├── .gitignore
└── README-BUILD.md
```

The `ios/` native project is regenerated fresh on every CI run via
`npx cap add ios`, so nothing native is committed.

## Legal

Retro Bowl is © New Star Games. This wrapper is for private use on your own
device only — do not distribute the resulting IPA.
