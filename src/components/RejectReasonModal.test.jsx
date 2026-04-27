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
