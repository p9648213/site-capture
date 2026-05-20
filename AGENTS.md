# AI REFERENCE DOCUMENT
# PROJECT: SITECAPTURE (Site Inspection Image Collection System)

## 1. PROJECT OVERVIEW
SiteCapture is a streamlined internal tool used by Field Technicians (FT) and a single Boss (Admin) to standardize the collection, synchronization, and compilation of site inspection images. 
Key requirements:
- **No User Management / No Mobile Login**: FTs simply open the app, select a site, and start working. The API is protected by a static internal API key.
- **Boss Exclusive Dashboard**: The web dashboard is protected by a single Master Password. The Boss creates new Sites, assigns Categories (e.g., "Indoor Pictures"), and defines specific Picture Types (e.g., "Tower-1", "Tower-2") required for that category.
- **Strict Completion Logic**: Sites and Categories only have two statuses: `INCOMPLETE` and `COMPLETED`. A Category becomes `COMPLETED` only when photos for all its specific Picture Types are uploaded. A Site becomes `COMPLETED` when all its Categories are completed.
- **Offline-First Mobile App**: Strictly typed, allowing FTs to take auto-watermarked photos (Time, GPS, Site Name) in dead-zones, queuing them for background syncing to a self-hosted custom backend.
- **Multi-Sheet Excel Export**: Boss can export a Site to Excel. Each Category becomes its own Sheet. Inside the sheet, Picture Types act as text labels, with the corresponding images embedded directly below them (using a fixed width and auto-calculated proportional height).
- **Local File Storage**: Images must be stored on the backend host's local file system organized in specific folders. No cloud storage.

---

## 2. TECH STACK
**Mobile App (Android focused):**
- Framework: React Native with Expo (Managed Workflow).
- Language: TypeScript.
- Local Storage: SQLite (via `expo-sqlite`).
- Camera/Location: `expo-camera`, `expo-location`, `expo-image-manipulator`, `expo-file-system`.

**Backend API & Web Admin Dashboard:**
- Framework: Full Stack Next.js (App Router) — Route Handlers in `app/api/**/route.ts` serve both the mobile app and the web dashboard. No separate Node/Express server.
- Language: TypeScript.
- Database: SQLite (local file via Prisma, `DATABASE_URL="file:./dev.db"`).
- File Handling/Sizing: Native Next.js `request.formData()` for uploads (no `multer`), Node `fs/promises` to write to disk, `image-size` for calculating aspect ratios.
- Excel Generation: `exceljs`.
- UI Components: Tailwind CSS + shadcn/ui.

---

## 3. DATABASE SCHEMA

### 3.A Server Schema (Prisma ORM — SQLite)
The AI should generate a `schema.prisma` file based on this simplified schema. **(No User Table)**

- **Site**: `id`, `name`, `siteId`, `status` (INCOMPLETE, COMPLETED), `updatedAt`.
- **Category**: `id`, `siteId` (Relation to Site), `name` (e.g., "Indoor Pictures", "Outdoor Pictures"), `status` (INCOMPLETE, COMPLETED), `updatedAt`.
- **PictureType**: `id`, `categoryId` (Relation to Category), `name` (e.g., "Tower-1", "Entrance"), `isFulfilled` (Boolean - defaults to false), `updatedAt`.
- **Photo**: `id`, `pictureTypeId` (Relation to PictureType), `localUri` (mobile only), `serverFilePath` (e.g., `/uploads/site_1/category_2/type_5/img.jpg`), `latitude`, `longitude`, `capturedAt`.

### 3.B Mobile Local Schema (SQLite via `expo-sqlite`)
The mobile app mirrors server entities locally so it can operate fully offline. Sites/Categories/PictureTypes are read-only on mobile (server is authoritative). Photos are write-locally / push-to-server.

- **sites**: `id`, `name`, `site_id`, `status`, `last_synced_at`.
- **categories**: `id`, `site_id`, `name`, `status`, `last_synced_at`.
- **picture_types**: `id`, `category_id`, `name`, `is_fulfilled`, `last_synced_at`.
- **photos**: `id` (local), `picture_type_id`, `local_uri`, `latitude`, `longitude`, `captured_at`, `sync_status` ('PENDING' | 'SYNCED'), `server_photo_id` (nullable).
- **sync_meta**: `key` (e.g., `'sites_last_synced_at'`), `value` (ISO timestamp). Single-row table tracking the last successful site/category refresh.

---

## 4. SYSTEM ARCHITECTURE & DATA FLOW

### A. Local File Storage Flow (Backend)
Do NOT use cloud storage. Images are stored on the Next.js server's disk.
1. The Next.js project has an `/uploads` directory at the project root (outside `public/` so files aren't auto-served without access control).
2. The `POST /api/photos/upload` Route Handler parses the multipart body via the native Web API: `const form = await request.formData()`. The handler is exported as `runtime = 'nodejs'` so Node `fs/promises` is available.
3. The Route Handler dynamically creates folders based on ID parameters: `/uploads/site_{siteId}/category_{categoryId}/type_{pictureTypeId}/` using `fs/promises.mkdir({ recursive: true })`.
4. The file is written there with `fs/promises.writeFile`, and the relative path is saved to the SQLite-backed Prisma `Photo` table.
5. Files are served back to clients via a dynamic Route Handler `GET /api/uploads/[...path]/route.ts` that validates the path is inside `/uploads`, streams the file from disk, and sets the correct `Content-Type`. (Do NOT use Express static middleware — it doesn't apply here.)
6. **Trigger Status Update**: Upon successful photo save, the Route Handler checks if all `PictureType`s for that `Category` have photos. If yes, `Category` -> `COMPLETED`. Then it checks if all `Category`s for that `Site` are completed. If yes, `Site` -> `COMPLETED`.

### B. Offline-First Mobile Flow

**Workflow assumption**: FTs open the app while still in a good-internet area (office, ground level, before climbing) to refresh local data. Once they go to dead-zone locations (towers, rooftops, basements), the app operates fully from local SQLite. The Boss does **not** update Sites/Categories mid-day; if an exceptional mid-day change happens, the Boss notifies FTs out-of-band to re-open the app and refresh.

1. **Initial Sync (requires internet, one-time per session)**:
   - On app open, if online, call `GET /api/sites/sync` to fetch all Sites + nested Categories + PictureTypes.
   - Upsert into local SQLite tables (`sites`, `categories`, `picture_types`).
   - Update `sync_meta` with the timestamp.
   - If offline, skip — use whatever is already cached.
2. **Site Selection (works offline)**: The "Select Site" screen always reads from local SQLite, never from the network. It works identically online and offline.
3. **Capture**: FT selects a Site -> Category -> `PictureType` and takes a photo via `expo-camera`.
4. **Watermark**: `expo-image-manipulator` applies GPS, Time, and Site Name text onto the image.
5. **Local DB Save**: Photo record added to local SQLite `photos` table as `sync_status: 'PENDING'`. UI immediately marks the PictureType as locally fulfilled (optimistic).
6. **Sync Engine**: `expo-network` listener detects internet. Reads PENDING records -> creates `FormData` -> `POST /api/photos/upload` via Axios.
7. **Confirmation**: On 200 OK, SQLite updates `sync_status: 'SYNCED'` and stores the returned `server_photo_id`.

### B.1 Sync Endpoint Contract
- `GET /api/sites/sync` (requires `x-api-key`) returns:
  ```
  {
    "syncedAt": "2026-05-18T10:00:00Z",
    "sites": [
      {
        "id": 1, "name": "...", "siteId": "...", "status": "INCOMPLETE", "updatedAt": "...",
        "categories": [
          {
            "id": 10, "name": "...", "status": "INCOMPLETE", "updatedAt": "...",
            "pictureTypes": [
              { "id": 100, "name": "Tower-1", "isFulfilled": false, "updatedAt": "..." }
            ]
          }
        ]
      }
    ]
  }
  ```
- Mobile performs an **upsert** (insert-or-replace by `id`) into local SQLite. The response includes both `INCOMPLETE` and `COMPLETED` Sites so completed work does not disappear from the mobile cache after uploads sync.

### C. Category-Based Excel Export Flow
1. Boss clicks "Export to Excel" on a Site in the Next.js Dashboard.
2. The Next.js Route Handler `GET /api/export/excel/site/[siteId]/route.ts` fetches the `Site` and includes all `Categories`, `PictureTypes`, and `Photos`.
3. The Route Handler creates a new `exceljs` Workbook.
4. Loop through `Categories`:
   - Create a new Excel Sheet named after the Category (e.g., "Sheet 1: Indoor").
   - Loop through `PictureTypes` in that Category:
     - Write the `PictureType.name` as a text label in the current row.
     - Move to the row directly below.
     - Use Node `fs/promises` to read the image from disk into a buffer.
     - Use `image-size` library to read original dimensions.
     - Calculate new dimensions: `fixed_width = 400px` (or preferred size), `calculated_height = (original_height / original_width) * fixed_width`.
     - Embed the image into the cell, dynamically setting the Excel row height to match `calculated_height`.
5. Return the workbook from the Route Handler as a `Response` with the `.xlsx` buffer and `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` so the browser downloads it.

---

## 5. AI EXECUTION PLAN (VIBE-CODING PHASES)
*AI Assistant: Execute these phases sequentially. Do not jump ahead. Wait for user confirmation before moving to the next phase.*

### PHASE 1: Backend Foundation (Next.js Route Handlers + Prisma + SQLite)
- Initialize a Next.js 14+ App Router TypeScript project (this same project also hosts the web dashboard — there is NO separate Node/Express server).
- Setup Prisma with SQLite and generate the schema based on Section 3.A.
- Implement basic security via a shared middleware/helper used inside each Route Handler:
  - Mobile routes (under `app/api/sites/sync`, `app/api/photos/upload`, etc.) require a static `x-api-key` header matching `process.env.MOBILE_API_KEY`.
  - Dashboard routes require a JWT cookie issued after the Boss submits a password matching `process.env.ADMIN_PASSWORD`.
- Create CRUD Route Handlers for the Boss to create Sites, Categories, and Picture Types (`app/api/sites/route.ts`, `app/api/categories/route.ts`, `app/api/picture-types/route.ts`).
- Implement `GET /api/sites/sync` per Section 4.B.1 — returns all Sites with nested Categories and PictureTypes for mobile sync.

### PHASE 2: File Upload API & Status Cascade Logic
- Create the Route Handler `app/api/photos/upload/route.ts` with `export const runtime = 'nodejs'` (required for `fs` access).
- Parse the multipart body using the native `await request.formData()` — do NOT install or use `multer` (it's Express-only middleware and is incompatible with Next.js Route Handlers).
- Implement logic to save the file to `/uploads/site_{siteId}/category_{categoryId}/type_{pictureTypeId}/` using `fs/promises` and insert the `Photo` record via Prisma.
- Add `app/api/uploads/[...path]/route.ts` to stream the saved files back (with path validation to prevent traversal).
- **Crucial**: Write the cascading logic function. When a photo uploads -> mark `PictureType` fulfilled -> check/update `Category` status -> check/update `Site` status. Run all DB writes inside a single Prisma transaction.

### PHASE 3: Web Admin Foundation (Next.js)
- In the same Next.js project from Phase 1, add Tailwind and shadcn/ui.
- Build Master Password Login screen (Server Action or Route Handler that sets a JWT cookie when `process.env.ADMIN_PASSWORD` matches).
- Build the "Site Builder" interface: Forms to create a Site, add Categories, and add Picture Types to those categories.
- Build the Site Overview dashboard showing progress (`INCOMPLETE` vs `COMPLETED`).

### PHASE 4: Mobile App Foundation (Expo UI) + Offline Sync of Site Data
- Initialize Expo TypeScript app with React Navigation.
- **No Login Screen**: App opens directly to a "Select Site" screen reading from local SQLite (works offline).
- Build SQLite schema per Section 3.B (`sites`, `categories`, `picture_types`, `photos`, `sync_meta`).
- Implement initial-sync logic: on app open, if `expo-network` reports online, call `GET /api/sites/sync` and upsert into SQLite. If offline, skip silently and use cached data.
- Build UI for Site Detail -> Category Detail, clearly showing which Picture Types are missing photos vs completed.

**UX Requirements for Offline Confidence** (on the "Select Site" screen):
1. **"Last synced" timestamp** displayed prominently at the top — e.g., `Last synced: 2 hours ago` (use relative time). Reads from `sync_meta`.
2. **Manual "Refresh" button** with explicit loading spinner. FTs use this before heading to dead-zone areas. On success, update timestamp; on failure, show inline error.
3. **Stale-data warning banner** when last sync is > 24 hours old or `null`: ⚠ "You haven't synced today. Refresh before going offline." (non-blocking, but visible).
4. **Offline indicator**: When `expo-network` reports no connectivity, show a small badge "Offline — using cached data from [time]". Disable the Refresh button (or show a tap message: "No internet. Connect to refresh.") so FTs aren't confused when nothing updates.
5. **No silent failures**: Every sync attempt must either visibly succeed (timestamp updates) or visibly fail (toast/banner). Never let a sync silently fail and leave FTs thinking they have fresh data.

### PHASE 5: Mobile Offline Camera & Local DB
- Integrate `expo-camera`, `expo-location`, and local SQLite.
- Build custom camera screen.
- On capture: Grab GPS -> draw watermark -> save to `expo-file-system`.
- Insert photo metadata into SQLite with `status: PENDING`.

### PHASE 6: Mobile Sync Engine
- Build network listener.
- Fetch `PENDING` records, convert local URIs to `FormData` (append file).
- Upload to `POST /api/photos/upload` (include `x-api-key` header).
- Update local SQLite to `SYNCED` on success and refresh UI.

### PHASE 7: Advanced Multi-Sheet Excel Export (Backend API)
- Create the Route Handler `app/api/export/excel/site/[siteId]/route.ts` (with `runtime = 'nodejs'`).
- Install `exceljs` and `image-size`.
- Iterate through Categories to create tabs/sheets.
- Implement the "Label on top, Image exactly below" layout.
- Return the generated `.xlsx` workbook as a `Response` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and a `Content-Disposition: attachment` header.

---

## 6. STRICT AI INSTRUCTIONS & CONSTRAINTS
1. **TypeScript Only**: Use strict typing for all components, API requests, and Prisma schemas.
2. **No User Auth**: DO NOT build a User table or JWT Login system for the mobile app. Only use a single Master Password environment variable for the web dashboard, and a static API key for the mobile endpoints.
3. **Status Constraint**: DO NOT invent statuses like "In Progress" or "Reviewing". ONLY use `INCOMPLETE` and `COMPLETED`.
4. **Excel Image Sizing**: You MUST use an image inspection library like `image-size` to read the original width/height of the uploaded `.jpg`/`.png` from disk before injecting it into `exceljs`. Do not rely on ExcelJS's default stretching. The width must be fixed, and height must strictly maintain the aspect ratio.
5. **No AI Hallucinations**: If you need a specific native library for Expo (e.g., for watermarking) or backend image processing, explicitly ask the human user to run the `npm install` / `npx expo install` command.
6. **Stack is Next.js + React Native ONLY**: The entire backend (API, file uploads, file serving, Excel export) lives inside the single Next.js App Router project as Route Handlers. The mobile client is React Native (Expo). DO NOT introduce Express, Fastify, Koa, NestJS, a separate Node server, `multer`, `express.static`, or any other framework — even if a tutorial or training-data example shows it. If a library is Express-middleware-only (like `multer`), use the Next.js native equivalent (`request.formData()`, `fs/promises`, streaming `Response`).
