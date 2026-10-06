import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Reveals its children once they scroll into view.
 *
 * Uses IntersectionObserver and unobserves after the first trigger, so sections
 * animate in once rather than flickering on every scroll past.
 */
export default function Reveal({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={visible ? "reveal is-visible" : "reveal"}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
