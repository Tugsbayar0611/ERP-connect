import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2, Save, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StickySaveBarProps {
    isDirty: boolean;
    isSaving: boolean;
    onSave: () => void;
    onCancel: () => void;
}

export function StickySaveBar({
    isDirty,
    isSaving,
    onSave,
    onCancel,
}: StickySaveBarProps) {
    return (
        <AnimatePresence>
            {isDirty && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={cn(
                        "fixed bottom-0 left-0 right-0 z-50",
                        "bg-background/95 backdrop-blur-sm",
                        "border-t shadow-lg",
                        "px-6 py-4"
                    )}
                >
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-sm text-muted-foreground">
                                Хадгалаагүй өөрчлөлт байна
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCancel}
                                disabled={isSaving}
                            >
                                <X className="w-4 h-4 mr-2" />
                                Цуцлах
                            </Button>
                            <Button
                                size="sm"
                                onClick={onSave}
                                disabled={isSaving}
                                className="min-w-[120px]"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Хадгалж байна...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Хадгалах
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
