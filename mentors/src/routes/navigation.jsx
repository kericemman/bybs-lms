import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  NotebookPen,
  Send,
  UserCheck,
  Users
} from "lucide-react";

export const mentorNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Assigned Students", icon: Users },
  { href: "/session-work", label: "Session Work", icon: NotebookPen },
  { href: "/reminders", label: "Reminders", icon: Send },
  { href: "/reviews", label: "Review Submissions", icon: ClipboardCheck },
  { href: "/availability", label: "Availability", icon: CalendarClock },
  { href: "/bookings", label: "Bookings", icon: UserCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/beta-feedback", label: "Beta Feedback", icon: MessageSquareText }
];
