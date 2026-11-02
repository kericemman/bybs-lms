import {
  BookOpen,
  Bell,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  MessageCircleQuestion,
  NotebookPen,
  Send,
  UserCircle,
  UserCheck,
  Users
} from "lucide-react";

export const mentorNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Assigned Mentees", icon: Users, group: "learners", groupLabel: "Learners" },
  { href: "/questions", label: "Mentee Questions", icon: MessageCircleQuestion, group: "learners" },
  { href: "/modules", label: "Assigned Modules", icon: BookOpen, group: "teaching", groupLabel: "Teaching" },
  { href: "/session-work", label: "Session Work", icon: NotebookPen, group: "teaching" },
  { href: "/reviews", label: "Review Submissions", icon: ClipboardCheck, group: "teaching" },
  { href: "/attendance", label: "Attendance", icon: ClipboardList, group: "teaching" },
  { href: "/availability", label: "Availability", icon: CalendarClock, group: "schedule", groupLabel: "Schedule" },
  { href: "/bookings", label: "Bookings", icon: UserCheck, group: "schedule" },
  { href: "/forum", label: "Forum", icon: MessageSquareText, group: "communication", groupLabel: "Communication" },
  { href: "/reminders", label: "Reminders", icon: Send, group: "communication" },
  { href: "/notifications", label: "Notifications", icon: Bell, group: "account", groupLabel: "Account" },
  { href: "/reports", label: "Reports", icon: FileText, group: "account" },
  { href: "/profile", label: "Profile", icon: UserCircle, group: "account" }
];
