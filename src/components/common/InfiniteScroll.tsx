import { useEffect, useRef, type ReactNode } from "react";

interface InfiniteScrollProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  children: ReactNode;
  /**
   * Scroll container the sentinel is watched inside. Defaults to the viewport,
   * which is right for a whole page; pass the element when the list scrolls in
   * its own box, otherwise `rootMargin` expands the viewport — not the box —
   * and the next page only loads once the sentinel is fully in view.
   */
  root?: Element | null;
  /** Distance (px) before the sentinel enters view to trigger a load. */
  rootMargin?: string;
  loader?: ReactNode;
  endMessage?: ReactNode;
}

export function InfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  children,
  root = null,
  rootMargin = "300px",
  loader,
  endMessage,
}: InfiniteScrollProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { root, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, root, rootMargin]);

  return (
    <>
      {children}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      {hasMore ? loader : endMessage}
    </>
  );
}
