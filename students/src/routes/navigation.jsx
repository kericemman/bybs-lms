import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Bell,
  MessageSquareText,
  TrendingUp,
  UserCircle
} from "lucide-react";

export const studentNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/materials", label: "Learning Materials", icon: BookOpen },
  { href: "/app/forum", label: "Forum", icon: MessageSquareText },
  { href: "/app/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/app/progress", label: "My Progress", icon: TrendingUp },
  { href: "/app/certificates", label: "Certificates", icon: GraduationCap },
  { href: "/app/bookings", label: "Mentor Booking", icon: CalendarCheck },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/profile", label: "Profile", icon: UserCircle },
  { href: "/app/support", label: "Support", icon: LifeBuoy }
];
