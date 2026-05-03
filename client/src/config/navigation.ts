import {
  Users, Building2, CalendarCheck, CalendarOff, CreditCard, FileText,
  LayoutDashboard, LogOut, Settings as SettingsIcon, Moon, Sun, Package,
  UserCircle, ShoppingCart, ShoppingBag, Warehouse, Receipt, BookOpen,
  FileSpreadsheet, BookMarked, BarChart3, FileCheck, Banknote, History,
  Bell, TrendingUp, AlertTriangle, MessageSquare, CalendarDays, Clock,
  Bus, Inbox, Shield, Utensils, Wallet, Bot, Fingerprint, Shirt, Brain, PackageCheck
} from "lucide-react";
import { type Resource, type Action } from "@shared/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  requiredPermission?: { resource: Resource; action: Action };
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const originalNavGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/me/canteen", label: "Хоолны эрх", icon: Wallet },
      { href: "/me/workwear", label: "Миний хувцас", icon: Shirt },
      { href: "/reports", label: "Тайлангууд", icon: BarChart3 },
      { href: "/news", label: "Мэдээлэл", icon: Bell },
      { href: "/ai-assistant", label: "AI Туслагч", icon: Bot },
    ],
  },
  {
    title: "Workforce",
    items: [
      {
        href: "/manager/rosters/calendar",
        label: "Ээлжийн хуваарь",
        icon: CalendarDays,
        requiredPermission: { resource: 'roster', action: 'read' }
      },
      { href: "/admin/rosters", label: "Ээлж төлөвлөлт", icon: SettingsIcon, requiredPermission: { resource: 'roster', action: 'write' } },
      { href: "/admin/shifts", label: "Ээлжийн төрөл", icon: Clock, requiredPermission: { resource: 'roster', action: 'write' } },
    ]
  },
  {
    title: "HR & Organization",
    items: [
      { href: "/employees", label: "Ажилтнууд", icon: Users },
      { href: "/departments", label: "Хэлтсүүд", icon: Building2 },
      { href: "/attendance", label: "Ирц бүртгэл", icon: CalendarCheck },
      { href: "/requests", label: "Хүсэлтүүд", icon: Inbox },
      { href: "/payroll", label: "Цалин", icon: CreditCard },
      { href: "/performance", label: "Гүйцэтгэл", icon: TrendingUp },
      { href: "/safety", label: "Аюулгүй ажиллагаа", icon: AlertTriangle },
      { href: "/communication", label: "Дотоод харилцаа", icon: MessageSquare },
      { href: "/canteen/admin", label: "Цайны газар", icon: Utensils },
      { href: "/admin/workwear", label: "Нормын хувцас", icon: Shirt, requiredPermission: { resource: 'assets', action: 'write' } },
      { href: "/admin/workwear/reports", label: "Хувцасны тайлан", icon: BarChart3, requiredPermission: { resource: 'assets', action: 'write' } },
    ],
  },
  {
    title: "Operation",
    items: [
      { href: "/products", label: "Бараа", icon: Package },
      { href: "/inventory", label: "Агуулах", icon: Warehouse },
      { href: "/sales", label: "Борлуулалт", icon: ShoppingCart },
      { href: "/purchase", label: "Худалдан авалт", icon: ShoppingBag },
      { href: "/contacts", label: "Харилцагчид", icon: UserCircle },
      { href: "/admin/transport", label: "Тээвэр", icon: Bus },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/documents", label: "Баримтууд", icon: FileText },
      { href: "/audit-logs", label: "Хяналтын бүртгэл", icon: History },
      { href: "/admin/ai-kb", label: "AI Сургалт", icon: Brain },
      { href: "/admin/biometric", label: "Царай уншигч", icon: Fingerprint },
      { href: "/settings", label: "Тохиргоо", icon: SettingsIcon },
    ],
  },
];

// Navigation for Warehouse users (нярав)
export const warehouseNavGroups: NavGroup[] = [
  {
    title: "MY WORKSPACE",
    items: [
      { href: "/settings", label: "Тохиргоо (Профайл)", icon: UserCircle },
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/ai-assistant", label: "AI Туслагч", icon: Bot },
      { href: "/action-center", label: "Мэдэгдэл", icon: Bell },
      { href: "/communication", label: "Чат", icon: MessageSquare },
    ],
  },
  {
    title: "АГУУЛАХ",
    items: [
      { href: "/warehouse/workwear", label: "Хувцас олгох", icon: PackageCheck },
    ],
  },
  {
    title: "HR",
    items: [
      { href: "/me/workwear", label: "Миний хувцас", icon: Shirt },
      { href: "/me/canteen", label: "Хоолны эрх", icon: Wallet },
      { href: "/attendance", label: "Миний ирц", icon: CalendarCheck },
      { href: "/payroll", label: "Цалингийн хуудас", icon: CreditCard },
    ],
  },
];

export const employeeNavGroups: NavGroup[] = [
  {
    title: "MY WORKSPACE",
    items: [
      { href: "/settings", label: "Тохиргоо (Профайл)", icon: UserCircle },
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/ai-assistant", label: "AI Туслагч", icon: Bot },
      { href: "/action-center", label: "Мэдэгдэл", icon: Bell },
      { href: "/communication", label: "Чат", icon: MessageSquare },
      { href: "/me/sessions", label: "Сешнүүд", icon: Shield },
    ],
  },
  {
    title: "HR",
    items: [
      { href: "/me/canteen", label: "Хоолны эрх", icon: Wallet },
      { href: "/me/roster", label: "Миний ээлж", icon: CalendarDays },
      { href: "/attendance", label: "Миний ирц", icon: CalendarCheck },
      { href: "/transport/booking", label: "Автобус захиалга", icon: Bus },
      { href: "/me/workwear", label: "Миний хувцас", icon: Shirt },
      { href: "/requests", label: "Хүсэлтүүд", icon: Inbox },
      { href: "/me/requests", label: "Миний хүсэлтүүд", icon: FileText },
      { href: "/payroll", label: "Цалингийн хуудас", icon: CreditCard },
      { href: "/documents", label: "Баримтууд", icon: FileText },
    ],
  },
  {
    title: "HSE",
    items: [
      { href: "/safety", label: "Аюулгүй ажиллагаа", icon: AlertTriangle },
    ],
  },
  {
    title: "PERSONAL",
    items: [
      { href: "/performance", label: "Миний зорилго", icon: TrendingUp },
    ],
  },
];
