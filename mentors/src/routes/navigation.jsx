import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  NotebookPen,
  Send,
  UserCircle,
  UserCheck,
  Users
} from "lucide-react";

export const mentorNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/modules", label: "Assigned Modules", icon: BookOpen },
  { href: "/students", label: "Assigned Mentees", icon: Users },
  { href: "/forum", label: "Forum", icon: MessageSquareText },
  { href: "/session-work", label: "Session Work", icon: NotebookPen },
  { href: "/attendance", label: "Attendance", icon: ClipboardList },
  { href: "/reminders", label: "Reminders", icon: Send },
  { href: "/reviews", label: "Review Submissions", icon: ClipboardCheck },
  { href: "/availability", label: "Availability", icon: CalendarClock },
  { href: "/bookings", label: "Bookings", icon: UserCheck },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/beta-feedback", label: "Beta Feedback", icon: MessageSquareText },
  { href: "/profile", label: "Profile", icon: UserCircle }
];
