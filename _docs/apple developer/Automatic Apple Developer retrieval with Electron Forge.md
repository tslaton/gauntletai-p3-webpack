---
link: https://www.perplexity.ai/search/can-electron-forge-automatical-SoszJrSORhCRDaSfKzWz6A
---

## Automatic Certificate Detection in Electron Forge

**Yes, Electron Forge can automatically detect your Developer ID Application certificates** without requiring you to explicitly specify them in your configuration. The automatic detection mechanism works through the underlying `@electron/osx-sign` tool that Forge uses for macOS code signing.

## How Automatic Detection Works

When you configure Electron Forge with an empty `osxSign` configuration object, the underlying `@electron/osx-sign` tool automatically scans your macOS keychain for valid code signing certificates[1](https://www.electronforge.io/guides/code-signing/code-signing-macos). Here's what happens:

1. **Keychain Scanning**: The tool executes `security find-identity -p codesigning -v` to discover available certificates[2](https://stackoverflow.com/questions/79262747/code-signing-using-electron-forge-for-windows)[3](https://mintkit.net/electron-userland/electron-osx-sign/guide/)
    
2. **Certificate Validation**: It identifies valid **Developer ID Application** certificates for distribution outside the Mac App Store
    
3. **Automatic Selection**: If only one valid certificate is found, it's automatically selected for signing
    

## Configuration for Automatic Detection

To enable automatic certificate detection in Electron Forge, you simply need to include an empty `osxSign` object in your `packagerConfig`:

javascript

`module.exports = {   packagerConfig: {    osxSign: {} // Empty object enables automatic detection  } };`

As stated in the official documentation: "The `osxSign` config comes with defaults that work out of the box in most cases, so we recommend you start with an empty configuration object"[1](https://www.electronforge.io/guides/code-signing/code-signing-macos).

## Prerequisites for Automatic Detection

For automatic detection to work properly, you need:

1. **Certificates in System Keychain**: Install your Developer ID Application certificates in your system's default keychain (preferably the login keychain)[3](https://mintkit.net/electron-userland/electron-osx-sign/guide/)[4](https://blog.csdn.net/weixin_33868027/article/details/87965345)
    
2. **Valid Certificate Chain**: Ensure certificates include their private keys and are properly configured[5](https://www.npmjs.com/package/electron-osx-sign)
    
3. **Single Valid Certificate**: Automatic detection works best when you have only one valid certificate of each type
    

## Verification

You can verify which certificates are available for automatic detection by running:

bash

`security find-identity -p codesigning -v`

This command will list all valid code signing identities in your keychain[6](https://stackoverflow.com/questions/46480682/how-to-sign-electron-app-using-electron-forge)[7](https://docs.digicert.com/en/digicert-keylocker/code-signing/sign-with-third-party-signing-tools/windows-applications/sign-executables-with-electron-builder-using-ksp-library.html).

## When Manual Configuration Is Needed

You'll need to manually specify the identity if:

- You have multiple valid certificates and want to use a specific one
    
- Certificates are stored in non-default keychains
    
- You're using environment variables for CI/CD workflows
    
- Automatic detection fails to find the correct certificate
    

In such cases, you can explicitly specify the identity:

javascript

`module.exports = {   packagerConfig: {    osxSign: {      identity: "Developer ID Application: Your Name (TEAM_ID)"    }  } };`

The automatic certificate detection in Electron Forge provides a streamlined experience for developers with standard certificate setups, eliminating the need for manual configuration in most common scenarios[1](https://www.electronforge.io/guides/code-signing/code-signing-macos)[4](https://blog.csdn.net/weixin_33868027/article/details/87965345).

1. [https://www.electronforge.io/guides/code-signing/code-signing-macos](https://www.electronforge.io/guides/code-signing/code-signing-macos)
2. [https://stackoverflow.com/questions/79262747/code-signing-using-electron-forge-for-windows](https://stackoverflow.com/questions/79262747/code-signing-using-electron-forge-for-windows)
3. [https://mintkit.net/electron-userland/electron-osx-sign/guide/](https://mintkit.net/electron-userland/electron-osx-sign/guide/)
4. [https://blog.csdn.net/weixin_33868027/article/details/87965345](https://blog.csdn.net/weixin_33868027/article/details/87965345)
5. [https://www.npmjs.com/package/electron-osx-sign](https://www.npmjs.com/package/electron-osx-sign)
6. [https://stackoverflow.com/questions/46480682/how-to-sign-electron-app-using-electron-forge](https://stackoverflow.com/questions/46480682/how-to-sign-electron-app-using-electron-forge)
7. [https://docs.digicert.com/en/digicert-keylocker/code-signing/sign-with-third-party-signing-tools/windows-applications/sign-executables-with-electron-builder-using-ksp-library.html](https://docs.digicert.com/en/digicert-keylocker/code-signing/sign-with-third-party-signing-tools/windows-applications/sign-executables-with-electron-builder-using-ksp-library.html)
8. [https://www.electronjs.org/docs/latest/tutorial/code-signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
9. [https://www.electronjs.org/de/docs/latest/tutorial/code-signing](https://www.electronjs.org/de/docs/latest/tutorial/code-signing)
10. [https://electronjs.org/docs/latest/tutorial/code-signing](https://electronjs.org/docs/latest/tutorial/code-signing)
11. [https://www.npmjs.com/package/@burzo/electron-forge-ssl-code-sign-plugin](https://www.npmjs.com/package/@burzo/electron-forge-ssl-code-sign-plugin)
12. [https://www.electronjs.org/pt/docs/latest/tutorial/code-signing](https://www.electronjs.org/pt/docs/latest/tutorial/code-signing)
13. [https://github.com/Burzo/electron-forge-ssl-code-sign-plugin/](https://github.com/Burzo/electron-forge-ssl-code-sign-plugin/)
14. [https://stackoverflow.com/questions/53025339/why-electron-osx-sign-fails-to-produce-a-signed-app-recognised-by-gatekeeper](https://stackoverflow.com/questions/53025339/why-electron-osx-sign-fails-to-produce-a-signed-app-recognised-by-gatekeeper)
15. [https://gist.github.com/jorangreef/27e708c67b7e6746a98a](https://gist.github.com/jorangreef/27e708c67b7e6746a98a)
16. [https://dev.to/kylefoo/electron-code-signing-using-sslcom-codesigntool-for-ev-code-signing-non](https://dev.to/kylefoo/electron-code-signing-using-sslcom-codesigntool-for-ev-code-signing-non)
17. [https://github.com/electron/osx-sign](https://github.com/electron/osx-sign)
18. [https://research.splunk.com/endpoint/87ac670e-bbfd-44ca-b566-44e9f835518d/](https://research.splunk.com/endpoint/87ac670e-bbfd-44ca-b566-44e9f835518d/)
19. [https://github.com/electron/osx-sign/wiki/1.-Getting-Started](https://github.com/electron/osx-sign/wiki/1.-Getting-Started)
20. [https://www.npmjs.com/package/electron-macos-sign](https://www.npmjs.com/package/electron-macos-sign)
21. [https://stackoverflow.com/questions/46480682/how-to-sign-electron-app-using-electron-forge/54204116](https://stackoverflow.com/questions/46480682/how-to-sign-electron-app-using-electron-forge/54204116)
22. [https://github.com/electron/electron-osx-sign/issues/189](https://github.com/electron/electron-osx-sign/issues/189)
23. [https://stackoverflow.com/questions/57044988/having-problems-getting-electron-builder-to-sign-a-mac-build](https://stackoverflow.com/questions/57044988/having-problems-getting-electron-builder-to-sign-a-mac-build)
24. [https://githubhelp.com/electron/electron-osx-sign](https://githubhelp.com/electron/electron-osx-sign)
25. [https://github.com/electron-userland/electron-osx-sign/issues/168](https://github.com/electron-userland/electron-osx-sign/issues/168)
26. [https://www.npmjs.com/package/electron-osx-sign/v/0.1.6](https://www.npmjs.com/package/electron-osx-sign/v/0.1.6)
27. [https://runebook.dev/en/articles/electron/tutorial/code-signing](https://runebook.dev/en/articles/electron/tutorial/code-signing)
28. [https://github.com/electron/forge/issues/3549](https://github.com/electron/forge/issues/3549)
29. [https://blog.csdn.net/gitblog_00938/article/details/141450067](https://blog.csdn.net/gitblog_00938/article/details/141450067)
30. [https://www.electronforge.io/guides/code-signing/code-signing-windows](https://www.electronforge.io/guides/code-signing/code-signing-windows)
31. [https://www.electronforge.io/guides/code-signing](https://www.electronforge.io/guides/code-signing)
32. [https://electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide](https://electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)