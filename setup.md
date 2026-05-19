# SiteCapture Setup

## Prerequisites

- Node.js 20+ recommended
- npm
- Android Studio or a physical Android device for the Expo mobile app
- Expo Go for quick testing, or an Expo development build for better offline testing

## Backend And Admin Dashboard

Install dependencies from the project root:

```bash
npm install
```

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Example backend `.env`:

```env
DATABASE_URL="file:./dev.db"
MOBILE_API_KEY="replace-with-internal-mobile-api-key"
ADMIN_PASSWORD="replace-with-master-password"
ADMIN_JWT_SECRET="replace-with-long-random-secret"
```

Initialize the SQLite database:

```bash
npm run prisma:generate
npm run prisma:deploy
```

Run the Next.js app:

```bash
npm run dev
```

Open the admin dashboard:

```text
http://localhost:3000/admin/login
```

If port `3000` is busy, Next.js will print another port such as `3001`. Use that printed URL.

## Mobile App

Install mobile dependencies:

```bash
cd mobile
npm install
```

Create `mobile/.env` from `mobile/.env.example`:

```bash
cp .env.example .env
```

Set the API URL based on how you run the app:

```env
# Android emulator
EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:3000"

# Physical phone on the same Wi-Fi as your computer
EXPO_PUBLIC_API_BASE_URL="http://YOUR_COMPUTER_LAN_IP:3000"

EXPO_PUBLIC_MOBILE_API_KEY="same-value-as-root-MOBILE_API_KEY"
```

Start Expo:

```bash
npx expo start --clear --localhost --port 8081
```

For physical phones, make sure the phone and computer are on the same network and that `EXPO_PUBLIC_API_BASE_URL` uses the computer LAN IP, not `localhost`.

## Offline Testing

Expo Go needs network access to load the JavaScript bundle from Metro, so it is not ideal for testing cold-start offline behavior.

For basic offline workflow testing:

1. Start the backend.
2. Open the mobile app while online.
3. Tap Refresh on Select Site.
4. Turn off Wi-Fi/mobile data.
5. Capture photos.
6. Turn internet back on.
7. Pending photos should upload and site data should refresh automatically.

For production-like offline startup testing, use an installed development build:

```bash
cd mobile
npx expo install expo-dev-client
npx expo run:android
```

## Useful Commands

Root project:

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npm run prisma:generate
npm run prisma:deploy
```

Mobile project:

```bash
cd mobile
npx tsc --noEmit
npx expo start --clear --localhost --port 8081
```

## Storage

- Backend database: `prisma/dev.db`
- Uploaded images: `uploads/`
- Mobile local cache: Expo SQLite database on the device

`prisma/dev.db` and `uploads/` are local runtime files and are ignored by git.
