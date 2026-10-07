import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, ClipboardPaste } from "lucide-react"

export function DashboardActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <Link href="/applications?add=true">
          <Plus className="mr-2 h-4 w-4" />
          Add Application
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/applications?quickpaste=true">
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Quick Paste
        </Link>
      </Button>
    </div>
  )
}
