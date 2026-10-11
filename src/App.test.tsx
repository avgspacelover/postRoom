import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./lib/supabase', () => ({ supabase: null }));

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Postroom composer', () => {
  it('shows readiness for selected platforms', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Ready to post?' })).toBeTruthy();
    expect(screen.getAllByText('Add some copy before continuing.')).toHaveLength(3);
  });

  it('inserts caption cues at the editor cursor and keeps existing copy', async () => {
    render(<App />);
    const textarea = screen.getByPlaceholderText('Start with the line you want people to notice…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'First thought.' } });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    fireEvent.click(screen.getByText('Caption toolkit'));
    fireEvent.click(screen.getByRole('button', { name: 'Opening line' }));

    await waitFor(() => expect(textarea.value).toBe('First thought.\n\nOpening line'));
  });

  it('prevents opening a destination when all copy and media are empty', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Open Instagram' })[0]);

    expect(screen.getByRole('status').textContent).toContain('Add some copy before continuing.');
    expect(open).not.toHaveBeenCalled();
  });
});
