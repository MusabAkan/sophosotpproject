# Sophos OTP

### Your verification code and Sophos connection, ready on your desktop.

Sophos OTP generates time-based verification codes on your computer. Add your account with a QR image or Base32 secret, then copy a code or send your username and **current password + OTP** to Sophos Connect.

The Windows application includes its own runtime and embedded SQLite database. **Customers do not need to install Node.js, npm or SQLite.**

**Angular 21 · PrimeNG 21 · NestJS · TypeScript · Electron · Embedded SQLite**

> An independent utility, not an official Sophos product.

## Download and run

1. Open this repository's **Releases** page.
2. Download the `Sophos-OTP-<version>-Windows-x64.exe` asset from a published release.
3. Run it on Windows. No database setup or terminal commands are needed.

GitHub's **Source code** ZIP contains developer sources, not the executable. If no executable has been published yet, a maintainer must build or publish the first release using the steps below. Builds are unsigned unless a maintainer configures code signing.

Sophos Connect must already be installed and configured for the VPN connection feature. Code generation and copying work without Sophos Connect.

## What can it do?

| Feature | Benefit |
| --- | --- |
| QR or manual setup | Import a QR screenshot, Base32 secret or `otpauth://totp/` address. |
| Live code and countdown | See the current code and remaining validity. |
| Copy actions | Copy a code, username or password combined with OTP. |
| Sophos Connect integration | Submit a connection request using the installed CLI. |
| Encrypted local profile | Remember OTP settings, language, connection name and credentials. |
| Restore on next launch | Avoid entering the same details repeatedly. VPN sign-in still requires a click. |
| Multiple languages | Turkish by default, plus English, German, French and Spanish, with flag icons. |
| Glass-style interface | A dark interface with translucent panels. |

## First-time setup

### 1. Add your OTP account

Choose your Sophos portal's QR image or enter the **OTP setup secret**. This field is not your account password.

For manual setup, match your account's algorithm, code length and period. A TOTP QR address supplies these settings automatically. Supported options: SHA1, SHA256 and SHA512; 6 or 8 digits; a 10–300 second period.

Select **Generate code** and compare the first code with your current authenticator. Keep your device clock synchronized.

### 2. Enter connection details

Type the connection name yourself, then enter your username and **current password without an OTP**. Names are not automatically listed; only a profile that you explicitly save can be restored.

For VPN profiles expecting an OTP appended to the password, **Connect to Sophos** adds a fresh code and submits the combined value. Check the actual VPN status in Sophos Connect. A submitted request does not mean the VPN has connected.

SSO and profiles with a separate OTP field may need a different sign-in method. The application does not disconnect an existing VPN or sign in automatically.

### 3. Save once, restore next time

Keep **Remember on this device** enabled and select **Save encrypted profile** after entering your details. With remembering enabled, generating a code and requesting a connection also save the current profile.

On the next launch under the same Windows account, saved settings and credentials are restored.

- **Clear session** clears the current screen and memory references, keeping the saved profile.
- **Delete saved profile** removes the stored profile and clears the current session.
- Disabling **Remember on this device** stops automatic saves; use **Delete saved profile** to remove an existing record.

Regular browser development sessions are temporary. Encrypted persistence is available in the desktop application.

## Local storage and privacy

SQLite is part of the bundled runtime. An application-specific `profiles.sqlite` file is created in the current user's application-data directory, outside the executable folder and source repository.

The entire saved profile is encrypted with Electron's Windows OS encryption provider before it is written to SQLite. If encryption is unavailable, saving fails instead of using plaintext. Saved credentials are tied to the Windows account that encrypted them.

QR images are read in the UI and are not stored. OTP generation is local. The packaged API listens only on loopback, uses a dynamic port and requires a per-launch session token. There is no cloud synchronization.

Important boundaries:

- Windows account encryption does not protect against malicious software running as that same user.
- Sophos CLI temporarily receives password + OTP as process arguments.
- Copying places sensitive values on the system clipboard. Clearing a session does not clear it.
- Clearing memory references is not guaranteed physical erasure. Deleting a profile does not remove filesystem backups.

Follow your organization's OTP policy. Never commit actual QR codes, secrets, credentials, connection addresses or private screenshots.

## For developers

Only developers need **Node.js 24 LTS** and npm.

```sh
npm ci
node node_modules/electron/install.js
npm test
npm run desktop:dev
```

Run commands from the repository root; this project uses npm workspaces.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Browser development UI at http://127.0.0.1:4200 and local backend. |
| `npm run build` | Build the Angular UI and NestJS API. |
| `npm test` | Run OTP, CLI, API, translation and SQLite tests. |
| `npm run test:electron` | Test the built desktop UI and real Windows encryption in a temporary profile. |
| `npm run desktop:dev` | Build and open the desktop application. |
| `npm run dist:win` | Build a standalone Windows x64 executable in `release/`. |

Windows developers can use `START-DEV.cmd` for browser development. Backend source changes require restarting the development command.

### Project structure

| Folder | Responsibility |
| --- | --- |
| `frontend/` | Angular + PrimeNG UI and language dictionaries. |
| `backend/` | NestJS API, TOTP calculation and Sophos CLI integration. |
| `shared/` | Shared TypeScript contracts. |
| `desktop/` | Electron shell, restricted IPC and encrypted SQLite vault. |
| `.github/workflows/` | Windows testing, packaging and tagged releases. |

The desktop renderer uses context isolation, a sandbox and disabled Node integration. Profile operations are restricted to the application's own main frame.

### Tests

Coverage includes RFC 6238 vectors, invalid inputs, expiry boundaries, CLI argument handling without a shell, concurrent requests, sanitized errors, API token/origin/host checks, complete translations, encrypted storage, restart restoration, deletion and encryption failures.

Unit tests use synthetic credentials and a test encryption adapter. The Electron smoke test uses a separate temporary profile and the real Windows encryption provider. Tests do not connect to a customer's VPN.

## Publishing a runnable GitHub release

The Windows workflow runs tests and creates an executable for pushes and pull requests. Download it from the workflow's **Artifacts** section.

To publish a release, a maintainer pushes a version tag matching `package.json`:

```sh
git tag v1.1.1
git push origin v1.1.1
```

After tests, the production build and the desktop smoke test pass, the workflow attaches the executable to that GitHub release. Customers download the executable, not the source ZIP.

Generated packages, local databases and environment files are excluded from source control.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Codes differ from the phone | System time, setup secret, algorithm, period and digits. |
| Sophos CLI is unavailable | Standard Windows installation and the Sophos Connect service. |
| Connection is not found | Exact connection name in Sophos Connect. |
| Saved profile cannot be decrypted | Use the original Windows account or delete and recreate the profile. |
| Settings are not restored in a browser | Use the desktop application for encrypted persistence. |

This is a local desktop utility, not a public web service. Windows x64 is the configured release target.
