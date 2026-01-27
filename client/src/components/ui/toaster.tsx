import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Icon based on variant
        const Icon = variant === "success" 
          ? CheckCircle2 
          : variant === "destructive" 
          ? AlertCircle 
          : null;
        
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="grid gap-1">
              <div className="flex items-start gap-3">
                {Icon && (
                  <Icon className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    variant === "success" && "text-green-600 dark:text-green-400",
                    variant === "destructive" && "text-destructive-foreground"
                  )} />
                )}
                <div className="flex-1">
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && (
                    <ToastDescription>{description}</ToastDescription>
                  )}
                </div>
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
