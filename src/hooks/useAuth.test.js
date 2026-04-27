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
