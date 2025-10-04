# SharePaste

A minimal, pretty, mobile‑friendly Next.js app to quickly share text and files across devices using a single, temporary session that expires after 10 minutes.

- One active session at a time, protected by a passcode.
- Paste and auto‑save shared text.
- Upload multiple files (multi‑select) stored under a UUID while preserving the original filenames for download.
- On session expiry, content is no longer shared. Next visit prompts for a new session.
- Beautiful responsive UI built with Tailwind CSS.

## Features

- Single active session that auto‑expires (default 10 minutes).
- Session creation requires a passcode (from environment variable).
- Optional “Remember me” cookie so future session creation doesn’t require the passcode on the same device.
- Manual session deactivation from the UI; clears files and cookie immediately.
- Shared text area with debounce autosave.
- File upload to Google Cloud Storage (preferred) with a local filesystem fallback for development.
- Download endpoint serves files with original filename (GCS via public URL, local via stream). Files can be deleted individually.

## Tech Stack

- Next.js 14 (App Router)
- React 18
- Tailwind CSS 3
- Optional: @google-cloud/storage for GCS uploads

## Requirements

- Node.js 18+
- Environment variables:
  - `SESSION_CREATION_PASSCODE` (required): passcode to create a new session.
  - `SESSION_TTL_MINUTES` (optional): defaults to `10`.
  - `USE_GCS` (optional): set to `false` to force local storage. Defaults to using GCS if configured.
  - `GCS_BUCKET` (optional but required for GCS): the GCS bucket name.
  - Google Cloud credentials: standard ADC (e.g., `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account JSON, or Workload Identity). See: https://cloud.google.com/docs/authentication/provide-credentials-adc
  - Public access note: objects are made public at upload for direct serving. Ensure your bucket policy allows public reads (either object ACLs if UBLA is disabled or appropriate bucket-level IAM granting public read).
  - `REMEMBER_DAYS` (optional): days to keep the remember‑me cookie, default `30`.

## Setup

1. Install dependencies:

   - `npm install`

   If you plan to use GCS:

   - `npm install @google-cloud/storage`

2. Configure environment variables.

   Create `.env.local` in the project root:

   ```env
   SESSION_CREATION_PASSCODE=your-strong-passcode
   SESSION_TTL_MINUTES=10
   # For GCS (optional, recommended in production):
   USE_GCS=true
   GCS_BUCKET=your-bucket-name
   # Set up Google ADC, e.g.:
   # GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
   ```

3. Run the app:

   - Development: `npm run dev`
   - Production: `npm run build && npm start`

4. Usage

   - Visit the app; if no session is active or it is expired, click “Create Session”, enter the passcode.
   - Paste text into the editor; changes auto‑save.
   - Upload multiple files at once; each is stored under a UUID but downloaded with the original filename. You can delete individual files.
   - You can manually deactivate the session anytime from the header widget; this clears all files (local removed; GCS deleted best‑effort) and removes the remember‑me cookie.
   - After expiry (10 minutes by default), the session deactivates; content is no longer shared and files are cleaned up (local files removed; GCS objects deleted best‑effort). You will be prompted to create a new session.

## Notes & Limitations

- The app keeps state in memory for the current process. In production, use a persistent backing store if you need durability beyond process lifetime.
- GCS uploads require network and proper credentials; in development you may use the local fallback (`USE_GCS=false`). Local files are written to `./uploads`.
- GCS objects are made public at upload to enable direct public download links. If you require private access, switch back to signed URLs and configure credentials appropriately.
- This project intentionally does not include tests per the requirements.

## Project Structure

- `app/page.tsx`: main UI with session prompts, editor, and uploader.
- `app/api/session/route.ts`: session creation/status, sets/validates a remember‑me cookie.
- `app/api/text/route.ts`: shared text read/write.
- `app/api/files/route.ts`: list/upload files.
- `app/api/files/[id]/route.ts`: download by id; DELETE to remove a file.
- `lib/store.ts`: in‑memory session store and helpers.
- `lib/gcs.ts`: GCS upload, public URL, and deletion helpers.
- `app/globals.css`, `tailwind.config.ts`: Tailwind styling.

## Security

- Session creation is protected by a server‑side passcode from env.
- GCS file downloads use public object URLs; objects are publicly readable until deleted. Session expiry triggers best‑effort deletion of both local files and GCS objects.
- The remember‑me cookie is scoped to this app and device; it stores a hash derived from the server passcode (not the raw passcode) and allows creating new sessions without re‑entering the passcode.

## Deploy

### Docker (local)

- Build: `docker build -t share-paste:latest .`
- Run with env vars:
  - `docker run -p 8080:8080 -e SESSION_CREATION_PASSCODE='your-pass' share-paste:latest`
  - Or use a file: create `.env.deploy` with your vars, then `docker run --env-file .env.deploy -p 8080:8080 share-paste:latest`

### Google Cloud Run

- Prereqs: gcloud CLI, project set, Cloud Run and Cloud Build APIs enabled.
- Option A — one command each:
  - Build: `gcloud builds submit --tag gcr.io/PROJECT_ID/share-paste:latest .`
  - Deploy: `gcloud run deploy share-paste --image gcr.io/PROJECT_ID/share-paste:latest --platform managed --region REGION --allow-unauthenticated --set-env-vars SESSION_CREATION_PASSCODE=your-pass`
  - Optional: `--env-vars-file .env.deploy` to pass multiple envs.
- Option B — script:
  - Put envs in `.env.deploy` (see below).
  - Run: `scripts/deploy-cloudrun.sh`

### Environment Variables

- `SESSION_CREATION_PASSCODE`: required; passcode to create sessions.
- `SESSION_TTL_MINUTES`: optional; default `10`.
- `USE_GCS`: optional; set to `true` to prefer GCS.
- `GCS_BUCKET`: required if using GCS.
- `REMEMBER_DAYS`: optional; remember‑me cookie lifetime in days (default `30`).
- Google ADC (for GCS): Cloud Run uses its service account; grant it Storage permissions. For local Docker, you can `-e GOOGLE_APPLICATION_CREDENTIALS=/path/key.json` and mount the file.

Notes

- This app builds with Next.js standalone server (`output: 'standalone'`), exposing `PORT=8080` for Cloud Run.
- GCS objects are made public when uploaded to enable direct public URLs. Ensure bucket policy/IAM allow public reads, or revert to signed URLs if privacy is required.
- There is no user authentication; anyone with access to the app during an active session can read/write.

## Customization

- Adjust `SESSION_TTL_MINUTES` for a different expiry.
- Update Tailwind theme in `tailwind.config.ts` and UI components for branding.

---

Built with ❤️ using Next.js and Tailwind CSS.
