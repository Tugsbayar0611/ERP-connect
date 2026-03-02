import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useCanteenWalletMe() {
    const { data: wallet, isLoading: isWalletLoading, error: walletError, refetch: refetchWallet } = useQuery({
        queryKey: ["/api/canteen/wallet/me"], // Keep key consistent with Widget
        queryFn: async () => {
            const res = await fetch("/api/canteen/wallet/me");
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    return { wallet, isLoading: isWalletLoading, error: walletError, refetchWallet };
}

export function useCanteenTransactionsMe() {
    const { data: transactions, isLoading: isTxLoading, error: txError, refetch: refetchTx } = useQuery({
        queryKey: ["/api/canteen/wallet/me/transactions"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/canteen/wallet/me/transactions");
            return res.json();
        }
    });

    return { transactions, isLoading: isTxLoading, error: txError, refetchTx };
}
