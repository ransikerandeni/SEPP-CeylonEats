import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Star, Utensils, Leaf, Flame, X, ShieldCheck } from 'lucide-react';
import type { Dish } from './types';
import { spiceNames } from './api';
export function FoodImage({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className={`image-fallback ${className}`} role="img" aria-label={alt}>
      <Utensils size={36} />
      <span>At the table</span>
    </div>
  );
}
export function Rating({ value, count }: { value: string | number | null; count?: number }) {
  return (
    <span className="rating">
      <Star size={14} fill="currentColor" />
      {value === null ? 'New' : Number(value).toFixed(1)}
      {count !== undefined && <span className="rating-count">({count})</span>}
    </span>
  );
}
export function DietTags({ dish }: { dish: Dish }) {
  return (
    <div className="tags">
      {dish.vegan ? (
        <span>
          <Leaf size={12} />
          Vegan
        </span>
      ) : dish.vegetarian ? (
        <span>
          <Leaf size={12} />
          Vegetarian
        </span>
      ) : null}
      {dish.halal && (
        <span>
          <ShieldCheck size={12} />
          Halal
        </span>
      )}
      <span className={dish.spice === 3 ? 'hot' : ''}>
        <Flame size={12} />
        {spiceNames[dish.spice]}
      </span>
    </div>
  );
}
export function Message({ text, error = false }: { text: string; error?: boolean }) {
  return text ? (
    <div role={error ? 'alert' : 'status'} className={`message ${error ? 'error' : ''}`}>
      {text}
    </div>
  ) : null;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = original;
    };
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} aria-labelledby="modal-title">
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
