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
- Framework: Full Stack Next.js (App Router).
- Language: TypeScript.
- Database: PostgreSQL (Self-hosted using docker).
- File Handling/Sizing: `multer` (uploads), `image-size` (for calculating aspect ratios).
- Excel Generation: `exceljs`.
- UI Components: Tailwind CSS + shadcn/ui.

---

## 3. DATABASE SCHEMA (Prisma ORM Reference)
The AI should generate a `schema.prisma` file based on this simplified schema. **(No User Table)**

- **Site**: `id`, `name`, `address`, `status` (INCOMPLETE, COMPLETED).
- **Category**: `id`, `siteId` (Relation to Site), `name` (e.g., "Indoor Pictures", "Outdoor Pictures"), `status` (INCOMPLETE, COMPLETED).
- **PictureType**: `id`, `categoryId` (Relation to Category), `name` (e.g., "Tower-1", "Entrance"), `isFulfilled` (Boolean - defaults to false).
- **Photo**: `id`, `pictureTypeId` (Relation to PictureType), `localUri` (mobile only), `serverFilePath` (e.g., `/uploads/site_1/category_2/type_5/img.jpg`), `latitude`, `longitude`, `capturedAt`.

---

## 4. SYSTEM ARCHITECTURE & DATA FLOW

### A. Local File Storage Flow (Backend)
Do NOT use cloud storage. Images are stored on the server's disk.
1. Backend has an `/uploads` directory.
2. The `POST /api/upload` endpoint uses `multer`.
3. Multer dynamically creates folders based on ID parameters: `/uploads/site_{siteId}/category_{categoryId}/type_{pictureTypeId}/`.
4. The file is saved there, and the relative path is saved to the PostgreSQL `Photo` table.
5. Express serves this folder statically `app.use('/uploads', express.static('uploads'))`.
6. **Trigger Status Update**: Upon successful photo save, the backend checks if all `PictureType`s for that `Category` have photos. If yes, `Category` -> `COMPLETED`. Then it checks if all `Category`s for that `Site` are completed. If yes, `Site` -> `COMPLETED`.

### B. Offline-First Mobile Flow
1. **Fetch**: FT opens the app (no login) and downloads all `INCOMPLETE` Sites, along with nested `Category` and `PictureType` lists.
2. **Capture**: FT selects a Site -> Category -> `PictureType` and takes a photo via `expo-camera`.
3. **Watermark**: `expo-image-manipulator` applies GPS, Time, and Site Name text onto the image.
4. **Local DB Save**: Record added to local SQLite as `sync_status: 'PENDING'`.
5. **Sync Engine**: `expo-network` listener detects internet. Reads PENDING records -> creates `FormData` -> `POST /api/upload` via Axios.
6. **Confirmation**: On 200 OK, SQLite updates to `sync_status: 'SYNCED'` and the UI marks the PictureType as fulfilled.

### C. Category-Based Excel Export Flow
1. Boss clicks "Export to Excel" on a Site in the Next.js Dashboard.
2. Node.js backend fetches the `Site` and includes all `Categories`, `PictureTypes`, and `Photos`.
3. Node.js creates a new `exceljs` Workbook.
4. Loop through `Categories`:
   - Create a new Excel Sheet named after the Category (e.g., "Sheet 1: Indoor").
   - Loop through `PictureTypes` in that Category:
     - Write the `PictureType.name` as a text label in the current row.
     - Move to the row directly below.
     - Use Node.js `fs` to read the image from disk into a buffer.
     - Use `image-size` library to read original dimensions.
     - Calculate new dimensions: `fixed_width = 400px` (or preferred size), `calculated_height = (original_height / original_width) * fixed_width`.
     - Embed the image into the cell, dynamically setting the Excel row height to match `calculated_height`.
5. Stream the `.xlsx` file to the frontend for download.

---

## 5. AI EXECUTION PLAN (VIBE-CODING PHASES)
*AI Assistant: Execute these phases sequentially. Do not jump ahead. Wait for user confirmation before moving to the next phase.*

### PHASE 1: Backend Foundation (Express + Prisma + Postgres)
- Initialize Node/Express/TypeScript project.
- Setup Prisma and generate the schema based on Section 3.
- Implement basic security: Mobile routes require a static header `x-api-key`. Dashboard routes require checking a JWT generated by matching `process.env.ADMIN_PASSWORD`.
- Create CRUD endpoints for the Boss to create Sites, Categories, and Picture Types.

### PHASE 2: File Upload API & Status Cascade Logic
- Install/Configure `multer` in Express.
- Create `POST /api/photos/upload`. 
- Implement logic to save file to `/uploads/siteId/categoryId/typeId/` and insert `Photo` record.
- **Crucial**: Write the cascading logic function. When a photo uploads -> mark `PictureType` fulfilled -> check/update `Category` status -> check/update `Site` status.

### PHASE 3: Web Admin Foundation (Next.js)
- Initialize Next.js App Router with Tailwind and shadcn/ui.
- Build Master Password Login screen.
- Build the "Site Builder" interface: Forms to create a Site, add Categories, and add Picture Types to those categories.
- Build the Site Overview dashboard showing progress (`INCOMPLETE` vs `COMPLETED`).

### PHASE 4: Mobile App Foundation (Expo UI)
- Initialize Expo TypeScript app with React Navigation.
- **No Login Screen**: App opens directly to a "Select Site" screen fetching all `INCOMPLETE` sites.
- Build UI for Site Detail -> Category Detail, clearly showing which Picture Types are missing photos vs completed.

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
- Create `GET /api/export/excel/site/:siteId`.
- Install `exceljs` and `image-size`.
- Iterate through Categories to create tabs/sheets.
- Implement the "Label on top, Image exactly below" layout.
- Implement the aspect-ratio math to ensure images have a strict fixed width but dynamic row height.
- Return the generated `.xlsx` workbook.

---

## 6. STRICT AI INSTRUCTIONS & CONSTRAINTS
1. **TypeScript Only**: Use strict typing for all components, API requests, and Prisma schemas.
2. **No User Auth**: DO NOT build a User table or JWT Login system for the mobile app. Only use a single Master Password environment variable for the web dashboard, and a static API key for the mobile endpoints.
3. **Status Constraint**: DO NOT invent statuses like "In Progress" or "Reviewing". ONLY use `INCOMPLETE` and `COMPLETED`.
4. **Excel Image Sizing**: You MUST use an image inspection library like `image-size` to read the original width/height of the uploaded `.jpg`/`.png` from disk before injecting it into `exceljs`. Do not rely on ExcelJS's default stretching. The width must be fixed, and height must strictly maintain the aspect ratio.
5. **No AI Hallucinations**: If you need a specific native library for Expo (e.g., for watermarking) or backend image processing, explicitly ask the human user to run the `npm install` / `npx expo install` command.
