interface LoadMoreButtonProps {
  hasMore: boolean;
  isLoading: boolean;
  onClick(): void;
}

export function LoadMoreButton({
  hasMore,
  isLoading,
  onClick,
}: LoadMoreButtonProps) {
  if (!hasMore) return null;
  return (
    <button
      className="load-more-button"
      disabled={isLoading}
      onClick={onClick}
      type="button"
    >
      {isLoading ? "加载中…" : "加载更多"}
    </button>
  );
}
