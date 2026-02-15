# QA Report -- Phase 3: Dashboard Form Editor (Round 2)

**Date:** 2026-02-15T20:45:00Z
**Branch:** qa/phase-3-review
**PR:** #3
**Round:** 2 (re-review of security fixes SEC-012, SEC-013, SEC-014)
**Result:** PASS (6/6 checks passed)

## Context

Round 1 identified three security findings. The dev agent applied fixes in commits `a262313` and `f2f556b`. This round 2 review verifies all three fixes are correct and that no regressions were introduced.

## Test Results

### TC-R2-001: npm run build passes
**Status:** PASS
**Detail:** `npm run build` completed successfully. Output: 123 modules transformed, `dist/` produced with 3 assets. No errors or warnings.

### TC-R2-002: npx tsc --noEmit passes
**Status:** PASS
**Detail:** `npx tsc --noEmit` completed with zero errors. TypeScript strict mode is satisfied.

### TC-R2-003: SEC-013 -- Storage policies migration (002_storage_policies.sql)
**Status:** PASS
**Detail:** Reviewed `supabase/migrations/002_storage_policies.sql`. The migration:
- Creates the `photos` bucket as **private** (`public = false`) with `ON CONFLICT DO NOTHING` for idempotency.
- Defines three RLS policies on `storage.objects` (INSERT, SELECT, DELETE) scoped to `authenticated` role.
- Each policy restricts access to paths where `(storage.foldername(name))[1] = 'photos'` and `(storage.foldername(name))[2] = auth.uid()::text`, ensuring users can only interact with files in their own `photos/{user_id}/` prefix.
- Uses standard Supabase Storage helper functions (`storage.foldername`, `auth.uid()`).
- SQL is syntactically well-formed with proper semicolons and clause structure.
- No UPDATE policy is defined, which is intentional since `usePhotoUpload` uses `upsert: false` (insert-only). No storage update operation exists in the client code.
- Migration filename follows the sequential numbering convention (`002_` after `001_initial_schema.sql`).

### TC-R2-004: SEC-012 -- MIME-to-extension mapping in usePhotoUpload
**Status:** PASS
**Detail:** Reviewed the diff in `src/hooks/usePhotoUpload.ts`:
- The old code derived file extension from `file.name.split(".").pop()`, which is user-controlled and could be spoofed.
- The new code uses a `MIME_TO_EXT` lookup table mapping validated MIME types to extensions:
  - `image/jpeg` -> `jpg`
  - `image/png` -> `png`
  - `image/webp` -> `webp`
- If the MIME type is not in the map, the upload is rejected with a generic error message ("Unsupported file type.") and `uploading` state is reset to `false`.
- The MIME type has already been validated against `ALLOWED_TYPES` at that point, so the `!ext` guard is a defence-in-depth measure. Both checks use the same `file.type` value.
- The three MIME types in `MIME_TO_EXT` exactly match the three entries in `ALLOWED_TYPES`. Mapping is correct.

### TC-R2-005: SEC-014 -- Storage path verification before delete
**Status:** PASS
**Detail:** Reviewed the `deletePhoto` callback:
- Before issuing the Supabase delete, the code now checks `!user || !storagePath.startsWith(\`photos/${user.id}/\`)`.
- If the check fails, it sets a generic error ("Invalid storage path.") and returns early without performing any delete.
- The `user` dependency was correctly added to the `useCallback` deps array (`[user]` instead of `[]`).
- The `PhotoUploadCard` component passes `photo.storage_path` (from the database row) to `onDelete`, so under normal operation this path will always match. The guard protects against tampered or stale references.
- This is a client-side defence-in-depth measure. The server-side RLS policy (SEC-013) provides the authoritative enforcement.

### TC-R2-006: No regressions in existing code
**Status:** PASS
**Detail:**
- The diff is minimal and surgical: only `src/hooks/usePhotoUpload.ts` and the new migration file were touched. No other source files were modified.
- The `MIME_TO_EXT` map is a new constant added at module scope -- no impact on other exports.
- The `deletePhoto` path check is an early-return guard that does not alter the existing control flow for valid paths.
- Build output (123 modules) matches the expected module count. No new TypeScript errors introduced.

## Summary

- Passed: 6
- Failed: 0
- Total: 6

All three security findings from round 1 have been correctly addressed. The fixes are minimal, well-placed, and follow the project's coding conventions (generic user-facing errors, console.error for details, TypeScript strict compliance). The migration SQL is well-formed and uses standard Supabase Storage patterns. No regressions detected.

**Recommendation:** Approve PR #3 for merge.
