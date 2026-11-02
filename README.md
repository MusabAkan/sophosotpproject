# Sophos OTP

### Your profiles, verification codes and Sophos connection in one place.

Sophos OTP is a local authenticator with a glass-style interface. Import a TOTP QR image or setup secret, save several named accounts, and switch between them without retyping your credentials. A selected profile loads its connection name, username, password and OTP settings; selecting a profile never starts a VPN connection.

**Angular 21 · PrimeNG 21 · NestJS · TypeScript · Electron · Embedded SQLite**

> An independent utility, not an official Sophos product. Sophos Connect is the currently supported VPN client. FortiClient integration is not included.

## Download and run

Customers do **not** need to install Node.js, npm or SQLite.

| Download | How to use it |
| --- | --- |
| Windows x64 EXE | Run the portable desktop application. |
| Windows x64 ZIP | Extract the complete folder. Run **Sophos OTP.exe**, or use **Sophos-OTP-CLI.cmd** from a terminal. Keep the executable and resources together. |
| Source code ZIP | Developer sources; this is not the runnable Windows package. |

Get the EXE or Windows ZIP from this repository's **Releases** page. If none has been published, a maintainer needs to build the first release. Packages are unsigned unless code signing is configured.

Sophos Connect must be installed and configured to use the VPN connection button or CLI command. Code generation and profile management work without a VPN client. Windows PowerShell, included with Windows, is used for account-bound encryption.

## What can it do?

| Feature | What it provides |
| --- | --- |
| Multiple named profiles | Keep work and personal accounts separate; select one to load it. |
| Edit or duplicate | Update an existing profile or save its details as a new profile. |
| Remember the selected profile | Restore the last selected account after reopening the app or browser. |
| Save credentials before OTP setup | A profile can be saved even when no OTP secret has been added yet. |
| Protect unfinished edits | Choose to save, discard or cancel before switching away from changes. |
| Delete one profile | Confirm deletion of the selected profile while preserving the others. |
| QR and manual setup | Import a QR image, Base32 secret or TOTP setup URI. |
| Sophos sign-in | Submit the saved username and current password + fresh OTP to Sophos Connect. |
| English CLI | List, select and delete profiles, print a code, or request a connection. |
| Five languages | Turkish is the default; English, German, French and Spanish are also available, with flags. |

## Working with profiles

1. Select **New profile** and enter a descriptive profile name.
2. Fill in the exact Sophos connection name, username and current password. Do not append an OTP to the stored password.
3. Add the OTP setup secret or QR image if available. You can also save the credentials now and configure OTP later.
4. Select **Save encrypted profile**. For an existing profile, use **Save changes**.
5. Choose an entry from **Saved profiles** to load it. **Save as a new profile** creates a separate copy.

Saving is explicit. The optional **Save changes when connecting** checkbox also saves the current form when you press Connect. Clearing the current session keeps saved profiles. Deleting a saved profile requires its own confirmation.

Connection names, usernames and passwords are hidden by default. Use the eye button beside each field to show or hide it independently. Switching profiles, clearing the session or reopening the app hides all three fields again. These buttons only change screen visibility; saved profiles always remain encrypted.

## One local encrypted store

The browser interface, packaged desktop app and CLI share the same SQLite file when run under the same Windows account:

    %APPDATA%\sophos-otp-project\profiles.sqlite

This fixes the earlier behavior where browser sessions could not save profiles. The local API now handles persistence in both modes; installing a separate database service is unnecessary.

Profile names, credentials and OTP secrets are encrypted with Windows DPAPI before they reach SQLite. There is no plaintext fallback when Windows encryption is unavailable. Encryption uses the current Windows account, not an app-specific master password. Other programs running as the same Windows user are outside this protection boundary. Copying the database alone is not a portable export to another account or computer.

Bcrypt is a one-way password hash used to verify passwords. This app needs to recover saved credentials for autofill and Sophos sign-in, so it uses reversible Windows account encryption instead. Usernames, connection names, passwords and OTP secrets are stored together in an encrypted payload; they are not plaintext database columns.

Existing single-profile databases are preserved and migrated by the desktop app. If a legacy profile cannot be decrypted, the original encrypted record is retained and the app displays an import notice. Open the updated desktop app once under the Windows account that created that record.

Developers and automated tests can set **SOPHOS_OTP_DATA_DIR** to an isolated data directory. All entry points must use the same directory to share profiles. Stored databases, build outputs and environment files are excluded from Git.

The local API binds to the loopback interface, checks request origins and hosts, and requires a per-process session token. Passwords and setup secrets are never sent to a cloud service. Sophos's own command-line utility receives password + OTP briefly as process arguments. Clearing the app does not clear the system clipboard.

## CLI

Extract the **Windows ZIP**, open a terminal in that folder, and run:

    .\Sophos-OTP-CLI.cmd help
    .\Sophos-OTP-CLI.cmd profiles
    .\Sophos-OTP-CLI.cmd use <profile-id>
    .\Sophos-OTP-CLI.cmd code
    .\Sophos-OTP-CLI.cmd code <profile-id>
    .\Sophos-OTP-CLI.cmd connect <profile-id>
    .\Sophos-OTP-CLI.cmd delete <profile-id>

The wrapper uses the runtime included with the app; it does not require a system Node.js installation. Replace **<profile-id>** with an ID printed by **profiles**. An asterisk marks the selected profile. **code** and **connect** use that profile when the ID is omitted. **delete** always requires an explicit ID.

Create and edit profiles in the interface. Passwords and OTP secrets are never CLI arguments or listing output. The **code** command intentionally prints the current one-time code. Connection requests are explicit and report submission; check the actual VPN status in Sophos Connect. A code near expiry is rejected, so retry after it refreshes.

## Development

Use Node.js 24 for development. From the repository root:

    npm ci
    npm run dev

The browser interface opens at http://127.0.0.1:4200 and the local API uses port 3000. After updating the project, restart the development command so both services load the latest code. The browser now supports encrypted persistence on Windows.

| Command | Purpose |
| --- | --- |
| npm test | OTP, API, profile migration/persistence, encryption-adapter and CLI tests. |
| npm run build | Compile the API and production interface. |
| npm run desktop:dev | Build and run the desktop app. |
| npm run cli -- profiles | Run the developer CLI. Build first for code/connect commands. |
| npm run test:electron | Run an isolated desktop smoke test with real Windows encryption. |
| npm run dist:win | Create the portable EXE and Windows ZIP in release/. |

## Project structure

| Directory | Responsibility |
| --- | --- |
| frontend/ | Angular/PrimeNG interface and five language dictionaries. |
| backend/ | Local API, TOTP generation and Sophos integration. |
| shared/ | Shared TypeScript contracts. |
| storage/ | Multi-profile SQLite store, Windows encryption and legacy migration. |
| desktop/ | Electron window, isolated preload and Windows CLI launcher. |
| cli/ | English terminal commands backed by the same profile store. |

Tests use synthetic accounts and a test encryption adapter; they never connect to a customer's VPN. They cover restart persistence, independent profiles, safe deletion, stale/concurrent edits, legacy import, sanitized errors, session protection and CLI behavior. The separate desktop smoke test exercises the real Windows encryption provider.

## Publishing

The Windows GitHub workflow runs tests, builds, runs the desktop smoke test and packages both Windows downloads. Artifacts are available from successful workflow runs. To publish a release, push a version tag matching package.json, for example v1.2.0. The workflow attaches the EXE and Windows ZIP only after its checks pass.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Profile list or saving fails after an update | Restart both development services and refresh the page. |
| Windows encryption is unavailable | Run under your own Windows session; constrained service/sandbox accounts may not have working DPAPI keys. Nothing is saved in plaintext. |
| Profile cannot be decrypted | Use the original Windows account and computer. Other profiles can still be opened. |
| Legacy import notice | Open the desktop app once under the original Windows account. |
| Profile changed in another window | Reload the profile before saving; the newer revision is protected. |
| CLI cannot find profiles | Use the same Windows account and SOPHOS_OTP_DATA_DIR setting as the app. |
| Codes differ from your phone | Check the device time, secret, algorithm, period and digits. |
| Sophos connection is not found | Enter its exact configured connection name. |

Windows x64 is the supported packaged target. This is a local utility, not a public web service.
