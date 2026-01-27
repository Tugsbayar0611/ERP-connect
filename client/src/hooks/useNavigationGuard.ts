import { useEffect, useCallback, useRef } from "react";

interface UseNavigationGuardOptions {
    when: boolean;
    message?: string;
}

/**
 * Hook to prevent navigation when there are unsaved changes
 * Handles browser refresh/close and provides a confirm function for internal navigation
 */
export function useNavigationGuard({
    when,
    message = "Хадгалаагүй өөрчлөлт байна. Гарах уу?",
}: UseNavigationGuardOptions) {
    const isBlocking = useRef(when);
    isBlocking.current = when;

    // Handle browser refresh/close
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isBlocking.current) {
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [message]);

    // Confirm function for internal navigation (wouter, sidebar clicks, etc.)
    const confirmNavigation = useCallback((): boolean => {
        if (!isBlocking.current) return true;
        return window.confirm(message);
    }, [message]);

    // Wrapper for navigation that checks for unsaved changes
    const guardedNavigate = useCallback(
        (navigateFn: () => void) => {
            if (confirmNavigation()) {
                navigateFn();
            }
        },
        [confirmNavigation]
    );

    return {
        isBlocking: when,
        confirmNavigation,
        guardedNavigate,
    };
}
