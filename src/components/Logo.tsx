import { LineDotRightHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return <LineDotRightHorizontal className={cn("size-7", className)} />;
}
