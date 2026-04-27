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
