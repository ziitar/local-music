interface LoadingStateProps {
  className?: string;
}

export function LoadingState({ className = "" }: LoadingStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>加载中...</div>
  );
}
