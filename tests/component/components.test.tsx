import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DietTags, FoodImage, Message, Modal, Rating } from '../../src/components';
import { makeDish } from './helpers';

describe('FoodImage', () => {
  it('renders a lazily loaded image with its alt text when a source is given', () => {
    render(<FoodImage src="/images/kottu.jpg" alt="A plate of kottu" className="hero" />);
    const img = screen.getByRole('img', { name: 'A plate of kottu' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/images/kottu.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveClass('hero');
  });

  it('renders a labelled fallback when the source is empty', () => {
    render(<FoodImage src="" alt="A plate of kottu" className="hero" />);
    const fallback = screen.getByRole('img', { name: 'A plate of kottu' });
    expect(fallback.tagName).toBe('DIV');
    expect(fallback).toHaveClass('image-fallback', 'hero');
    expect(fallback).toHaveTextContent('At the table');
  });

  it('switches to the fallback when the image fails to load', () => {
    render(<FoodImage src="/broken.jpg" alt="Hoppers" />);
    fireEvent.error(screen.getByRole('img', { name: 'Hoppers' }));
    expect(screen.getByRole('img', { name: 'Hoppers' }).tagName).toBe('DIV');
    expect(screen.getByText('At the table')).toBeInTheDocument();
  });

  it('tries the image again when the source changes after a failure', () => {
    const { rerender } = render(<FoodImage src="/broken.jpg" alt="Hoppers" />);
    fireEvent.error(screen.getByRole('img', { name: 'Hoppers' }));
    rerender(<FoodImage src="/hoppers.jpg" alt="Hoppers" />);
    const img = screen.getByRole('img', { name: 'Hoppers' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', '/hoppers.jpg');
  });
});

describe('Rating', () => {
  it('shows New when there is no rating yet', () => {
    const { container } = render(<Rating value={null} />);
    expect(container).toHaveTextContent(/^New$/);
  });

  it.each([
    [4, '4.0'],
    [4.25, '4.3'],
    ['3.456', '3.5'],
    ['5', '5.0'],
  ])('formats %j to one decimal place as %s', (value, expected) => {
    const { container } = render(<Rating value={value} />);
    expect(container).toHaveTextContent(new RegExp(`^${expected.replace('.', '\\.')}$`));
  });

  it('shows the review count in parentheses when provided', () => {
    render(<Rating value="4.2" count={12} />);
    expect(screen.getByText('(12)')).toHaveClass('rating-count');
  });

  it('shows a count of zero rather than hiding it', () => {
    render(<Rating value={null} count={0} />);
    expect(screen.getByText('(0)')).toBeInTheDocument();
  });

  it('omits the count when none is provided', () => {
    const { container } = render(<Rating value={3} />);
    expect(container.querySelector('.rating-count')).toBeNull();
  });
});

describe('DietTags', () => {
  it('labels a vegan dish as Vegan only, even though it is also vegetarian', () => {
    render(<DietTags dish={makeDish({ vegan: true, vegetarian: true })} />);
    expect(screen.getByText('Vegan')).toBeInTheDocument();
    expect(screen.queryByText('Vegetarian')).not.toBeInTheDocument();
  });

  it('labels a vegetarian dish that is not vegan as Vegetarian', () => {
    render(<DietTags dish={makeDish({ vegetarian: true })} />);
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.queryByText('Vegan')).not.toBeInTheDocument();
  });

  it('shows no diet label for a dish that is neither vegetarian nor vegan', () => {
    render(<DietTags dish={makeDish()} />);
    expect(screen.queryByText(/Vegan|Vegetarian/)).not.toBeInTheDocument();
  });

  it('shows the Halal tag only for halal dishes', () => {
    const { rerender } = render(<DietTags dish={makeDish({ halal: true })} />);
    expect(screen.getByText('Halal')).toBeInTheDocument();
    rerender(<DietTags dish={makeDish({ halal: false })} />);
    expect(screen.queryByText('Halal')).not.toBeInTheDocument();
  });

  it.each([
    [0, 'Not spicy'],
    [1, 'Mild'],
    [2, 'Medium'],
    [3, 'Hot'],
  ])('names spice level %i as %s', (spice, label) => {
    render(<DietTags dish={makeDish({ spice })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('highlights only the hottest spice level', () => {
    const { rerender } = render(<DietTags dish={makeDish({ spice: 3 })} />);
    expect(screen.getByText('Hot')).toHaveClass('hot');
    rerender(<DietTags dish={makeDish({ spice: 2 })} />);
    expect(screen.getByText('Medium')).not.toHaveClass('hot');
  });
});

describe('Message', () => {
  it('renders nothing when the text is empty', () => {
    const { container } = render(<Message text="" error />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces informational text politely as a status', () => {
    render(<Message text="Saved." />);
    const message = screen.getByRole('status');
    expect(message).toHaveTextContent('Saved.');
    expect(message).not.toHaveClass('error');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces errors assertively as an alert with the error style', () => {
    render(<Message text="Something broke." error />);
    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Something broke.');
    expect(message).toHaveClass('message', 'error');
  });
});

describe('Modal', () => {
  it('opens as a modal dialog labelled by its title', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(
      <Modal title="Share your experience" onClose={() => {}}>
        <p>Body content</p>
      </Modal>,
    );
    expect(showModal).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole('dialog', { name: 'Share your experience' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveTextContent('Body content');
    showModal.mockRestore();
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the dialog is cancelled with Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Edit" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks page scrolling while open and restores the previous value on unmount', () => {
    document.body.style.overflow = 'scroll';
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    const { unmount } = render(
      <Modal title="Edit" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
    document.body.style.overflow = '';
  });
});
