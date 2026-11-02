import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Bell,
  MessageSquareText,
  MessageCircleQuestion,
  TrendingUp,
  UserCircle
} from "lucide-react";

export const studentNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/materials", label: "Learn", icon: BookOpen, group: "learning", groupLabel: "Learning" },
  { href: "/app/assignments", label: "Assignments", icon: ClipboardList, group: "learning" },
  { href: "/app/progress", label: "Progress", icon: TrendingUp, group: "learning" },
  { href: "/app/certificates", label: "Certificates", icon: GraduationCap, group: "learning" },
  { href: "/app/questions", label: "Mentor Questions", icon: MessageCircleQuestion, group: "connect", groupLabel: "Connect" },
  { href: "/app/forum", label: "Forum", icon: MessageSquareText, group: "connect" },
  { href: "/app/bookings", label: "Mentor Booking", icon: CalendarCheck, group: "connect" },
  { href: "/app/notifications", label: "Notifications", icon: Bell, group: "account", groupLabel: "Account" },
  { href: "/app/profile", label: "Profile", icon: UserCircle, group: "account" },
  { href: "/app/support", label: "Support", icon: LifeBuoy, group: "help", groupLabel: "Help" }
];
