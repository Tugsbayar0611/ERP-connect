import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./use-auth";

interface SocketHookReturn {
    socket: Socket | null;
    isConnected: boolean;
    joinChannel: (channelId: string) => void;
    leaveChannel: (channelId: string) => void;
    startTyping: (channelId: string) => void;
    stopTyping: (channelId: string) => void;
    markMessageRead: (channelId: string, messageId: string) => void;
}

export function useSocket(): SocketHookReturn {
    const { user } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!user?.id || !user?.tenantId) return;

        // Connect to socket server
        const socket = io(window.location.origin, {
            path: "/socket.io",
            auth: {
                userId: user.id,
                tenantId: user.tenantId
            },
            transports: ["websocket", "polling"]
        });

        socket.on("connect", () => {
            console.log("[Socket] Connected");
            setIsConnected(true);
        });

        socket.on("disconnect", () => {
            console.log("[Socket] Disconnected");
            setIsConnected(false);
        });

        socket.on("connect_error", (error) => {
            console.error("[Socket] Connection error:", error.message);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user?.id, user?.tenantId]);

    const joinChannel = useCallback((channelId: string) => {
        socketRef.current?.emit("channel:join", channelId);
    }, []);

    const leaveChannel = useCallback((channelId: string) => {
        socketRef.current?.emit("channel:leave", channelId);
    }, []);

    const startTyping = useCallback((channelId: string) => {
        socketRef.current?.emit("typing:start", channelId);
    }, []);

    const stopTyping = useCallback((channelId: string) => {
        socketRef.current?.emit("typing:stop", channelId);
    }, []);

    const markMessageRead = useCallback((channelId: string, messageId: string) => {
        socketRef.current?.emit("message:read", { channelId, messageId });
    }, []);

    return {
        socket: socketRef.current,
        isConnected,
        joinChannel,
        leaveChannel,
        startTyping,
        stopTyping,
        markMessageRead
    };
}
