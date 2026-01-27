import { Link } from "wouter";
import {
    FileText,
    Package,
    UserPlus,
    CreditCard,
    Zap,
    ArrowRight
} from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickAction {
    icon: React.ElementType;
    label: string;
    description: string;
    href: string;
    color: string;
}

const actions: QuickAction[] = [
    {
        icon: FileText,
        label: "Нэхэмжлэх",
        description: "Шинэ үүсгэх",
        href: "/invoices?action=new",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30"
    },
    {
        icon: Package,
        label: "Бараа орлого",
        description: "Агуулах нэмэх",
        href: "/inventory?action=add",
        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    },
    {
        icon: UserPlus,
        label: "Ажилтан",
        description: "Шинэ нэмэх",
        href: "/employees?action=new",
        color: "bg-violet-500/20 text-violet-400 border-violet-500/30"
    },
    {
        icon: CreditCard,
        label: "Төлбөр",
        description: "Бүртгэх",
        href: "/invoices?action=payment",
        color: "bg-amber-500/20 text-amber-400 border-amber-500/30"
    },
];

function ActionCard({ action }: { action: QuickAction }) {
    const Icon = action.icon;

    return (
        <Link href={action.href}>
            <div className={cn(
                "flex flex-col items-center justify-center p-4 rounded-xl",
                "border border-white/5 hover:border-white/10",
                "bg-white/[0.02] hover:bg-white/[0.05]",
                "transition-all duration-200 cursor-pointer group",
                "min-h-[100px]"
            )}>
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border mb-3",
                    "transition-transform group-hover:scale-110",
                    action.color
                )}>
                    <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                    {action.label}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    {action.description}
                </span>
            </div>
        </Link>
    );
}

export function QuickActionsWidget() {
    return (
        <GlassCard padding="none" className="overflow-hidden">
            <GlassCardHeader className="px-6 pt-6 pb-0">
                <GlassCardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Түргэн үйлдлүүд
                </GlassCardTitle>
            </GlassCardHeader>

            <GlassCardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                    {actions.map((action) => (
                        <ActionCard key={action.label} action={action} />
                    ))}
                </div>
            </GlassCardContent>
        </GlassCard>
    );
}
