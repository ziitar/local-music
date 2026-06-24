import { ArrowLeft } from "lucide-react";
import { Button } from "./Button.tsx";

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className = "" }: BackButtonProps) {
  return (
    <Button
      variant="ghost"
      onClick={() => window.history.back()}
      className={`mb-3 sm:mb-4 ${className}`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      <span className="hidden sm:inline">返回</span>
    </Button>
  );
}
