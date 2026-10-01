import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

it('labels field errors for assistive technology', () => {
  render(<Input label="Email" error="Enter a valid email" />);
  const input = screen.getByLabelText('Email');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Enter a valid email');
});
it('keeps keyboard focus in the dialog and restores focus after Escape', () => {
  // jsdom does not perform layout. Treat mounted elements as visible for this test.
  const layout = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}]);
  function Example() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Open</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Payment">
        <input aria-label="Name" /><button>Save</button>
      </Modal></>;
  }
  document.body.style.overflow = 'auto';
  render(<Example />);
  const trigger = screen.getByText('Open');
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Payment' });
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  const close = screen.getByRole('button', { name: 'Close dialog' });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(screen.getByText('Save'));
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe('auto');
  layout.mockRestore();
});
