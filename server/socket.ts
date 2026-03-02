import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { storage } from "./storage";

interface AuthenticatedSocket extends Socket {
    userId?: string;
    tenantId?: string;
}

let io: Server | null = null;

export function initializeSocket(httpServer: HttpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        path: "/socket.io"
    });

    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            const userId = socket.handshake.auth.userId;
            const tenantId = socket.handshake.auth.tenantId;

            if (!userId || !tenantId) {
                return next(new Error("Authentication required"));
            }

            socket.userId = userId;
            socket.tenantId = tenantId;
            next();
        } catch (error) {
            next(new Error("Authentication failed"));
        }
    });

    io.on("connection", (socket: AuthenticatedSocket) => {
        console.log(`[Socket] User ${socket.userId} connected`);

        // Join user's personal room for notifications
        socket.join(`user:${socket.userId}`);

        // Join channel room
        socket.on("channel:join", async (channelId: string) => {
            try {
                const isMember = await storage.isChannelMember(channelId, socket.userId!);
                if (isMember) {
                    socket.join(`channel:${channelId}`);
                    console.log(`[Socket] User ${socket.userId} joined channel ${channelId}`);
                }
            } catch (error) {
                console.error("[Socket] Error joining channel:", error);
            }
        });

        // Leave channel room
        socket.on("channel:leave", (channelId: string) => {
            socket.leave(`channel:${channelId}`);
            console.log(`[Socket] User ${socket.userId} left channel ${channelId}`);
        });

        // Typing indicators
        socket.on("typing:start", (channelId: string) => {
            socket.to(`channel:${channelId}`).emit("typing:start", {
                channelId,
                userId: socket.userId
            });
        });

        socket.on("typing:stop", (channelId: string) => {
            socket.to(`channel:${channelId}`).emit("typing:stop", {
                channelId,
                userId: socket.userId
            });
        });

        // Message read
        socket.on("message:read", async ({ channelId, messageId }: { channelId: string; messageId: string }) => {
            try {
                // Update read status in database
                await storage.updateLastReadAt(channelId, socket.userId!);

                // Notify others in the channel
                socket.to(`channel:${channelId}`).emit("message:read", {
                    channelId,
                    messageId,
                    userId: socket.userId
                });
            } catch (error) {
                console.error("[Socket] Error marking message as read:", error);
            }
        });

        socket.on("disconnect", () => {
            console.log(`[Socket] User ${socket.userId} disconnected`);
        });
    });

    return io;
}

// Helper functions to emit events from routes
export function emitNewMessage(channelId: string, message: any) {
    if (io) {
        io.to(`channel:${channelId}`).emit("message:new", message);
    }
}

export function emitMessageEdit(channelId: string, messageId: string, content: string) {
    if (io) {
        io.to(`channel:${channelId}`).emit("message:edit", { messageId, content });
    }
}

export function emitMessageDelete(channelId: string, messageId: string) {
    if (io) {
        io.to(`channel:${channelId}`).emit("message:delete", { messageId });
    }
}

export function emitChannelUpdate(channelId: string, data: any) {
    if (io) {
        io.to(`channel:${channelId}`).emit("channel:update", data);
    }
}

export function getIO() {
    return io;
}
