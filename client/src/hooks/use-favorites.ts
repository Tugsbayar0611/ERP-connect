
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth } from "./use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface FavoriteItem {
    href: string;
    label: string;
}

interface FavoritesState {
    favorites: FavoriteItem[];
    addFavorite: (item: FavoriteItem) => void;
    removeFavorite: (href: string) => void;
    isFavorite: (href: string) => boolean;
    toggleFavorite: (item: FavoriteItem) => void;
}

// Local state for immediate UI feedback + sync logic
export const useFavoritesStore = create<FavoritesState>()(
    persist(
        (set, get) => ({
            favorites: [],
            addFavorite: (item) =>
                set((state) => ({
                    favorites: [...state.favorites, item]
                })),
            removeFavorite: (href) =>
                set((state) => ({
                    favorites: state.favorites.filter((i) => i.href !== href)
                })),
            isFavorite: (href) =>
                get().favorites.some((i) => i.href === href),
            toggleFavorite: (item) => {
                const isFav = get().isFavorite(item.href);
                if (isFav) {
                    get().removeFavorite(item.href);
                } else {
                    get().addFavorite(item);
                }
            },
        }),
        {
            name: "sidebar-favorites",
        }
    )
);

// Optional: Hook to sync with backend if needed in future
// For now, local storage is sufficient for the "polish" request
// but we leave this structure ready for DB sync.
export function useFavorites() {
    const store = useFavoritesStore();
    const { user } = useAuth();

    // TODO: Sync with user.settings.favorites from DB

    return store;
}
