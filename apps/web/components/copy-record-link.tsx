"use client"

import { Link2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { copyRecordLink, type RecordKind } from "@/lib/record-link"
import { cn } from "@/lib/utils"

export function CopyRecordLink({
  kind,
  id,
  variant = "outline",
  size = "sm",
  className,
  label = "Copy link",
}: {
  kind: RecordKind
  id: string
  variant?: "outline" | "ghost"
  size?: "sm" | "icon"
  className?: string
  label?: string
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      aria-label={label}
      onClick={async (event) => {
        event.stopPropagation()
        event.preventDefault()
        try {
          await copyRecordLink(kind, id)
          toast.success("Link copied")
        } catch {
          toast.error("Could not copy the link")
        }
      }}
    >
      <Link2 className={cn("h-4 w-4", size !== "icon" && "mr-2")} />
      {size === "icon" ? <span className="sr-only">{label}</span> : label}
    </Button>
  )
}
