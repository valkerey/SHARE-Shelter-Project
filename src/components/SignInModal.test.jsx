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

  it('clears error and fields when modal is reopened', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ error: { message: 'fail' } });
    const { rerender } = render(
      <SignInModal open={true} onSubmit={onSubmit} onClose={() => {}} />
    );
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c');
    await userEvent.type(screen.getByLabelText(/password/i), 'pw');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    rerender(<SignInModal open={false} onSubmit={onSubmit} onClose={() => {}} />);
    rerender(<SignInModal open={true} onSubmit={onSubmit} onClose={() => {}} />);
    expect(screen.queryByText(/invalid email or password/i)).toBeNull();
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
  });
});
