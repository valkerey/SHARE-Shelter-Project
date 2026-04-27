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
