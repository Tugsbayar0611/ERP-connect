import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PasswordChangeModalProps {
    open: boolean;
    isRequired?: boolean; // If true, user cannot dismiss the modal
    onClose: () => void;
}

export function PasswordChangeModal({ open, isRequired = false, onClose }: PasswordChangeModalProps) {
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [error, setError] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const changePasswordMutation = useMutation({
        mutationFn: async (data: { oldPassword: string; newPassword: string }) => {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Password change failed");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Амжилттай",
                description: "Нууц үг амжилттай солигдлоо",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            queryClient.invalidateQueries({ queryKey: ["/api/me"] });
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setError("");
            onClose();
        },
        onError: (error: Error) => {
            setError(error.message);
        },
    });

    const validateAndSubmit = () => {
        setError("");

        if (!oldPassword || !newPassword || !confirmPassword) {
            setError("Бүх талбарыг бөглөнө үү");
            return;
        }

        if (newPassword.length < 8) {
            setError("Шинэ нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Шинэ нууц үг таарахгүй байна");
            return;
        }

        if (oldPassword === newPassword) {
            setError("Шинэ нууц үг хуучинтай ижил байж болохгүй");
            return;
        }

        changePasswordMutation.mutate({ oldPassword, newPassword });
    };

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen && !isRequired) {
            onClose();
        }
        // If isRequired is true, prevent closing
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => isRequired && e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        {isRequired ? "Нууц үг солих шаардлагатай" : "Нууц үг солих"}
                    </DialogTitle>
                    <DialogDescription>
                        {isRequired
                            ? "Анх нэвтэрч байгаа тул шинэ нууц үг тохируулна уу."
                            : "Шинэ нууц үг оруулна уу."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {isRequired && (
                        <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <AlertDescription className="text-amber-700 dark:text-amber-300">
                                Аюулгүй байдлын үүднээс нууц үгээ заавал солино уу.
                            </AlertDescription>
                        </Alert>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="oldPassword">Хуучин нууц үг</Label>
                        <div className="relative">
                            <Input
                                id="oldPassword"
                                type={showOldPassword ? "text" : "password"}
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Хуучин нууц үг"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowOldPassword(!showOldPassword)}
                            >
                                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newPassword">Шинэ нууц үг</Label>
                        <div className="relative">
                            <Input
                                id="newPassword"
                                type={showNewPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Шинэ нууц үг (8+ тэмдэгт)"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Шинэ нууц үг давтах</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Шинэ нууц үг давтах"
                        />
                    </div>
                </div>

                <DialogFooter>
                    {!isRequired && (
                        <Button variant="outline" onClick={onClose}>
                            Болих
                        </Button>
                    )}
                    <Button onClick={validateAndSubmit} disabled={changePasswordMutation.isPending}>
                        {changePasswordMutation.isPending ? "Хадгалж байна..." : "Нууц үг солих"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
