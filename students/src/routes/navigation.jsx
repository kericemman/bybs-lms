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
  { href: "/app/materials", label: "Learn", icon: BookOpen },
  { href: "/app/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/app/questions", label: "Mentor Questions", icon: MessageCircleQuestion },
  { href: "/app/progress", label: "Progress", icon: TrendingUp },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/profile", label: "Profile", icon: UserCircle },
  { href: "/app/forum", label: "Forum", icon: MessageSquareText, group: "more", groupLabel: "More" },
  { href: "/app/bookings", label: "Mentor Booking", icon: CalendarCheck, group: "more", groupLabel: "More" },
  { href: "/app/certificates", label: "Certificates", icon: GraduationCap, group: "more", groupLabel: "More" },
  { href: "/app/support", label: "Support", icon: LifeBuoy, group: "more", groupLabel: "More" }
];
