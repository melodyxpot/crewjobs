"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Briefcase,
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Plus,
  ClipboardPaste,
  MessagesSquare,
  Building2,
  CalendarDays,
  Globe,
  UserCheck,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth-context"
import { useUnreadMessages } from "@/components/message-notifications"
import { ROLE_LABELS, type AuthUser } from "@/lib/types"

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Applications", href: "/applications", icon: FileText },
  { title: "Remote Jobs", href: "/jobs", icon: Globe },
  { title: "Workspaces", href: "/workspaces", icon: Building2 },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Messages", href: "/chat", icon: MessagesSquare },
]

interface AppSidebarProps {
  user: AuthUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const unread = useUnreadMessages()
  const canApprove = user.isSuperAdmin || user.role === "leader"
  const showSettings = user.isSuperAdmin || user.role === "leader"
  const items = [
    ...navItems,
    ...(canApprove ? [{ title: "People", href: "/people", icon: UserCheck }] : []),
    ...(showSettings ? [{ title: "Settings", href: "/settings", icon: Settings }] : []),
  ]

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Briefcase className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">crewjobs</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-2 px-2">
              <Button asChild size="sm" className="justify-start">
                <Link href="/applications">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Application
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start bg-transparent">
                <Link href="/applications">
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  Quick Paste
                </Link>
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.href === "/chat" && unread > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <div className="flex h-8 w-10 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
                {(user.username || user.email)?.charAt(0).toUpperCase()}
              </div>
              <span className="ml-2 min-w-0 text-left">
                <span className="block truncate text-sm">{user.username || user.email}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.isSuperAdmin
                    ? "Superadmin"
                    : ROLE_LABELS[user.role] || user.role || "Member"}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {showSettings && (
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
            )}
            {showSettings && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
