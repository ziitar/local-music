interface AlertProps {
  type: "error" | "success" | "info";
  message: string;
  className?: string;
}

const typeStyles: Record<string, string> = {
  error: "bg-red-500/20 text-red-400",
  success: "bg-green-500/20 text-green-400",
  info: "bg-blue-500/20 text-blue-400",
};

export function Alert({ type, message, className = "" }: AlertProps) {
  return (
    <div className={`p-3 rounded-md text-sm ${typeStyles[type]} ${className}`}>
      {message}
    </div>
  );
}
