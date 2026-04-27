# Auth & Public Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase email/password auth (single admin role) plus a public "suggest a location" flow whose submissions are gated through an admin review queue.

**Architecture:** One-table data model (`locations.status` ∈ `pending|approved|rejected`). RLS keys off `auth.uid()` for admin / `status='approved'` for public. The same `AddLocationForm` is used for both admin add and public suggest, with a mode-picker step and conditional copy. A new right-side `ReviewQueuePanel` lets admin approve/reject/edit-and-approve pending rows. Photo uploads are downsized client-side before hitting Supabase Storage.

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react, Leaflet/react-leaflet, Supabase (`@supabase/supabase-js`), Turf.js. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-27-auth-and-suggestions-design.md`

**Sequencing constraint:** SQL migrations must be additive (with safe defaults) before any client work, so existing data and the in-flight client keep working. RLS is **NOT** enabled until the very last task, after the client is fully ready for the new visibility model. Tasks 1 and 19+ are manual (run by the project owner in the Supabase dashboard); everything in between is code.

---

## Phase 1 — Database & Auth Foundation

### Task 1: Apply additive schema migration

**Files:**
- Create: `src/sql/2026-04-27-01-add-suggestion-columns.sql`

**This is a manual step — the project owner runs the SQL in the Supabase SQL Editor.** RLS is intentionally NOT enabled here (Task 19 does that, after the client is ready).

- [ ] **Step 1: Write the migration script**

```sql
-- 2026-04-27-01-add-suggestion-columns.sql
-- Additive schema migration. Safe to run on production data.
-- Adds suggestion-tracking columns to locations.
-- Does NOT enable RLS (see 2026-04-27-02 for that).

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitter_name text,
  ADD COLUMN IF NOT EXISTS submitter_phone text,
  ADD COLUMN IF NOT EXISTS submitter_email text,
  ADD COLUMN IF NOT EXISTS suggestion_mode text
    CHECK (suggestion_mode IN ('owner', 'third_party')),
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS locations_status_idx ON locations(status);
```

- [ ] **Step 2: Project owner runs the SQL in Supabase Dashboard**

Supabase Dashboard → SQL Editor → paste contents of `src/sql/2026-04-27-01-add-suggestion-columns.sql` → Run.

Expected: success, no rows changed (only schema), all existing rows have `status='approved'` via the column default.

- [ ] **Step 3: Verify**

In Supabase Table Editor, open `locations` and confirm:
- New columns exist: `status`, `submitter_name`, `submitter_phone`, `submitter_email`, `suggestion_mode`, `review_notes`.
- Every existing row shows `status = approved`.

- [ ] **Step 4: Commit the SQL file**

```bash
git add src/sql/2026-04-27-01-add-suggestion-columns.sql
git commit -m "db: add status and submitter columns to locations"
```

---

### Task 2: Create the `useAuth` hook (TDD)

**Files:**
- Create: `src/hooks/useAuth.js`
- Test: `src/hooks/useAuth.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useAuth.test.js`:

```js
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/supabase', () => {
  const listeners = [];
  const fakeAuth = {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn((cb) => {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    __emit: (event, session) => listeners.forEach((cb) => cb(event, session)),
  };
  return { supabase: { auth: fakeAuth } };
});

import useAuth from './useAuth';
import { supabase } from '../config/supabase';

describe('useAuth', () => {
  beforeEach(() => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.signInWithPassword.mockReset();
    supabase.auth.signOut.mockReset();
  });

  it('starts loading, then resolves with no session', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });

  it('reflects an existing session as admin', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'a@b.c' } } },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user.email).toBe('a@b.c');
    expect(result.current.isAdmin).toBe(true);
  });

  it('signIn calls signInWithPassword and returns error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login' },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned;
    await act(async () => {
      returned = await result.current.signIn('a@b.c', 'wrong');
    });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.c',
      password: 'wrong',
    });
    expect(returned.error).toEqual({ message: 'Invalid login' });
  });

  it('signOut calls supabase.auth.signOut', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signOut();
    });
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('updates state when supabase emits SIGNED_IN', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    act(() => {
      supabase.auth.__emit('SIGNED_IN', { user: { id: 'u2', email: 'x@y.z' } });
    });
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user.email).toBe('x@y.z');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/hooks/useAuth.test.js
```

Expected: fails with "Cannot find module './useAuth'" or similar.

- [ ] **Step 3: Implement useAuth**

Create `src/hooks/useAuth.js`:

```js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export default function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      cancelled = true;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const user = session?.user ?? null;
  return { session, user, isAdmin: !!user, loading, signIn, signOut };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/hooks/useAuth.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.js src/hooks/useAuth.test.js
git commit -m "feat: add useAuth hook for Supabase session handling"
```

---

### Task 3: Sign-in modal component

**Files:**
- Create: `src/components/SignInModal.jsx`
- Create: `src/components/SignInModal.css`
- Test: `src/components/SignInModal.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/SignInModal.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SignInModal from './SignInModal';

describe('SignInModal', () => {
  it('does not render when open=false', () => {
    render(<SignInModal open={false} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it('renders email and password fields when open', () => {
    render(<SignInModal open={true} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('calls onSubmit with email and password', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: null });
    render(<SignInModal open={true} onSubmit={onSubmit} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onSubmit).toHaveBeenCalledWith('a@b.c', 'pw');
  });

  it('shows inline error message on failed submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: { message: 'Invalid' } });
    render(<SignInModal open={true} onSubmit={onSubmit} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    render(<SignInModal open={true} onSubmit={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/components/SignInModal.test.jsx
```

Expected: fails (module missing).

- [ ] **Step 3: Implement SignInModal**

Create `src/components/SignInModal.jsx`:

```jsx
import { useState } from 'react';
import './SignInModal.css';

export default function SignInModal({ open, onSubmit, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(email, password);
      if (result?.error) {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signin-overlay" role="dialog" aria-modal="true">
      <form className="signin-modal" onSubmit={handleSubmit}>
        <h3>Admin sign in</h3>

        <div className="form-field">
          <label htmlFor="signin-email">Email</label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="signin-error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="signin-submit-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="signin-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

Create `src/components/SignInModal.css`:

```css
.signin-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.signin-modal {
  background: var(--panel-bg);
  color: var(--text-primary);
  padding: 24px;
  border-radius: 8px;
  width: 320px;
  font-family: var(--font);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.signin-modal h3 {
  margin: 0 0 18px;
  font-size: 18px;
  font-weight: 600;
}

.signin-modal .form-field {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.signin-modal label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.signin-modal input {
  background: var(--panel-bg-raised);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  padding: 8px 10px;
  border-radius: 4px;
  font: inherit;
}

.signin-error {
  background: #4a1f1f;
  color: #ffb4b4;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 12px;
}

.signin-modal .form-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.signin-submit-btn,
.signin-cancel-btn {
  flex: 1;
  padding: 9px 0;
  border-radius: 4px;
  border: none;
  font: inherit;
  cursor: pointer;
}

.signin-submit-btn {
  background: var(--accent, #c47e3e);
  color: white;
}

.signin-cancel-btn {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--panel-border);
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/components/SignInModal.test.jsx
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/SignInModal.jsx src/components/SignInModal.css src/components/SignInModal.test.jsx
git commit -m "feat: add admin sign-in modal"
```

---

### Task 4: Sign-in corner button + auth state badge

**Files:**
- Create: `src/components/SignInButton.jsx`
- Create: `src/components/SignInButton.css`
- Test: `src/components/SignInButton.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/SignInButton.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SignInButton from './SignInButton';

describe('SignInButton', () => {
  it('renders sign-in label when not signed in', () => {
    render(<SignInButton user={null} onSignInClick={() => {}} onSignOutClick={() => {}} />);
    expect(screen.getByRole('button', { name: /admin sign in/i })).toBeInTheDocument();
  });

  it('calls onSignInClick when clicked while signed out', async () => {
    const onSignInClick = vi.fn();
    render(<SignInButton user={null} onSignInClick={onSignInClick} onSignOutClick={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /admin sign in/i }));
    expect(onSignInClick).toHaveBeenCalled();
  });

  it('shows email and sign-out button when signed in', () => {
    render(
      <SignInButton
        user={{ email: 'admin@share.org' }}
        onSignInClick={() => {}}
        onSignOutClick={() => {}}
      />
    );
    expect(screen.getByText(/admin@share\.org/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('calls onSignOutClick when sign out clicked', async () => {
    const onSignOutClick = vi.fn();
    render(
      <SignInButton
        user={{ email: 'admin@share.org' }}
        onSignInClick={() => {}}
        onSignOutClick={onSignOutClick}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOutClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/components/SignInButton.test.jsx
```

Expected: fails.

- [ ] **Step 3: Implement SignInButton**

Create `src/components/SignInButton.jsx`:

```jsx
import './SignInButton.css';

export default function SignInButton({ user, onSignInClick, onSignOutClick }) {
  if (user) {
    return (
      <div className="signin-badge">
        <span className="signin-badge-email">✓ {user.email}</span>
        <button type="button" className="signin-badge-logout" onClick={onSignOutClick}>
          Sign out
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="signin-button" onClick={onSignInClick}>
      🔒 Admin sign in
    </button>
  );
}
```

Create `src/components/SignInButton.css`:

```css
.signin-button,
.signin-badge {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 1500;
  font-family: var(--font);
  font-size: 13px;
  border-radius: 6px;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.signin-button {
  padding: 8px 14px;
  border: 1px solid var(--panel-border);
  cursor: pointer;
}

.signin-button:hover {
  background: var(--panel-bg-raised);
}

.signin-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--panel-border);
}

.signin-badge-email {
  color: var(--text-muted);
  font-size: 12px;
}

.signin-badge-logout {
  background: transparent;
  border: none;
  color: var(--accent, #c47e3e);
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-decoration: underline;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/components/SignInButton.test.jsx
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/SignInButton.jsx src/components/SignInButton.css src/components/SignInButton.test.jsx
git commit -m "feat: add sign-in corner button and admin badge"
```

---

### Task 5: Wire auth into App.jsx (sign-in entry only — no gating yet)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add auth state and modal/button rendering**

Edit `src/App.jsx`:

Add imports near the top:

```jsx
import useAuth from './hooks/useAuth';
import SignInButton from './components/SignInButton';
import SignInModal from './components/SignInModal';
```

Inside the `App` function, after `const [editingLocation, setEditingLocation] = useState(null);`, add:

```jsx
const { user, isAdmin, loading: authLoading, signIn, signOut } = useAuth();
const [showSignInModal, setShowSignInModal] = useState(false);
```

In the loading branch, also wait for auth:

Replace:
```jsx
  if (loading) {
```
with:
```jsx
  if (loading || authLoading) {
```

Just before the closing `</div>` of the returned JSX (right after the `{showEditForm && ...}` block), insert:

```jsx
      <SignInButton
        user={user}
        onSignInClick={() => setShowSignInModal(true)}
        onSignOutClick={signOut}
      />

      <SignInModal
        open={showSignInModal}
        onSubmit={async (email, password) => {
          const result = await signIn(email, password);
          if (!result.error) setShowSignInModal(false);
          return result;
        }}
        onClose={() => setShowSignInModal(false)}
      />
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open the app in the browser. Verify:
1. A "🔒 Admin sign in" button appears bottom-right.
2. Clicking it opens the modal.
3. Wrong credentials show "Invalid email or password."
4. After Task 18 creates an admin user, you can sign in and the badge replaces the button.

For now, since no admin user exists yet, just verify the modal opens, closes on Cancel, and shows an error on a wrong-credential attempt.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire sign-in modal and corner button into App"
```

---

## Phase 2 — Suggestion Submission (Public Path)

### Task 6: Image downsize utility (TDD)

**Files:**
- Create: `src/utils/downsizeImage.js`
- Test: `src/utils/downsizeImage.test.js`

The downsize function takes a `File`, draws it to an offscreen canvas at the resized dimensions, and returns a JPEG `Blob` ≤ 2 MB. Steps below mock canvas/Image because jsdom does not implement them; we test the calculation logic separately.

- [ ] **Step 1: Write the failing test**

Create `src/utils/downsizeImage.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { calcResizedDimensions, MAX_EDGE_PX } from './downsizeImage';

describe('calcResizedDimensions', () => {
  it('returns original dimensions when smaller than max edge', () => {
    expect(calcResizedDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales down landscape image so width = MAX_EDGE_PX', () => {
    const r = calcResizedDimensions(3200, 2400);
    expect(r.width).toBe(MAX_EDGE_PX);
    expect(r.height).toBe(Math.round(MAX_EDGE_PX * (2400 / 3200)));
  });

  it('scales down portrait image so height = MAX_EDGE_PX', () => {
    const r = calcResizedDimensions(2400, 3200);
    expect(r.height).toBe(MAX_EDGE_PX);
    expect(r.width).toBe(Math.round(MAX_EDGE_PX * (2400 / 3200)));
  });

  it('keeps square image square at MAX_EDGE_PX', () => {
    const r = calcResizedDimensions(3000, 3000);
    expect(r.width).toBe(MAX_EDGE_PX);
    expect(r.height).toBe(MAX_EDGE_PX);
  });

  it('exposes MAX_EDGE_PX = 1600', () => {
    expect(MAX_EDGE_PX).toBe(1600);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/utils/downsizeImage.test.js
```

Expected: fails (module missing).

- [ ] **Step 3: Implement downsizeImage**

Create `src/utils/downsizeImage.js`:

```js
export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.85;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Compute resized dimensions preserving aspect ratio,
 * such that the longest edge is at most MAX_EDGE_PX.
 */
export function calcResizedDimensions(width, height) {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE_PX) return { width, height };
  const scale = MAX_EDGE_PX / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Downsize an image File to a JPEG Blob.
 * Throws if the resulting blob exceeds MAX_OUTPUT_BYTES.
 *
 * Browser-only (uses Image, canvas, FileReader). Not unit-tested directly
 * because jsdom doesn't implement canvas drawing.
 */
export async function downsizeImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const { width, height } = calcResizedDimensions(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  if (blob.size > MAX_OUTPUT_BYTES) {
    throw new Error('Image is too large after compression. Please choose a smaller image.');
  }

  return blob;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/utils/downsizeImage.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/downsizeImage.js src/utils/downsizeImage.test.js
git commit -m "feat: add client-side image downsize utility"
```

---

### Task 7: Rate-limit utility (TDD)

**Files:**
- Create: `src/utils/rateLimit.js`
- Test: `src/utils/rateLimit.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/utils/rateLimit.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordSubmission, hasExceededLimit, MAX_PER_HOUR, STORAGE_KEY } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes MAX_PER_HOUR = 3', () => {
    expect(MAX_PER_HOUR).toBe(3);
  });

  it('returns false when no submissions recorded', () => {
    expect(hasExceededLimit()).toBe(false);
  });

  it('returns false until MAX_PER_HOUR is reached', () => {
    for (let i = 0; i < MAX_PER_HOUR; i++) {
      expect(hasExceededLimit()).toBe(false);
      recordSubmission();
    }
    expect(hasExceededLimit()).toBe(true);
  });

  it('drops timestamps older than 1 hour', () => {
    const now = Date.now();
    const oneHourAndOneMinAgo = now - (60 * 60 * 1000 + 60 * 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([oneHourAndOneMinAgo, oneHourAndOneMinAgo, oneHourAndOneMinAgo])
    );
    expect(hasExceededLimit()).toBe(false);
  });

  it('survives malformed localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    expect(() => hasExceededLimit()).not.toThrow();
    expect(hasExceededLimit()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/utils/rateLimit.test.js
```

Expected: fails.

- [ ] **Step 3: Implement rateLimit**

Create `src/utils/rateLimit.js`:

```js
export const MAX_PER_HOUR = 3;
export const STORAGE_KEY = 'share-suggestion-submissions';
const HOUR_MS = 60 * 60 * 1000;

function readTimestamps() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function recentTimestamps() {
  const cutoff = Date.now() - HOUR_MS;
  return readTimestamps().filter((t) => t >= cutoff);
}

export function hasExceededLimit() {
  return recentTimestamps().length >= MAX_PER_HOUR;
}

export function recordSubmission() {
  const updated = [...recentTimestamps(), Date.now()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — fail open
  }
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/utils/rateLimit.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/utils/rateLimit.js src/utils/rateLimit.test.js
git commit -m "feat: add client-side suggestion rate limit"
```

---

### Task 8: Extend `supabase-locations.js` for suggestions

**Files:**
- Modify: `src/services/supabase-locations.js`

The existing `fetchUserLocations` returns only locations the client has SELECT access to. Once RLS is on (Task 19), anonymous users will see only `status='approved'`; admin will see everything. The mapping needs to surface `status`, `submitter_*`, `suggestion_mode`, and `review_notes` so the UI can branch.

We also need a separate insert path for public suggestions (sets `status='pending'` and the submitter fields) and approve/reject helpers used by the review queue.

- [ ] **Step 1: Update `fetchUserLocations` mapping**

Edit `src/services/supabase-locations.js`. Replace the entire `fetchUserLocations` function with:

```js
export async function fetchUserLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.warn('Failed to fetch user locations:', error.message);
    return [];
  }

  return (data || []).map((d) => ({
    id: `user-${d.id}`,
    supabaseId: d.id,
    source: 'user',
    status: d.status || 'approved',
    name: d.name,
    type: d.type || 'other',
    lat: d.lat,
    lng: d.lng,
    address: d.address || '',
    notes: d.notes || '',
    photo_url: d.photo_url || null,
    contact: {
      name: d.contact_name || '',
      phone: d.contact_phone || '',
      email: d.contact_email || '',
      website: d.contact_website || '',
    },
    suggestion_mode: d.suggestion_mode || null,
    submitter: {
      name: d.submitter_name || '',
      phone: d.submitter_phone || '',
      email: d.submitter_email || '',
    },
    review_notes: d.review_notes || '',
  }));
}
```

- [ ] **Step 2: Add `addSuggestion`, `approveSuggestion`, `rejectSuggestion`, `editAndApprove`**

Append to `src/services/supabase-locations.js`:

```js
/**
 * Insert a public suggestion. RLS enforces required submitter fields and status='pending'.
 */
export async function addSuggestion(payload) {
  const row = {
    name: payload.name,
    type: payload.type,
    lat: payload.lat,
    lng: payload.lng,
    address: payload.address || '',
    notes: payload.notes || '',
    contact_name: payload.contact_name || '',
    contact_phone: payload.contact_phone || '',
    contact_email: payload.contact_email || '',
    contact_website: payload.contact_website || '',
    submitter_name: payload.submitter_name,
    submitter_phone: payload.submitter_phone,
    submitter_email: payload.submitter_email,
    suggestion_mode: payload.suggestion_mode,
    photo_url: payload.photo_url || null,
    status: 'pending',
  };
  const { data, error } = await supabase.from('locations').insert([row]).select();
  if (error) throw error;
  return data;
}

/** Approve a pending suggestion: flip status to 'approved'. */
export async function approveSuggestion(id) {
  const { data, error } = await supabase
    .from('locations')
    .update({ status: 'approved' })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}

/** Reject a pending suggestion with a reason. */
export async function rejectSuggestion(id, reason) {
  const { data, error } = await supabase
    .from('locations')
    .update({ status: 'rejected', review_notes: reason })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}

/** Edit a pending suggestion's fields AND flip status to 'approved' in one update. */
export async function editAndApprove(id, updates) {
  const { data, error } = await supabase
    .from('locations')
    .update({ ...updates, status: 'approved' })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Modify `uploadPhoto` to accept a path prefix**

Replace the existing `uploadPhoto` with:

```js
/**
 * Upload a photo to the 'location-photos' storage bucket.
 * - prefix: 'pending' for public suggestions, 'approved' for admin adds.
 * Returns the public URL.
 */
export async function uploadPhoto(locationId, file, prefix = 'approved') {
  const path = `${prefix}/${locationId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('location-photos')
    .upload(path, file);
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('location-photos').getPublicUrl(path);
  return data.publicUrl;
}
```

- [ ] **Step 4: Manual smoke test (no automated test for this layer)**

```bash
npm run dev
```

Existing add-location flow still works (status defaults to 'approved'). Pin still appears on map after adding. We test the new helpers via the UI in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/services/supabase-locations.js
git commit -m "feat: add suggestion CRUD helpers and surface status/submitter fields"
```

---

### Task 9: AddLocationForm — public mode picker + isAdmin prop

**Files:**
- Modify: `src/components/AddLocationForm.jsx`
- Modify: `src/components/AddLocationForm.css`
- Test: `src/components/AddLocationForm.test.jsx`

This is the biggest behavioral change to the form. The form now accepts an `isAdmin` prop. When false (public), it first shows a two-button mode picker, then renders the field set with conditional copy and a required submitter section. When true, it skips the mode picker and submitter section entirely.

- [ ] **Step 1: Write the failing test**

Create `src/components/AddLocationForm.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AddLocationForm from './AddLocationForm';

describe('AddLocationForm — admin mode', () => {
  it('shows the form fields directly without a mode picker', () => {
    render(<AddLocationForm lat={47} lng={-122} isAdmin onSave={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/what kind of suggestion/i)).toBeNull();
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.queryByText(/your contact info/i)).toBeNull();
  });

  it('uses the title "Add New Location" when admin and no initialData', () => {
    render(<AddLocationForm lat={47} lng={-122} isAdmin onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: /add new location/i })).toBeInTheDocument();
  });
});

describe('AddLocationForm — public mode', () => {
  it('shows the mode picker first', () => {
    render(<AddLocationForm lat={47} lng={-122} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/what kind of suggestion/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^name/i)).toBeNull();
  });

  it('reveals the form after picking owner mode', async () => {
    render(<AddLocationForm lat={47} lng={-122} onSave={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /offering my own property/i }));
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
  });

  it('reveals the form after picking third-party mode with different copy', async () => {
    render(<AddLocationForm lat={47} lng={-122} onSave={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /property i know about/i }));
    expect(screen.getByText(/spoken to the owner/i)).toBeInTheDocument();
  });

  it('save is disabled until submitter fields are filled', async () => {
    const onSave = vi.fn();
    render(<AddLocationForm lat={47} lng={-122} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /offering my own property/i }));
    await userEvent.type(screen.getByLabelText(/^name/i), 'Test Place');
    expect(screen.getByRole('button', { name: /^send suggestion$/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/your name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/your phone/i), '206-555-1234');
    await userEvent.type(screen.getByLabelText(/your email/i), 'jane@example.com');
    expect(screen.getByRole('button', { name: /^send suggestion$/i })).toBeEnabled();
  });

  it('"Same as your contact above" copies submitter into property contact (owner mode)', async () => {
    render(<AddLocationForm lat={47} lng={-122} onSave={() => {}} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /offering my own property/i }));
    await userEvent.type(screen.getByLabelText(/your name/i), 'Jane Owner');
    await userEvent.type(screen.getByLabelText(/your phone/i), '555');
    await userEvent.type(screen.getByLabelText(/your email/i), 'j@o.c');
    await userEvent.click(screen.getByRole('button', { name: /same as your contact/i }));
    expect(screen.getByLabelText(/contact name/i)).toHaveValue('Jane Owner');
    expect(screen.getByLabelText(/^phone/i)).toHaveValue('555');
    expect(screen.getByLabelText(/^email/i)).toHaveValue('j@o.c');
  });

  it('passes suggestion_mode and submitter_* in onSave payload', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<AddLocationForm lat={47} lng={-122} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /offering my own property/i }));
    await userEvent.type(screen.getByLabelText(/^name/i), 'Test');
    await userEvent.type(screen.getByLabelText(/your name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/your phone/i), '206-555-1234');
    await userEvent.type(screen.getByLabelText(/your email/i), 'j@e.c');
    await userEvent.click(screen.getByRole('button', { name: /^send suggestion$/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test',
        suggestion_mode: 'owner',
        submitter_name: 'Jane',
        submitter_phone: '206-555-1234',
        submitter_email: 'j@e.c',
      })
    );
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/components/AddLocationForm.test.jsx
```

Expected: fails — admin tests may pass on existing component, public tests fail.

- [ ] **Step 3: Rewrite `AddLocationForm.jsx`**

Replace the entire contents of `src/components/AddLocationForm.jsx`:

```jsx
import { useState } from 'react';
import './AddLocationForm.css';

const LOCATION_TYPES = [
  { value: 'church', label: 'Church' },
  { value: 'community_center', label: 'Community Center' },
  { value: 'vacant_building', label: 'Vacant Building' },
  { value: 'public_facility', label: 'Public Facility' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
];

const COPY = {
  owner: {
    nameLabel: 'Name of your property',
    addressLabel: 'Address of your property',
    notesLabel: 'Anything SHARE should know — availability, capacity, restrictions',
    contactSection: 'Property contact (you)',
    contactHelp: 'Your contact info goes below — we\'ll use this since you ARE the property.',
  },
  third_party: {
    nameLabel: 'Name of the property (if known)',
    addressLabel: 'Address (or rough description if you don\'t know exactly)',
    notesLabel: 'Why do you think this place would work? Have you spoken to the owner?',
    contactSection: 'Property contact (if known)',
    contactHelp: 'If you know who owns or runs the place, fill this in. Leave blank if not.',
  },
};

export default function AddLocationForm({
  lat,
  lng,
  initialData,
  onSave,
  onCancel,
  isAdmin = false,
}) {
  const [mode, setMode] = useState(isAdmin ? 'admin' : initialData?.suggestion_mode || null);

  const [form, setForm] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'church',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    contact_name: initialData?.contact?.name || '',
    contact_phone: initialData?.contact?.phone || '',
    contact_email: initialData?.contact?.email || '',
    contact_website: initialData?.contact?.website || '',
    submitter_name: '',
    submitter_phone: '',
    submitter_email: '',
    honeypot: '', // bot trap, must remain empty
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function copySubmitterToContact() {
    setForm((prev) => ({
      ...prev,
      contact_name: prev.submitter_name,
      contact_phone: prev.submitter_phone,
      contact_email: prev.submitter_email,
    }));
  }

  const isPublic = !isAdmin;
  const submitterFilled =
    form.submitter_name.trim() &&
    form.submitter_phone.trim() &&
    form.submitter_email.trim();

  const canSubmit = form.name.trim() && (!isPublic || (mode && submitterFilled));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    if (form.honeypot) return; // bot
    setSaving(true);
    try {
      const payload = { ...form, photo, lat, lng };
      if (isPublic) payload.suggestion_mode = mode;
      delete payload.honeypot;
      await onSave(payload);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  // Public mode: show mode picker until selected
  if (isPublic && !mode) {
    return (
      <div className="add-location-form mode-picker">
        <h3>Suggest a Location</h3>
        <p className="mode-picker-prompt">What kind of suggestion is this?</p>
        <button
          type="button"
          className="mode-picker-btn"
          onClick={() => setMode('owner')}
        >
          🏠 I'm offering my own property
          <span className="mode-picker-sub">Church, building owner, etc.</span>
        </button>
        <button
          type="button"
          className="mode-picker-btn"
          onClick={() => setMode('third_party')}
        >
          📍 I want to suggest a property I know about
          <span className="mode-picker-sub">Place I drove past, vacant lot, etc.</span>
        </button>
        <button type="button" className="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  const copy = isPublic ? COPY[mode] : null;
  const title = isAdmin
    ? initialData
      ? 'Edit Location'
      : 'Add New Location'
    : mode === 'owner'
      ? 'Offer Your Property'
      : 'Suggest a Property';
  const submitLabel = isAdmin ? 'Save' : 'Send suggestion';

  return (
    <form className="add-location-form" onSubmit={handleSubmit}>
      <h3>{title}</h3>

      {/* Honeypot: hidden from users, visible to dumb bots */}
      <input
        type="text"
        name="honeypot"
        value={form.honeypot}
        onChange={handleChange}
        tabIndex={-1}
        autoComplete="off"
        style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      <div className="form-section-label">Location Details</div>

      <div className="form-field">
        <label htmlFor="loc-name">{isAdmin ? 'Name *' : `${copy.nameLabel} *`}</label>
        <input
          id="loc-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. First Baptist Church"
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-type">Type</label>
        <select id="loc-type" name="type" value={form.type} onChange={handleChange}>
          {LOCATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="loc-address">{isAdmin ? 'Address' : copy.addressLabel}</label>
        <input
          id="loc-address"
          name="address"
          value={form.address}
          onChange={handleChange}
          placeholder="e.g. 123 Main St, Seattle"
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-notes">{isAdmin ? 'Notes' : copy.notesLabel}</label>
        <textarea
          id="loc-notes"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder=""
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-photo">Photo</label>
        <input
          id="loc-photo"
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files[0] || null)}
        />
      </div>

      <div className="form-section-label">
        {isAdmin ? 'Contact Information' : copy.contactSection}
      </div>
      {!isAdmin && <p className="form-help">{copy.contactHelp}</p>}

      {!isAdmin && mode === 'owner' && (
        <button
          type="button"
          className="copy-from-submitter-btn"
          onClick={copySubmitterToContact}
        >
          Same as your contact above? Copy
        </button>
      )}

      <div className="form-field">
        <label htmlFor="loc-contact-name">Contact Name</label>
        <input
          id="loc-contact-name"
          name="contact_name"
          value={form.contact_name}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-contact-phone">Phone</label>
        <input
          id="loc-contact-phone"
          name="contact_phone"
          value={form.contact_phone}
          onChange={handleChange}
          placeholder="(206) 555-0123"
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-contact-email">Email</label>
        <input
          id="loc-contact-email"
          name="contact_email"
          type="email"
          value={form.contact_email}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="loc-contact-website">Website</label>
        <input
          id="loc-contact-website"
          name="contact_website"
          value={form.contact_website}
          onChange={handleChange}
          placeholder="https://"
        />
      </div>

      {isPublic && (
        <>
          <div className="form-section-label">Your Contact (required)</div>
          <p className="form-help">
            SHARE will reach out at your email to follow up on your suggestion.
          </p>

          <div className="form-field">
            <label htmlFor="sub-name">Your name *</label>
            <input
              id="sub-name"
              name="submitter_name"
              value={form.submitter_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="sub-phone">Your phone *</label>
            <input
              id="sub-phone"
              name="submitter_phone"
              value={form.submitter_phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="sub-email">Your email *</label>
            <input
              id="sub-email"
              name="submitter_email"
              type="email"
              value={form.submitter_email}
              onChange={handleChange}
              required
            />
          </div>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="form-save-btn" disabled={saving || !canSubmit}>
          {saving ? 'Sending...' : submitLabel}
        </button>
        <button type="button" className="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Add CSS for new elements**

Append to `src/components/AddLocationForm.css`:

```css
.mode-picker-prompt {
  color: var(--text-muted);
  font-size: 14px;
  margin: 6px 0 16px;
}

.mode-picker-btn {
  display: block;
  width: 100%;
  text-align: left;
  background: var(--panel-bg-raised);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  padding: 14px 16px;
  border-radius: 6px;
  margin-bottom: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
}

.mode-picker-btn:hover {
  border-color: var(--accent, #c47e3e);
}

.mode-picker-sub {
  display: block;
  color: var(--text-muted);
  font-weight: 400;
  font-size: 12px;
  margin-top: 2px;
}

.copy-from-submitter-btn {
  background: transparent;
  border: 1px dashed var(--panel-border);
  color: var(--text-muted);
  padding: 6px 10px;
  border-radius: 4px;
  font: inherit;
  font-size: 12px;
  margin-bottom: 10px;
  cursor: pointer;
}

.copy-from-submitter-btn:hover {
  color: var(--text-primary);
  border-style: solid;
}

.form-help {
  color: var(--text-muted);
  font-size: 12px;
  margin: -4px 0 10px;
  line-height: 1.4;
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
npm test -- src/components/AddLocationForm.test.jsx
```

Expected: 9 passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/AddLocationForm.jsx src/components/AddLocationForm.css src/components/AddLocationForm.test.jsx
git commit -m "feat: add public-mode suggestion picker and submitter section to form"
```

---

### Task 10: Wire suggestion submission into App.jsx

**Files:**
- Modify: `src/App.jsx`

The button label flips based on `isAdmin`. The save handler routes to `addSuggestion` (with photo downsize and rate limit) for public users, `addLocation` for admin.

- [ ] **Step 1: Update imports**

In `src/App.jsx`, update the supabase-locations import:

```jsx
import {
  addLocation,
  addSuggestion,
  updateLocation,
  deleteLocation,
  uploadPhoto,
} from './services/supabase-locations';
```

Add new imports:

```jsx
import { downsizeImage } from './utils/downsizeImage';
import { hasExceededLimit, recordSubmission } from './utils/rateLimit';
```

Add a state hook for the success modal near the other state:

```jsx
const [showSuggestionSuccess, setShowSuggestionSuccess] = useState(false);
```

- [ ] **Step 2: Replace `handleSaveNew` to route by auth**

Replace the entire `handleSaveNew` function with:

```jsx
async function handleSaveNew(data) {
  try {
    if (isAdmin) {
      const row = {
        name: data.name,
        type: data.type,
        lat: data.lat,
        lng: data.lng,
        address: data.address || '',
        notes: data.notes || '',
        contact_name: data.contact_name || '',
        contact_phone: data.contact_phone || '',
        contact_email: data.contact_email || '',
        contact_website: data.contact_website || '',
      };
      const result = await addLocation(row);
      const newId = result?.[0]?.id;
      if (data.photo && newId) {
        const photoUrl = await uploadPhoto(newId, data.photo, 'approved');
        await updateLocation(newId, { photo_url: photoUrl });
      }
      await refetchUserLocations();
      setAddCoords(null);
      setAddMode(false);
      return;
    }

    // Public path: suggestion
    if (hasExceededLimit()) {
      alert('You have submitted several suggestions recently. Please try again later.');
      return;
    }

    // Upload photo BEFORE the row insert (RLS forbids public UPDATE, so we can't
    // attach photo_url after the row exists — must include it in the INSERT payload).
    let photoUrl = null;
    if (data.photo) {
      try {
        const compressed = await downsizeImage(data.photo);
        const compressedFile = new File(
          [compressed],
          data.photo.name.replace(/\.[^.]+$/, '.jpg'),
          { type: 'image/jpeg' }
        );
        const tempId = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random()}`;
        photoUrl = await uploadPhoto(tempId, compressedFile, 'pending');
      } catch (err) {
        console.warn('Photo upload failed (continuing without photo):', err);
      }
    }

    const payload = {
      name: data.name,
      type: data.type,
      lat: data.lat,
      lng: data.lng,
      address: data.address || '',
      notes: data.notes || '',
      contact_name: data.contact_name || '',
      contact_phone: data.contact_phone || '',
      contact_email: data.contact_email || '',
      contact_website: data.contact_website || '',
      submitter_name: data.submitter_name,
      submitter_phone: data.submitter_phone,
      submitter_email: data.submitter_email,
      suggestion_mode: data.suggestion_mode,
      photo_url: photoUrl,
    };
    await addSuggestion(payload);
    recordSubmission();
    setAddCoords(null);
    setAddMode(false);
    setShowSuggestionSuccess(true);
  } catch (err) {
    console.error('Failed to save location:', err);
    alert('Could not save. Please try again.');
  }
}
```

Note: the comment in the handler explains why `photo_url` isn't written by public users — RLS only permits INSERT, not UPDATE. We accept this trade-off in v1; admin can re-attach the photo at review time. **If you change RLS later to allow public UPDATE on their own pending row by submitter_email match, this comment goes away.**

- [ ] **Step 3: Flip the Add/Suggest button label**

Find the JSX block:

```jsx
{addMode ? '✕ Cancel' : '+ Add Location'}
```

Replace with:

```jsx
{addMode ? '✕ Cancel' : isAdmin ? '+ Add Location' : '+ Suggest a Location'}
```

- [ ] **Step 4: Pass `isAdmin` to AddLocationForm and add success modal**

In the `{showAddForm && ...}` block, add the prop:

```jsx
{showAddForm && (
  <AddLocationForm
    lat={addCoords.lat}
    lng={addCoords.lng}
    isAdmin={isAdmin}
    onSave={handleSaveNew}
    onCancel={() => { setAddCoords(null); setAddMode(false); }}
  />
)}
```

In the `{showEditForm && ...}` block, also pass `isAdmin`:

```jsx
{showEditForm && (
  <AddLocationForm
    lat={editingLocation.lat}
    lng={editingLocation.lng}
    initialData={editingLocation}
    isAdmin={isAdmin}
    onSave={handleUpdate}
    onCancel={() => setEditingLocation(null)}
  />
)}
```

Just before the `<SignInButton />` block at the bottom, add a tiny success modal:

```jsx
{showSuggestionSuccess && (
  <div className="signin-overlay" role="dialog" aria-modal="true">
    <div className="signin-modal">
      <h3>Thanks!</h3>
      <p>Your suggestion has been sent. SHARE will review it and reach out by email.</p>
      <div className="form-actions">
        <button
          type="button"
          className="signin-submit-btn"
          onClick={() => setShowSuggestionSuccess(false)}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

While signed out:
1. Click "+ Suggest a Location" → click on map.
2. Mode picker appears. Pick "I'm offering my own property."
3. Form shows submitter section. Fill required fields. "Send suggestion" enables.
4. Submit. Get a success modal. Pin does NOT appear on map.
5. Verify in Supabase Table Editor: a new row with `status='pending'`, `suggestion_mode='owner'`, all submitter fields filled.

(After Task 19 enables RLS, this will fail until then because public INSERT will be blocked. For now it works because RLS is off.)

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: route suggestion vs add by auth state with success confirmation"
```

---

## Phase 3 — Admin Review Queue

### Task 11: RejectReasonModal component

**Files:**
- Create: `src/components/RejectReasonModal.jsx`
- Test: `src/components/RejectReasonModal.test.jsx`

Reuses `SignInModal.css` styles for visual consistency (no separate CSS file needed for v1).

- [ ] **Step 1: Write the failing test**

Create `src/components/RejectReasonModal.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RejectReasonModal from './RejectReasonModal';

describe('RejectReasonModal', () => {
  it('does not render when open=false', () => {
    render(<RejectReasonModal open={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByLabelText(/reason/i)).toBeNull();
  });

  it('disables confirm until reason has content', async () => {
    render(<RejectReasonModal open={true} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/reason/i), 'Spam');
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeEnabled();
  });

  it('calls onConfirm with the reason', async () => {
    const onConfirm = vi.fn();
    render(<RejectReasonModal open={true} onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/reason/i), 'Duplicate');
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(onConfirm).toHaveBeenCalledWith('Duplicate');
  });

  it('calls onCancel when cancel clicked', async () => {
    const onCancel = vi.fn();
    render(<RejectReasonModal open={true} onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/components/RejectReasonModal.test.jsx
```

- [ ] **Step 3: Implement RejectReasonModal**

Create `src/components/RejectReasonModal.jsx`:

```jsx
import { useState, useEffect } from 'react';
import './SignInModal.css';

export default function RejectReasonModal({ open, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="signin-overlay" role="dialog" aria-modal="true">
      <form
        className="signin-modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onConfirm(reason.trim());
        }}
      >
        <h3>Reject suggestion</h3>
        <div className="form-field">
          <label htmlFor="reject-reason">Reason</label>
          <input
            id="reject-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate, out of scope, spam"
            autoFocus
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="signin-submit-btn" disabled={!reason.trim()}>
            Reject
          </button>
          <button type="button" className="signin-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/components/RejectReasonModal.test.jsx
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/RejectReasonModal.jsx src/components/RejectReasonModal.test.jsx
git commit -m "feat: add reject-reason modal for review queue"
```

---

### Task 12: ReviewQueuePanel component

**Files:**
- Create: `src/components/ReviewQueuePanel.jsx`
- Create: `src/components/ReviewQueuePanel.css`
- Test: `src/components/ReviewQueuePanel.test.jsx`

The panel is presentational: it receives a `pending` array and four action callbacks. Wiring to Supabase happens in App.jsx.

- [ ] **Step 1: Write the failing test**

Create `src/components/ReviewQueuePanel.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ReviewQueuePanel from './ReviewQueuePanel';

const SAMPLE = [
  {
    id: 'user-1',
    supabaseId: 1,
    name: 'St. Mark Church',
    type: 'church',
    address: '123 Pine St',
    notes: 'Has a basement available',
    suggestion_mode: 'owner',
    submitter: { name: 'Pastor Joe', phone: '206-555-0001', email: 'joe@stmark.org' },
    photo_url: null,
  },
  {
    id: 'user-2',
    supabaseId: 2,
    name: 'Empty Lot',
    type: 'vacant_building',
    address: '5th & Pike',
    notes: 'Big empty space',
    suggestion_mode: 'third_party',
    submitter: { name: 'Anon', phone: '555', email: 'a@b.c' },
    photo_url: null,
  },
];

describe('ReviewQueuePanel', () => {
  it('shows empty state when no pending', () => {
    render(
      <ReviewQueuePanel
        pending={[]}
        onView={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEditApprove={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/no pending suggestions/i)).toBeInTheDocument();
  });

  it('renders one card per pending row with submitter info', () => {
    render(
      <ReviewQueuePanel
        pending={SAMPLE}
        onView={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEditApprove={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('St. Mark Church')).toBeInTheDocument();
    expect(screen.getByText(/pastor joe/i)).toBeInTheDocument();
    expect(screen.getByText('Empty Lot')).toBeInTheDocument();
  });

  it('shows the right mode badge per row', () => {
    render(
      <ReviewQueuePanel
        pending={SAMPLE}
        onView={() => {}}
        onApprove={() => {}}
        onReject={() => {}}
        onEditApprove={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
    expect(screen.getByText(/third-party/i)).toBeInTheDocument();
  });

  it('calls onApprove with the row when Approve clicked', async () => {
    const onApprove = vi.fn();
    render(
      <ReviewQueuePanel
        pending={SAMPLE.slice(0, 1)}
        onView={() => {}}
        onApprove={onApprove}
        onReject={() => {}}
        onEditApprove={() => {}}
        onClose={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(onApprove).toHaveBeenCalledWith(SAMPLE[0]);
  });

  it('calls onView with the row when View clicked', async () => {
    const onView = vi.fn();
    render(
      <ReviewQueuePanel
        pending={SAMPLE.slice(0, 1)}
        onView={onView}
        onApprove={() => {}}
        onReject={() => {}}
        onEditApprove={() => {}}
        onClose={() => {}}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /view on map/i }));
    expect(onView).toHaveBeenCalledWith(SAMPLE[0]);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
npm test -- src/components/ReviewQueuePanel.test.jsx
```

- [ ] **Step 3: Implement ReviewQueuePanel**

Create `src/components/ReviewQueuePanel.jsx`:

```jsx
import './ReviewQueuePanel.css';

const MODE_LABEL = {
  owner: '🏠 Owner',
  third_party: '📍 Third-party',
};

export default function ReviewQueuePanel({
  pending,
  onView,
  onApprove,
  onReject,
  onEditApprove,
  onClose,
}) {
  return (
    <div className="review-queue-panel">
      <button className="review-close" onClick={onClose} aria-label="Close review queue">
        &times;
      </button>
      <h3>Pending Suggestions</h3>

      {pending.length === 0 && (
        <div className="review-empty">No pending suggestions. 🎉</div>
      )}

      {pending.map((row) => (
        <div className="review-card" key={row.id}>
          <div className="review-card-header">
            <span className="review-card-name">{row.name}</span>
            <span className="review-mode-badge">
              {MODE_LABEL[row.suggestion_mode] || row.suggestion_mode}
            </span>
          </div>

          <div className="review-card-meta">
            <div>{row.type.replace(/_/g, ' ')}</div>
            {row.address && <div>{row.address}</div>}
          </div>

          {row.notes && <div className="review-card-notes">{row.notes}</div>}

          {row.photo_url && (
            <a href={row.photo_url} target="_blank" rel="noopener noreferrer">
              <img className="review-card-photo" src={row.photo_url} alt="" />
            </a>
          )}

          <div className="review-card-submitter">
            <div className="review-section-label">Submitter</div>
            <div>{row.submitter?.name}</div>
            <div>{row.submitter?.phone}</div>
            <div>{row.submitter?.email}</div>
          </div>

          <div className="review-card-actions">
            <button onClick={() => onView(row)}>View on map</button>
            <button className="review-approve" onClick={() => onApprove(row)}>Approve</button>
            <button className="review-reject" onClick={() => onReject(row)}>Reject</button>
            <button onClick={() => onEditApprove(row)}>Edit & Approve</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/ReviewQueuePanel.css`:

```css
.review-queue-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 380px;
  height: 100vh;
  z-index: 1000;
  overflow-y: auto;
  padding: 20px;
  background: var(--panel-bg);
  color: var(--text-primary);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.5);
  font-family: var(--font);
}

.review-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  cursor: pointer;
}

.review-queue-panel h3 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.review-empty {
  color: var(--text-muted);
  font-size: 14px;
  padding: 40px 0;
  text-align: center;
}

.review-card {
  background: var(--panel-bg-raised);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.review-card-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.review-card-name {
  font-weight: 600;
  font-size: 15px;
}

.review-mode-badge {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.review-card-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin: 4px 0 8px;
}

.review-card-notes {
  font-size: 13px;
  white-space: pre-wrap;
  margin-bottom: 8px;
}

.review-card-photo {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 8px;
}

.review-section-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 4px;
}

.review-card-submitter {
  font-size: 12px;
  background: var(--panel-bg);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.review-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.review-card-actions button {
  flex: 1 0 auto;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.review-card-actions button:hover {
  background: var(--panel-bg-raised);
}

.review-approve {
  background: #2d4a2d !important;
  border-color: #4a7a4a !important;
}

.review-reject {
  background: #4a2d2d !important;
  border-color: #7a4a4a !important;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
npm test -- src/components/ReviewQueuePanel.test.jsx
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReviewQueuePanel.jsx src/components/ReviewQueuePanel.css src/components/ReviewQueuePanel.test.jsx
git commit -m "feat: add admin review queue panel"
```

---

### Task 13: Wire review queue into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports and state**

Update the supabase-locations import to include the new helpers:

```jsx
import {
  addLocation,
  addSuggestion,
  approveSuggestion,
  rejectSuggestion,
  editAndApprove,
  updateLocation,
  deleteLocation,
  uploadPhoto,
} from './services/supabase-locations';
```

Add new imports:

```jsx
import ReviewQueuePanel from './components/ReviewQueuePanel';
import RejectReasonModal from './components/RejectReasonModal';
```

Inside `App()`, add state:

```jsx
const [showReviewQueue, setShowReviewQueue] = useState(false);
const [rejectingRow, setRejectingRow] = useState(null);
```

- [ ] **Step 2: Derive `pendingLocations` from scoredLocations**

Right after the `filteredLocations` definition, add:

```jsx
const pendingLocations = scoredLocations.filter(
  (loc) => loc.source === 'user' && loc.status === 'pending'
);
```

- [ ] **Step 3: Add review handlers**

Add these handlers above the `if (loading || authLoading)` early return:

```jsx
async function handleApprove(row) {
  if (!window.confirm(`Approve "${row.name}"?`)) return;
  try {
    await approveSuggestion(row.supabaseId);
    await refetchUserLocations();
  } catch (err) {
    console.error('Approve failed:', err);
  }
}

async function handleRejectConfirm(reason) {
  if (!rejectingRow) return;
  try {
    await rejectSuggestion(rejectingRow.supabaseId, reason);
    await refetchUserLocations();
  } catch (err) {
    console.error('Reject failed:', err);
  } finally {
    setRejectingRow(null);
  }
}

function handleViewOnMap(row) {
  setSelectedLocation(row);
  setShowReviewQueue(false);
}

function handleEditApprove(row) {
  setEditingLocation(row);
  setShowReviewQueue(false);
}
```

- [ ] **Step 4: Modify `handleUpdate` to flip status when editing a pending row**

Replace the `handleUpdate` function with:

```jsx
async function handleUpdate(data) {
  if (!editingLocation) return;
  try {
    const supabaseId = editingLocation.supabaseId;
    const updates = {
      name: data.name,
      type: data.type,
      address: data.address || '',
      notes: data.notes || '',
      contact_name: data.contact_name || '',
      contact_phone: data.contact_phone || '',
      contact_email: data.contact_email || '',
      contact_website: data.contact_website || '',
    };
    if (data.photo) {
      const photoUrl = await uploadPhoto(supabaseId, data.photo, 'approved');
      updates.photo_url = photoUrl;
    }
    if (editingLocation.status === 'pending') {
      await editAndApprove(supabaseId, updates);
    } else {
      await updateLocation(supabaseId, updates);
    }
    await refetchUserLocations();
    setEditingLocation(null);
    setSelectedLocation(null);
  } catch (err) {
    console.error('Failed to update location:', err);
  }
}
```

- [ ] **Step 5: Add the admin queue button and panel rendering**

Right after the existing `+ Add Location` / `+ Suggest Location` button block, add the admin-only pending button:

```jsx
{isAdmin && (
  <button
    className="add-location-toggle"
    style={{ top: 56 }}
    onClick={() => setShowReviewQueue((s) => !s)}
  >
    📋 Pending ({pendingLocations.length})
  </button>
)}
```

Just before the `{showSuggestionSuccess && ...}` block, add:

```jsx
{isAdmin && showReviewQueue && (
  <ReviewQueuePanel
    pending={pendingLocations}
    onView={handleViewOnMap}
    onApprove={handleApprove}
    onReject={(row) => setRejectingRow(row)}
    onEditApprove={handleEditApprove}
    onClose={() => setShowReviewQueue(false)}
  />
)}

<RejectReasonModal
  open={!!rejectingRow}
  onConfirm={handleRejectConfirm}
  onCancel={() => setRejectingRow(null)}
/>
```

- [ ] **Step 6: Manual smoke test**

(RLS still off — works freely for now.) Run `npm run dev`. Sign out (refresh if needed) and submit a suggestion via the public flow. Then sign in (you'll create the admin user in Task 18 — for now use any user you create manually in Supabase Dashboard → Authentication → Add user). Click `📋 Pending (1)`. The panel shows the suggestion. Click Approve, confirm, see it become a normal pin. Submit another, click Reject, type a reason, confirm — check Supabase that `status='rejected'` and `review_notes='<reason>'`.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire admin review queue with approve/reject/edit-approve"
```

---

## Phase 4 — Visibility Polish

### Task 14: Pending pin styling for admin (MapView)

**Files:**
- Modify: `src/components/MapView.jsx`

Pending pins render with a dashed white outline and the standard score-color fill, but at lower opacity, so admin can distinguish them from approved pins at a glance.

- [ ] **Step 1: Modify the pin rendering in MapView**

In `src/components/MapView.jsx`, find the `{scoredLocations.map((loc) => { ... })}` block. Replace the `<CircleMarker .../>` JSX with:

```jsx
{scoredLocations.map((loc) => {
  const isSelected = selectedLocation && selectedLocation.id === loc.id;
  const isPending = loc.status === 'pending';
  return (
    <CircleMarker
      key={loc.id}
      center={[loc.lat, loc.lng]}
      radius={8}
      fillColor={loc.color}
      fillOpacity={isPending ? 0.35 : isSelected ? 1 : 0.8}
      color={isSelected ? '#000' : isPending ? '#fff' : '#fff'}
      weight={isSelected ? 3 : 2}
      dashArray={isPending ? '4 3' : null}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          if (onPinClick) onPinClick(loc);
        },
      }}
    >
      <Tooltip>
        {loc.name} — {loc.score}
        {isPending ? ' (pending)' : ''}
      </Tooltip>
    </CircleMarker>
  );
})}
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Sign in as admin. With at least one pending suggestion in the DB, verify a dashed-outline, lower-opacity pin appears at the suggestion's coordinates. Tooltip says "(pending)". After approving it via the queue, the pin's style flips to normal.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView.jsx
git commit -m "feat: render pending suggestion pins with distinct admin-only style"
```

---

### Task 15: Sidebar — gate edit/delete by isAdmin

**Files:**
- Modify: `src/App.jsx`

Currently the Sidebar shows Edit/Delete on any user-source pin (regardless of auth). After RLS goes on, those calls would fail anyway, but we should hide them so the public UI is clean.

- [ ] **Step 1: Add `isAdmin` guard to Sidebar's onEdit/onDelete props**

In `src/App.jsx`, find the `<Sidebar ... />` block. Replace it with:

```jsx
{showSidebar && (
  <Sidebar
    location={selectedLocation}
    onClose={() => setSelectedLocation(null)}
    onEdit={isAdmin && selectedLocation.source === 'user' ? () => setEditingLocation(selectedLocation) : undefined}
    onDelete={isAdmin && selectedLocation.source === 'user' ? () => handleDelete(selectedLocation) : undefined}
  />
)}
```

- [ ] **Step 2: Manual smoke test**

Sign out: click any user-source pin → no Edit/Delete buttons appear in the sidebar. Sign in: same pin shows Edit/Delete.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: gate sidebar edit/delete by admin auth state"
```

---

### Task 16: Refetch user locations on auth state change

**Files:**
- Modify: `src/App.jsx`

When admin signs in, the visibility set changes (pending rows become visible). When they sign out, those rows should disappear. Refetch when `isAdmin` changes.

- [ ] **Step 1: Add an effect**

In `src/App.jsx`, near the other `useEffect`, add:

```jsx
useEffect(() => {
  refetchUserLocations();
}, [isAdmin, refetchUserLocations]);
```

- [ ] **Step 2: Manual smoke test**

Sign in: pending pins appear (dashed). Sign out (Sign-out button): pending pins disappear.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: refetch user locations when admin auth state changes"
```

---

### Task 17: Hide Sidebar contact-edit when signed out

**Files:**
- Modify: `src/components/Sidebar.jsx`

The existing "Edit Contact" button on API-sourced pins calls `upsertContactOverride`, which after RLS is on will fail for anonymous users. Hide it.

- [ ] **Step 1: Pass isAdmin into Sidebar**

In `src/App.jsx`, in the `<Sidebar>` block, add `isAdmin={isAdmin}`:

```jsx
{showSidebar && (
  <Sidebar
    location={selectedLocation}
    isAdmin={isAdmin}
    onClose={() => setSelectedLocation(null)}
    onEdit={isAdmin && selectedLocation.source === 'user' ? () => setEditingLocation(selectedLocation) : undefined}
    onDelete={isAdmin && selectedLocation.source === 'user' ? () => handleDelete(selectedLocation) : undefined}
  />
)}
```

- [ ] **Step 2: Gate the contact-edit button**

In `src/components/Sidebar.jsx`, change the function signature:

```jsx
export default function Sidebar({ location, isAdmin = false, onClose, onEdit, onDelete }) {
```

Find the block:

```jsx
{/* Inline contact editing for API-sourced locations */}
{source !== 'user' && !editingContact && (
  <button className="sidebar-contact-edit" onClick={startContactEdit}>
    Edit Contact
  </button>
)}
```

Replace with:

```jsx
{isAdmin && source !== 'user' && !editingContact && (
  <button className="sidebar-contact-edit" onClick={startContactEdit}>
    Edit Contact
  </button>
)}
```

- [ ] **Step 3: Manual smoke test**

Sign out, click an API-sourced pin (church) → no "Edit Contact" button. Sign in, same pin → button appears.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx
git commit -m "feat: gate sidebar contact-edit by admin auth"
```

---

## Phase 5 — Lock Down

### Task 18: Create admin user in Supabase Dashboard

**This is a manual step.**

- [ ] **Step 1: Project owner creates the admin auth user**

In Supabase Dashboard → Authentication → Users → "Add user" → "Create new user":
- Email: (Michele's email, or your test email for now)
- Password: (a known password)
- Auto Confirm User: ✅ (so no confirmation email is needed)
- Click Create User.

- [ ] **Step 2: Verify sign-in works in the app**

```bash
npm run dev
```

Click "🔒 Admin sign in" → enter the credentials → modal closes → corner badge shows the email. Click "Sign out" → button returns. No code changes needed.

---

### Task 19: Enable RLS and add policies

**Files:**
- Create: `src/sql/2026-04-27-02-enable-rls.sql`

**This is a manual step.** This is the "go-live" gate. Once you run it, anonymous users are restricted to viewing approved rows and inserting only well-formed pending rows.

- [ ] **Step 1: Write the policies file**

Create `src/sql/2026-04-27-02-enable-rls.sql`:

```sql
-- 2026-04-27-02-enable-rls.sql
-- Enables RLS on locations + contact_overrides and adds policies.

-- locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read approved or admin" ON locations;
CREATE POLICY "read approved or admin" ON locations
  FOR SELECT
  USING (status = 'approved' OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public submits pending" ON locations;
CREATE POLICY "public submits pending" ON locations
  FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND submitter_name IS NOT NULL AND length(trim(submitter_name)) > 0
    AND submitter_phone IS NOT NULL AND length(trim(submitter_phone)) > 0
    AND submitter_email IS NOT NULL AND length(trim(submitter_email)) > 0
    AND suggestion_mode IN ('owner', 'third_party')
  );

DROP POLICY IF EXISTS "admin all" ON locations;
CREATE POLICY "admin all" ON locations
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- contact_overrides
ALTER TABLE contact_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public reads overrides" ON contact_overrides;
CREATE POLICY "public reads overrides" ON contact_overrides
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin writes overrides" ON contact_overrides;
CREATE POLICY "admin writes overrides" ON contact_overrides
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

- [ ] **Step 2: Project owner runs the SQL**

Supabase Dashboard → SQL Editor → paste contents → Run.

- [ ] **Step 3: Configure storage bucket**

Supabase Dashboard → Storage → `location-photos` bucket → Policies:

Add a SELECT policy "public reads photos":
```sql
CREATE POLICY "public reads photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'location-photos');
```

Add an INSERT policy "public uploads to pending":
```sql
CREATE POLICY "public uploads to pending" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'location-photos'
    AND (storage.foldername(name))[1] = 'pending'
  );
```

Add an ALL policy "admin manages photos":
```sql
CREATE POLICY "admin manages photos" ON storage.objects FOR ALL
  USING (bucket_id = 'location-photos' AND auth.uid() IS NOT NULL)
  WITH CHECK (bucket_id = 'location-photos' AND auth.uid() IS NOT NULL);
```

In the bucket settings, set: file size limit = `5242880` (5 MB), allowed MIME types = `image/jpeg, image/png, image/webp`.

- [ ] **Step 4: Commit the SQL file**

```bash
git add src/sql/2026-04-27-02-enable-rls.sql
git commit -m "db: enable RLS and policies for locations, contact_overrides, photos"
```

---

### Task 20: End-to-end smoke test

**No code changes — this is a manual verification of the full flow.**

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Public path**

In an Incognito window (no session):
1. Map loads. ONLY approved pins visible. No pending pins.
2. Click "+ Suggest a Location" → mode picker appears.
3. Pick "Offering my own property" → form with submitter section. Fill all required fields. Click "Same as your contact above? Copy" → property contact fills.
4. Attach a > 5 MB photo → confirm it gets downsized (check Network tab: the upload is < 2 MB).
5. Click "Send suggestion". Success modal.
6. Refresh: no new pin on the map (still pending).
7. Try submitting 4 times in a row: 4th should be blocked by rate limit alert.
8. Try submitting with submitter_email blank: HTML required validation blocks it.
9. Open DevTools console: confirm no RLS errors, no key leaks.

- [ ] **Step 3: Admin path**

Same window, sign in as admin:
1. Click "🔒 Admin sign in" → enter credentials → badge shows email.
2. Pending pin appears with dashed outline.
3. "📋 Pending (1)" button appears top-right. Click → review panel.
4. Click "View on map" — map flies to pin, panel closes.
5. Reopen panel, click "Approve". Confirm. Pin becomes normal.
6. Submit another suggestion (sign out first or use a second window).
7. Sign back in. Click "Reject" — modal asks for reason. Type "duplicate". Confirm.
8. In Supabase Table Editor: row has `status='rejected'`, `review_notes='duplicate'`.
9. Submit a third suggestion. As admin, click "Edit & Approve" — form opens pre-filled. Change a field. Save. Row's `status` is now `approved`, the edit was applied, and submitter fields preserved.
10. Test "+ Add Location" as admin: no mode picker, no submitter section. Saves directly as approved.
11. Sign out. Pending pins gone.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Final commit and push**

```bash
git status   # should be clean
git push github-school main
```

---

## Self-Review Notes

- Spec coverage: Tasks 1–20 cover §3 (Auth Setup), §4 (Schema + RLS + Storage), §5 (Public path), §6 (Admin sign-in), §7 (Review queue), and §5.4 (spam mitigation). The "out of scope" list in spec §8 is honored — no email notifications, no rejected-view, no captcha.
- Placeholder scan: every task contains complete code in code blocks. The note in Task 10 about photo_url for public submissions is an acknowledged design trade-off, not a placeholder.
- Type/name consistency: `addSuggestion`, `approveSuggestion`, `rejectSuggestion`, `editAndApprove` are defined in Task 8 and consumed in Tasks 10 and 13. `useAuth` returns `{ session, user, isAdmin, loading, signIn, signOut }` consistently. `submitter` (object with name/phone/email) used in mapping (Task 8) and ReviewQueuePanel (Task 12).
- Note for the implementer: this codebase has a separate `ControlSidebar` component referenced in `App.jsx` that may not yet exist on disk. Do not reorganize control panels in this work — the auth and suggestion changes should be additive to whatever the current `App.jsx` shape is.
