# Auth & Public Suggestions — Design Spec

**Date:** 2026-04-27
**Status:** Draft
**Project:** SHARE Shelter Site Map (GEOG 469)

## 1. Goal

Add minimal authentication so a single SHARE admin (Michele) can manage shelter site data, while letting anonymous public visitors view the approved map and submit suggested locations for admin review.

## 2. Roles & Capabilities

| Capability | Public (logged out) | Admin (logged in) |
|---|---|---|
| View approved locations on map | ✅ | ✅ |
| View pending suggestions on map | ❌ | ✅ (distinct style) |
| Add a location directly | ❌ | ✅ |
| Edit / delete a location | ❌ | ✅ |
| Suggest a new location | ✅ (creates `status='pending'` row) | n/a (uses Add instead) |
| Review pending suggestions | ❌ | ✅ |
| Approve / reject / edit-and-approve suggestion | ❌ | ✅ |

There is exactly one role: **admin**. Any authenticated user is an admin. No self-signup. Accounts are created manually in the Supabase dashboard.

## 3. Auth Setup

- **Provider:** Supabase Auth, email/password.
- **User provisioning:** create users manually in `Authentication → Users → Add user` with a known email and password. No invite emails, no signup screen in the app.
- **No `profiles` table / role column.** The presence of `auth.uid()` is the admin signal. If multiple admins are needed later, just create another auth user.
- **No password reset UI.** If a user forgets their password, the project owner resets it from the Supabase dashboard.
- **Session:** Supabase default — `localStorage`-backed, auto-refresh. User stays logged in until they explicitly sign out.

## 4. Data Model

### 4.1 `locations` table changes

```sql
ALTER TABLE locations
  ADD COLUMN status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN submitter_name text,
  ADD COLUMN submitter_phone text,
  ADD COLUMN submitter_email text,
  ADD COLUMN suggestion_mode text
    CHECK (suggestion_mode IN ('owner', 'third_party')),
  ADD COLUMN review_notes text;

CREATE INDEX locations_status_idx ON locations(status);
```

- Existing rows backfill to `status = 'approved'` via the column default.
- `submitter_*`, `suggestion_mode`, `review_notes` are NULL on admin-added rows.
- `review_notes` populated on reject (one-line reason from admin); also nullable elsewhere.

### 4.2 Row-Level Security

RLS must be **enabled** on `locations` (currently disabled — this is part of the work). Same posture applied to `contact_overrides`.

```sql
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Public can read approved rows; admin can read all rows
CREATE POLICY "read approved or admin" ON locations
  FOR SELECT
  USING (status = 'approved' OR auth.uid() IS NOT NULL);

-- Public can insert pending rows that have submitter contact filled
CREATE POLICY "public submits pending" ON locations
  FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND submitter_name IS NOT NULL AND length(trim(submitter_name)) > 0
    AND submitter_phone IS NOT NULL AND length(trim(submitter_phone)) > 0
    AND submitter_email IS NOT NULL AND length(trim(submitter_email)) > 0
    AND suggestion_mode IN ('owner', 'third_party')
  );

-- Admin has full access
CREATE POLICY "admin all" ON locations
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE contact_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads overrides" ON contact_overrides
  FOR SELECT USING (true);
CREATE POLICY "admin writes overrides" ON contact_overrides
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
```

### 4.3 Storage (location-photos bucket)

The existing `location-photos` bucket needs RLS-equivalent policies so anonymous submitters can upload photos with their suggestions.

- **Public INSERT** allowed only into the `pending/` prefix, with bucket-level file size limit of 5 MB (Supabase setting) and image-only mime types. The 5 MB ceiling is a backstop — the client always downsizes to ≤ 2 MB before upload (see §5.3); the larger bucket limit only matters if the client cap is bypassed.
- **Public SELECT** allowed (photo URLs are public).
- **Admin** can INSERT, UPDATE, DELETE anywhere in the bucket.
- On approval the photo file is *not* moved out of `pending/` — only the `status` flag changes; admin can rename later if desired. Simplifies the approve action.

## 5. Frontend — Public Path

### 5.1 Add/Suggest button

The existing top-right action button changes label by auth state:
- Logged out: `+ Suggest a Location`
- Logged in: `+ Add Location`

The click flow is identical: enter "place pin" mode → click on the map → form opens with lat/lng pre-filled.

### 5.2 Suggestion form (public, two-mode)

When a logged-out user reaches the form, the **first step is a two-button mode picker**:

> *"What kind of suggestion is this?"*
> - 🏠 I'm offering my own property
> - 📍 I want to suggest a property I know about

Until a mode is selected, the rest of the form stays hidden. Once selected, the same field set appears, but **instructional copy varies by mode**:

| Field | Owner mode copy | Third-party mode copy |
|---|---|---|
| Name | "Name of your property" | "Name of the property (if known)" |
| Address | "Address of your property" | "Address (or rough description if you don't know exactly)" |
| Notes | "Anything SHARE should know about availability, capacity, restrictions" | "Why do you think this place would work? Have you spoken to the owner?" |
| Property contact | "Your contact info goes below — we'll use that since you ARE the property" | "If you know who owns/runs the place, fill in their contact here. Leave blank if not." |

**Submitter contact (always required, both modes):**
- Your name *
- Your phone *
- Your email *
- Helper text: *"SHARE will reach out at this email to follow up on your suggestion."*

In **owner mode**, a small `Same as your contact above? [Copy]` button auto-fills the property-contact section from the submitter-contact section.

**Submission:**
1. Insert one row into `locations` with `status='pending'`, `suggestion_mode`, all submitter_* and contact_* fields.
2. If a photo was attached: downsize, upload to `location-photos/pending/<row-id>/...`, then update the row with `photo_url`.
3. Show success modal: *"Thanks! Your suggestion has been sent. SHARE will review it and reach out at \<email>."*
4. Reset form. The pin does NOT appear on the public map.

### 5.3 Photo handling

- Optional. Image-only mime types (`image/jpeg`, `image/png`, `image/webp`).
- **Client-side downsize before upload** (canvas-based, pure browser):
  - Resize so the longest edge is ≤ 1600px (preserve aspect ratio).
  - Re-encode as JPEG at quality 0.85.
  - If final file is still > 2 MB, reject and prompt user to choose another image.
- Upload path: `location-photos/pending/<row-id>/<timestamp>-<safe-name>.jpg`.

### 5.4 Spam mitigation (lightweight, v1)

- RLS enforces required submitter contact + `status='pending'`.
- Honeypot field (hidden input, real users won't fill it; submission silently dropped if filled).
- Client-side rate limit via `localStorage`: max 3 submissions per browser per hour.
- Bucket size + mime restrictions per §4.3.
- No CAPTCHA in v1. Revisit if abuse appears.

## 6. Frontend — Admin Path

### 6.1 Sign-in entry point

A small fixed-position button in the **bottom-right corner** of the map:
- Logged out: `🔒 Admin sign in`
- Logged in: `✓ Signed in as <email> · Sign out`

Click → sign-in modal (centered overlay): email, password, Submit, Cancel. On error: inline message "Invalid email or password." On success: modal closes, app re-renders with admin powers.

### 6.2 Admin-only surfaces

When `isAdmin === true`:
- Add button: `+ Add Location` (no two-mode picker, no submitter section)
- Sidebar: edit/delete buttons appear on user-source pins (existing behavior, now properly gated)
- New corner button: `📋 Pending (<count>)` — opens review queue panel
- Pending pins render on the map with a distinct style (dashed outline + amber-grey fill) so they're visually separable from approved pins
- ContactOverrides edits enabled (existing behavior, now properly gated)

### 6.3 Auth hook

A `useAuth()` hook returns `{ session, user, isAdmin, signIn, signOut, loading }`.
- Wraps `supabase.auth.getSession()` and subscribes to `supabase.auth.onAuthStateChange()`.
- `isAdmin = !!user` (one role).
- `<App>` waits for `loading === false` before rendering routes/UI to avoid a flash of public state for an already-signed-in admin.

## 7. Admin Review Queue

### 7.1 Where it lives

A right-side panel (same width and visual treatment as the existing `Sidebar`), opened from the `📋 Pending` corner button.

### 7.2 Queue list

Newest first. Each card shows:
- Property name, type, address
- Mode badge: 🏠 Owner / 📍 Third-party
- Submitter: name, phone, email
- Notes (truncated, expandable)
- Photo thumbnail if any
- Actions: **View on map** · **Approve** · **Reject** · **Edit & Approve**

### 7.3 Actions

- **View on map** — pans/zooms to the pin (reuses existing pin-click handler). Queue panel stays open.
- **Approve** — confirm → `UPDATE locations SET status='approved' WHERE id=...`. Pin becomes a normal approved pin.
- **Reject** — modal asking for a one-line reason → `UPDATE locations SET status='rejected', review_notes=$reason`. Pin disappears from admin's view.
- **Edit & Approve** — opens AddLocationForm pre-filled with the suggestion data (admin form, no submitter section). Save → updates fields AND flips `status` to `approved` in one update. Submitter-contact / suggestion_mode fields are preserved (audit trail).

### 7.4 Empty state

`"No pending suggestions. 🎉"`

## 8. Out of Scope (deferred to later phases)

- Email notifications to admin or submitter (Resend integration). Domain verification cost is the current blocker.
- Re-opening rejected suggestions, or a "rejected" view in the admin queue.
- Search/sort/filter inside the queue.
- Multiple admin roles (e.g., reviewer vs. super-admin).
- Password-reset UI.
- CAPTCHA.
- Audit log beyond `review_notes` and the preserved submitter fields on approved rows.

## 9. Implementation Notes

- Existing components affected: `App.jsx` (auth state, gating, button labels), `AddLocationForm.jsx` (mode picker, submitter section, conditional copy), `Sidebar.jsx` (edit/delete only when admin), `MapView.jsx` (pending-pin styling for admin), `useDataLoader.js` (filters by status + auth), `services/supabase-locations.js` (insert pending vs. approved, fetch pending, approve/reject/edit-approve helpers).
- New components: `SignInModal.jsx`, `SignInButton.jsx`, `ReviewQueuePanel.jsx`, `RejectReasonModal.jsx`.
- New hook: `useAuth.js`.
- New util: `downsizeImage.js` (canvas-based resize/encode).
- Schema migrations: written as plain SQL the project owner runs in Supabase SQL editor (no migration framework needed — small project).
- The recently-merged `ControlSidebar` (combining LayerPanel and PriorityPanel) is unaffected by this work but should remain consistent stylistically with the new ReviewQueuePanel.

## 10. Open Questions

None at design time. Implementation may surface tactical questions; those go in the implementation plan.
