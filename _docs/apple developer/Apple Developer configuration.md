See also:
- [[Configuring Electron app with Apple Developer credentials]]
- [[Automatic Apple Developer retrieval with Electron Forge]]

# Notarization
See also: [Official docs](https://developer.apple.com/documentation/Security/customizing-the-notarization-workflow)

To create notary credentials:

```bash
xcrun notarytool store-credentials "notarytool-credentials"
               --apple-id "<AppleID>"
               --team-id <DeveloperTeamID>
               --password <secret_2FA_password>
```
To check the status of the credentials:

```bash
xcrun notarytool history --keychain-profile "notarytool-credentials"
```
