import { useEffect, useRef, type ReactNode } from "react";

interface InfiniteScrollProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  children: ReactNode;
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
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, rootMargin]);

  return (
    <>
      {children}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      {hasMore ? loader : endMessage}
    </>
  );
}
