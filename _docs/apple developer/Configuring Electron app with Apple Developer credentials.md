---
link: https://www.perplexity.ai/search/i-want-to-publish-developer-bu-cqtFZpQcQgWG4Dxh0L3qLg
---

# Developer ID Certificate for Electron macOS App Publishing

For publishing Electron app developer builds to GitHub releases on macOS, you'll need to create a **Developer ID Application certificate** first. This is the correct certificate type for distributing apps outside the Mac App Store[1](https://aso.dev/app-store-connect/developer-certificates/)[2](https://developer.apple.com/help/account/certificates/certificates-overview).

## Certificate Type You Need

**Developer ID Application certificate** is specifically used for signing Mac apps that are distributed outside the Mac App Store, which is exactly what you need for GitHub releases[1](https://aso.dev/app-store-connect/developer-certificates/)[2](https://developer.apple.com/help/account/certificates/certificates-overview)[3](https://www.electron.build/code-signing-mac.html). This is different from Mac App Store certificates or development certificates.

## Step-by-Step Process

## 1. Install Xcode (Required)

First, download and install Xcode from the App Store, as it's required for code signing and notarization[4](https://electronjs.org/docs/latest/tutorial/code-signing)[5](https://www.electronforge.io/guides/code-signing/code-signing-macos).

## 2. Create the Certificate Using Xcode (Easiest Method)

The simplest approach is to create the certificate directly through Xcode[6](https://gist.github.com/tony-go/d564023a9b7f270316fc8f1ebb0425a3)[7](https://github.com/omkarcloud/macos-code-signing-example):

1. Open Xcode
    
2. Go to **Xcode → Settings → Accounts**
    
3. Add your Apple ID if not already added
    
4. Select your team and click **"Manage Certificates..."**
    
5. Click the **"+"** button
    
6. Select **"Developer ID Application"** from the dropdown
    
7. The certificate will be automatically created and installed in your Keychain
    

## 3. Alternative Method: Apple Developer Portal

If you prefer to create it through the Developer Portal[8](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)[9](https://iosdevcenters.blogspot.com/2016/06/create-developer-id-certificate-apple.html):

1. **Create a Certificate Signing Request (CSR)**:
    
    - Open **Keychain Access** (`/Applications/Utilities/Keychain Access.app`)
        
    - Select **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**
        
    - Enter your email address and a name for the key (e.g., "Your Name Dev Key")
        
    - Leave CA Email Address blank
        
    - Choose **"Saved to disk"**
        
    - Click **Continue** and save the `.certSigningRequest` file[10](https://www.ssl.com/how-to/csr-generation-in-macos-keychain-access/)[11](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/)
        
2. **Create the Certificate**:
    
    - Visit the [Apple Developer Portal](https://developer.apple.com/)
        
    - Go to **Certificates, Identifiers & Profiles**
        
    - Click the **"+"** button to create a new certificate
        
    - Under **Software**, select **Developer ID Application**[8](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
        
    - Upload your CSR file
        
    - Download the certificate (`.cer` file)
        
    - Double-click to install it in your Keychain
        

## 4. Verify Certificate Installation

Check that your certificate is properly installed by running this command in Terminal[5](https://www.electronforge.io/guides/code-signing/code-signing-macos):

bash

`security find-identity -p codesigning -v`

You should see your Developer ID Application certificate listed.

## Next Steps for Electron App Publishing

## 1. Code Signing Configuration

For Electron apps using `electron-builder`, the certificate will be automatically detected if properly installed in your Keychain[12](https://nocommandline.com/blog/how-to-sign-an-electron-app-on-mac-with-electron-builder/)[3](https://www.electron.build/code-signing-mac.html). Configure your `package.json`:

json

`{   "build": {    "mac": {      "hardenedRuntime": true,      "entitlements": "build/entitlements.mac.plist"    }  } }`

## 2. Notarization Setup

Since macOS Catalina, apps must also be notarized[5](https://www.electronforge.io/guides/code-signing/code-signing-macos)[13](https://paultreanor.com/notarize-mac-app). You'll need to:

1. **Create an App-Specific Password**:
    
    - Visit [appleid.apple.com](https://appleid.apple.com/)
        
    - Go to **Security → Generate Passwords**
        
    - Create a password labeled "Notarization" or similar[14](http://learn.appdocumentation.com/en/articles/1651188-how-to-set-up-your-app-specific-password)[15](https://technotes.omnis.net/Technical%20Notes/Deployment/macOS%20notarization/1.Preparing%20notarization%20profile.html)
        
2. **Set up entitlements** file (`build/entitlements.mac.plist`)[16](https://samuelmeuli.com/blog/2019-12-28-notarizing-your-electron-app/):
    

xml

`<?xml version="1.0" encoding="UTF-8"?> <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"> <plist version="1.0"> <dict>     <key>com.apple.security.cs.allow-jit</key>    <true/>    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>    <true/> </dict> </plist>`

## 3. Environment Variables for Notarization

Set these environment variables for automated notarization[13](https://paultreanor.com/notarize-mac-app)[16](https://samuelmeuli.com/blog/2019-12-28-notarizing-your-electron-app/):

bash

`export APPLE_ID="your@email.com" export APPLE_ID_PASSWORD="your-app-specific-password" export APPLE_TEAM_ID="your-team-id"`

## 4. GitHub Actions Integration

For automated publishing to GitHub releases, you can set up GitHub Actions with your signing credentials stored as repository secrets[17](https://ramielcreations.com/macos-github-app-build)[18](https://stackoverflow.com/questions/79181398/problem-make-publisher-in-action-github-for-electronjs-application).

## Important Notes

- **Certificate Validity**: Developer ID certificates are valid for 5 years[19](https://developer.apple.com/support/developer-id/)
    
- **Hardened Runtime**: Required for notarization since macOS Catalina[16](https://samuelmeuli.com/blog/2019-12-28-notarizing-your-electron-app/)[20](https://github.com/electron-userland/electron-builder/issues/4693)
    
- **First Notarization**: Can take 8-12 hours initially, subsequent ones take ~10 minutes[7](https://github.com/omkarcloud/macos-code-signing-example)
    
- **Cost**: Apple Developer Program costs $99/year[13](https://paultreanor.com/notarize-mac-app)[21](https://www.bigbinary.com/blog/code-sign-notorize-mac-desktop-app)
    

The Developer ID Application certificate is specifically designed for your use case of distributing macOS apps outside the App Store, making it the perfect choice for GitHub releases[1](https://aso.dev/app-store-connect/developer-certificates/)[2](https://developer.apple.com/help/account/certificates/certificates-overview).

1. [https://aso.dev/app-store-connect/developer-certificates/](https://aso.dev/app-store-connect/developer-certificates/)
2. [https://developer.apple.com/help/account/certificates/certificates-overview](https://developer.apple.com/help/account/certificates/certificates-overview)
3. [https://www.electron.build/code-signing-mac.html](https://www.electron.build/code-signing-mac.html)
4. [https://electronjs.org/docs/latest/tutorial/code-signing](https://electronjs.org/docs/latest/tutorial/code-signing)
5. [https://www.electronforge.io/guides/code-signing/code-signing-macos](https://www.electronforge.io/guides/code-signing/code-signing-macos)
6. [https://gist.github.com/tony-go/d564023a9b7f270316fc8f1ebb0425a3](https://gist.github.com/tony-go/d564023a9b7f270316fc8f1ebb0425a3)
7. [https://github.com/omkarcloud/macos-code-signing-example](https://github.com/omkarcloud/macos-code-signing-example)
8. [https://developer.apple.com/help/account/certificates/create-developer-id-certificates/](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
9. [https://iosdevcenters.blogspot.com/2016/06/create-developer-id-certificate-apple.html](https://iosdevcenters.blogspot.com/2016/06/create-developer-id-certificate-apple.html)
10. [https://www.ssl.com/how-to/csr-generation-in-macos-keychain-access/](https://www.ssl.com/how-to/csr-generation-in-macos-keychain-access/)
11. [https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/)
12. [https://nocommandline.com/blog/how-to-sign-an-electron-app-on-mac-with-electron-builder/](https://nocommandline.com/blog/how-to-sign-an-electron-app-on-mac-with-electron-builder/)
13. [https://paultreanor.com/notarize-mac-app](https://paultreanor.com/notarize-mac-app)
14. [http://learn.appdocumentation.com/en/articles/1651188-how-to-set-up-your-app-specific-password](http://learn.appdocumentation.com/en/articles/1651188-how-to-set-up-your-app-specific-password)
15. [https://technotes.omnis.net/Technical%20Notes/Deployment/macOS%20notarization/1.Preparing%20notarization%20profile.html](https://technotes.omnis.net/Technical%20Notes/Deployment/macOS%20notarization/1.Preparing%20notarization%20profile.html)
16. [https://samuelmeuli.com/blog/2019-12-28-notarizing-your-electron-app/](https://samuelmeuli.com/blog/2019-12-28-notarizing-your-electron-app/)
17. [https://ramielcreations.com/macos-github-app-build](https://ramielcreations.com/macos-github-app-build)
18. [https://stackoverflow.com/questions/79181398/problem-make-publisher-in-action-github-for-electronjs-application](https://stackoverflow.com/questions/79181398/problem-make-publisher-in-action-github-for-electronjs-application)
19. [https://developer.apple.com/support/developer-id/](https://developer.apple.com/support/developer-id/)
20. [https://github.com/electron-userland/electron-builder/issues/4693](https://github.com/electron-userland/electron-builder/issues/4693)
21. [https://www.bigbinary.com/blog/code-sign-notorize-mac-desktop-app](https://www.bigbinary.com/blog/code-sign-notorize-mac-desktop-app)
22. [https://github.com/electron/notarize](https://github.com/electron/notarize)
23. [https://developer.apple.com/help/account/certificates/certificates-overview/](https://developer.apple.com/help/account/certificates/certificates-overview/)
24. [https://ioscodesigning.com/generating-code-signing-files/](https://ioscodesigning.com/generating-code-signing-files/)
25. [https://www.applivery.com/docs/mobile-device-management/apple-mdm/macos/signing-macos-packages/](https://www.applivery.com/docs/mobile-device-management/apple-mdm/macos/signing-macos-packages/)
26. [https://www.youtube.com/watch?v=4Q4tip0cDsM](https://www.youtube.com/watch?v=4Q4tip0cDsM)
27. [https://www.electron.build/code-signing-mac](https://www.electron.build/code-signing-mac)
28. [https://www.technotes.omnis.net/Technical%20Notes/Deployment/macOS%20notarization/1.Preparing%20notarization%20profile.html](https://www.technotes.omnis.net/Technical%20Notes/Deployment/macOS%20notarization/1.Preparing%20notarization%20profile.html)
29. [https://www.electron.build/configuration/mas.html](https://www.electron.build/configuration/mas.html)
30. [https://stackoverflow.com/questions/12126496/how-to-obtain-certificate-signing-request](https://stackoverflow.com/questions/12126496/how-to-obtain-certificate-signing-request)
31. [https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating](https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating)
32. [https://docs.revenera.com/installanywhere2021sp2/Content/helplibrary/OSX-GetCert.htm](https://docs.revenera.com/installanywhere2021sp2/Content/helplibrary/OSX-GetCert.htm)
33. [https://www.reddit.com/r/electronjs/comments/1exwnkm/need_help_code_signing_mac_electron_app/](https://www.reddit.com/r/electronjs/comments/1exwnkm/need_help_code_signing_mac_electron_app/)
34. [https://developer.apple.com/support/certificates/](https://developer.apple.com/support/certificates/)
35. [https://github.com/simonw/til/blob/main/electron/sign-notarize-electron-macos.md](https://github.com/simonw/til/blob/main/electron/sign-notarize-electron-macos.md)
36. [https://www.electron.build/publish.html](https://www.electron.build/publish.html)
37. [https://support.apple.com/guide/keychain-access/issue-new-certificates-kyca2792/mac](https://support.apple.com/guide/keychain-access/issue-new-certificates-kyca2792/mac)