# App Store Credentials & Build Config

## EAS / Expo
- **EAS Account:** @jasontur7720/dreamz
- **EAS Project ID:** 7a63985f-a2fb-45fe-8dc8-311a9c270047
- **Bundle Identifier:** com.dreamzjournal.app

## Apple Developer
- **Apple Team:** JVCGFH8YU5 (Jason Tur, Individual)
- **Provider ID:** 128607550
- **App Store Connect App ID:** 6760150023

## Distribution Certificate
- **Serial Number:** 2F8B82E4640888DBA619CBA247001132
- **Expiration:** March 6, 2027
- **Apple Team:** JVCGFH8YU5

## Provisioning Profile
- **Developer Portal ID:** 7KN8UJ9N87
- **Status:** active
- **Expiration:** March 6, 2027
- **Apple Team:** JVCGFH8YU5

## Sandbox Testing
- **Sandbox Tester:** support@dreamzjournal.com

## Build Commands
```bash
# Production build
npx eas-cli build --platform ios --profile production

# Submit to TestFlight
npx eas-cli submit --platform ios --latest

# Encryption compliance: "Yes, standard encryption only" (HTTPS + pgcrypto)
```

## Notes
- Credentials created March 6, 2026
- `eas.json` has `autoIncrement: true` for production builds
- Internal testers get immediate TestFlight access (no review wait)
