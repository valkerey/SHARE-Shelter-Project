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
