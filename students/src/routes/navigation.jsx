import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  LifeBuoy,
  Bell,
  MessageSquareText,
  TrendingUp
} from "lucide-react";

export const studentNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/materials", label: "Learning Materials", icon: BookOpen },
  { href: "/app/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/app/progress", label: "My Progress", icon: TrendingUp },
  { href: "/app/bookings", label: "Mentor Booking", icon: CalendarCheck },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/beta-feedback", label: "Beta Feedback", icon: MessageSquareText },
  { href: "/app/support", label: "Support", icon: LifeBuoy }
];
