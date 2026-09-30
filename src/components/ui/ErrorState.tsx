import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Failed to load data",
  message,
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-rose-200/80 bg-rose-50/40 p-8 flex flex-col items-center justify-center text-center",
        className
      )}
    >
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-rose-100/80 text-rose-700 mb-3">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-rose-950">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-rose-800 leading-relaxed">
        {message}
      </p>
      {retry && (
        <div className="mt-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={retry}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Retry request
          </Button>
        </div>
      )}
    </div>
  );
}
