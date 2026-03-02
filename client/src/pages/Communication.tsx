import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { mn } from "date-fns/locale";
import {
    MessageSquare, Bell, Plus, Send, Search, Users, Hash, User,
    ChevronRight, MoreHorizontal, Smile, Paperclip, Pin, Eye,
    Check, MessageCircle, ThumbsUp, Heart, Laugh, ArrowLeft, Image, X, Trash2, Pencil, CheckCheck,
    Download, ExternalLink, Minimize2, Maximize2
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/hooks/use-auth";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// ==========================================
// Types
// ==========================================

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: string;
    priority: string;
    isPinned: boolean;
    createdById: string;
    createdAt: string;
    // Interaction fields
    likesCount?: number;
    commentsCount?: number;
    isLiked?: boolean;
    isRead?: boolean;
}

interface AnnouncementComment {
    id: string;
    content: string;
    userId: string;
    user?: { fullName: string }; // Populated if possible, or fetch separate
    createdAt: string;
}

interface ChatChannel {
    id: string;
    type: string;
    name: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    unreadCount?: number;
}

interface ChatMessage {
    id: string;
    content: string;
    senderId: string;
    senderName: string | null;
    senderEmail: string | null;
    createdAt: string;
    channelId?: string;
    fileUrl?: string | null;
    type?: string;
}

interface ChatChannelMember {
    id: string;
    channelId: string;
    userId: string;
    lastReadAt: string | null;
}

// ==========================================
// Announcements Tab
// ==========================================

const AnnouncementsTab = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [newAnnouncement, setNewAnnouncement] = useState({
        title: "",
        content: "",
        type: "general",
        priority: "normal",
        isPinned: false
    });


    const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
        queryKey: ["announcements"],
        queryFn: async () => {
            const res = await fetch("/api/announcements");
            if (!res.ok) throw new Error("Failed to load");
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["announcements"] });
            setIsCreateOpen(false);
            setNewAnnouncement({ title: "", content: "", type: "general", priority: "normal", isPinned: false });
            toast({ title: "Амжилттай", description: "Зарлал үүсгэгдлээ" });
        }
    });

    // Interaction State
    const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
    const [commentTexts, setCommentTexts] = useState<{ [id: string]: string }>({});
    const [commentsCache, setCommentsCache] = useState<{ [id: string]: AnnouncementComment[] }>({});

    // Mutations
    const markReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await fetch(`/api/announcements/${id}/read`, { method: "POST" });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["announcements"] });
        }
    });

    const toggleReactionMutation = useMutation({
        mutationFn: async ({ id, emoji }: { id: string, emoji: string }) => {
            const res = await fetch(`/api/announcements/${id}/reactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji })
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["announcements"] });
        }
    });

    const createCommentMutation = useMutation({
        mutationFn: async ({ id, content }: { id: string, content: string }) => {
            const res = await fetch(`/api/announcements/${id}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content })
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["announcements"] });
            // Update local cache or refetch comments
            fetchComments(variables.id);
            setCommentTexts(prev => ({ ...prev, [variables.id]: "" }));
        }
    });

    const updateAnnouncementMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const res = await fetch(`/api/announcements/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["announcements"] });
            setIsEditOpen(false);
            setEditingAnnouncement(null);
            toast({ title: "Амжилттай", description: "Зарлал шинэчлэгдлээ" });
        }
    });

    const deleteAnnouncementMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/announcements/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["announcements"] });
            setDeletingId(null);
            toast({ title: "Амжилттай", description: "Зарлал устгагдлаа" });
        }
    });

    const fetchComments = async (id: string) => {
        try {
            const res = await fetch(`/api/announcements/${id}/comments`);
            if (res.ok) {
                const data = await res.json();
                setCommentsCache(prev => ({ ...prev, [id]: data }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleComments = (id: string) => {
        const newSet = new Set(expandedComments);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
            if (!commentsCache[id]) {
                fetchComments(id);
            }
        }
        setExpandedComments(newSet);
    };

    const getTypeBadge = (type: string) => {
        const badges: Record<string, { label: string; className: string }> = {
            general: { label: "Ерөнхий", className: "bg-blue-100 text-blue-700" },
            urgent: { label: "Яаралтай", className: "bg-red-100 text-red-700" },
            event: { label: "Арга хэмжээ", className: "bg-green-100 text-green-700" },
            celebration: { label: "Баяр", className: "bg-yellow-100 text-yellow-700" },
            policy: { label: "Бодлого", className: "bg-purple-100 text-purple-700" },
            safety: { label: "Аюулгүй ажиллагаа", className: "bg-orange-100 text-orange-700" }
        };
        return badges[type] || badges.general;
    };

    return (
        <div className="flex flex-col h-full" >
            {/* Header */}
            < div className="flex items-center justify-between p-4 border-b" >
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Зарлал
                </h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Шинэ зарлал
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Шинэ зарлал үүсгэх</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Гарчиг</Label>
                                <Input
                                    placeholder="Зарлалын гарчиг"
                                    value={newAnnouncement.title}
                                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Агуулга</Label>
                                <Textarea
                                    placeholder="Зарлалын дэлгэрэнгүй агуулга..."
                                    rows={4}
                                    value={newAnnouncement.content}
                                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Төрөл</Label>
                                    <Select
                                        value={newAnnouncement.type}
                                        onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, type: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">Ерөнхий</SelectItem>
                                            <SelectItem value="urgent">Яаралтай</SelectItem>
                                            <SelectItem value="event">Арга хэмжээ</SelectItem>
                                            <SelectItem value="celebration">Баяр</SelectItem>
                                            <SelectItem value="policy">Бодлого</SelectItem>
                                            <SelectItem value="safety">Аюулгүй ажиллагаа</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Ач холбогдол</Label>
                                    <Select
                                        value={newAnnouncement.priority}
                                        onValueChange={(v) => setNewAnnouncement({ ...newAnnouncement, priority: v })}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="normal">Энгийн</SelectItem>
                                            <SelectItem value="high">Өндөр</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="pinned"
                                    checked={newAnnouncement.isPinned}
                                    onCheckedChange={(c) => setNewAnnouncement({ ...newAnnouncement, isPinned: c })}
                                />
                                <Label htmlFor="pinned">Бэхлэх (Pin)</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Цуцлах</Button>
                            <Button
                                onClick={() => createMutation.mutate(newAnnouncement)}
                                disabled={!newAnnouncement.title || !newAnnouncement.content}
                            >
                                Үүсгэх
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div >

            {/* Announcements List */}
            < ScrollArea className="flex-1 p-4" >
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center text-muted-foreground py-8">Уншиж байна...</div>
                    ) : announcements.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">Зарлал байхгүй</div>
                    ) : (
                        announcements.map((a) => {
                            const badge = getTypeBadge(a.type);
                            return (
                                <Card key={a.id} className={`relative ${a.isPinned ? "border-blue-300 dark:border-blue-700" : ""}`}>
                                    {a.isPinned && (
                                        <div className="absolute top-2 right-2">
                                            <Pin className="w-4 h-4 text-blue-500" />
                                        </div>
                                    )}
                                    {/* Edit/Delete Menu - Only for creator or admin */}
                                    {(user?.id === a.createdById || user?.role === "admin") && (
                                        <div className="absolute top-2 right-8">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingAnnouncement(a);
                                                        setIsEditOpen(true);
                                                    }}>
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Засах
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600" onClick={() => setDeletingId(a.id)}>
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Устгах
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-lg">{a.title}</CardTitle>
                                                <CardDescription className="text-xs mt-1">
                                                    {format(new Date(a.createdAt.replace("Z", "")), "yyyy-MM-dd HH:mm", { locale: mn })}
                                                </CardDescription>
                                            </div>
                                            <Badge className={badge.className}>{badge.label}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                                        <div className="flex flex-col gap-4 mt-4 pt-3 border-t">
                                            <div className="flex items-center gap-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`gap-1 text-xs ${a.isRead ? "text-green-600" : ""}`}
                                                    onClick={() => !a.isRead && markReadMutation.mutate(a.id)}
                                                    disabled={a.isRead}
                                                >
                                                    {a.isRead ? <CheckCheck className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    {a.isRead ? "Уншсан" : "Унших"}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-1 text-xs"
                                                    onClick={() => toggleComments(a.id)}
                                                >
                                                    <MessageCircle className="w-3 h-3" />
                                                    Сэтгэгдэл ({a.commentsCount || 0})
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`gap-1 text-xs ${a.isLiked ? "text-blue-600" : ""}`}
                                                    onClick={() => toggleReactionMutation.mutate({ id: a.id, emoji: "👍" })}
                                                >
                                                    <ThumbsUp className={`w-3 h-3 ${a.isLiked ? "fill-current" : ""}`} />
                                                    ({a.likesCount || 0})
                                                </Button>
                                            </div>

                                            {/* Comments Section */}
                                            {expandedComments.has(a.id) && (
                                                <div className="bg-muted/30 p-3 rounded-md space-y-3">
                                                    {/* List */}
                                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                                        {(commentsCache[a.id] || []).map((c) => (
                                                            <div key={c.id} className="text-sm border-b pb-2 last:border-0">
                                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                                    <span>{c.user?.fullName || "Хэрэглэгч"}</span>
                                                                    <span>{format(new Date(c.createdAt.replace("Z", "")), "MM/dd HH:mm")}</span>
                                                                </div>
                                                                <p className="mt-1">{c.content}</p>
                                                            </div>
                                                        ))}
                                                        {(commentsCache[a.id] || []).length === 0 && (
                                                            <p className="text-xs text-muted-foreground text-center py-2">Сэтгэгдэл байхгүй</p>
                                                        )}
                                                    </div>

                                                    {/* Input */}
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="Сэтгэгдэл бичих..."
                                                            className="h-8 text-sm"
                                                            value={commentTexts[a.id] || ""}
                                                            onChange={(e) => setCommentTexts(prev => ({ ...prev, [a.id]: e.target.value }))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    if (commentTexts[a.id]?.trim()) {
                                                                        createCommentMutation.mutate({ id: a.id, content: commentTexts[a.id] });
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            disabled={!commentTexts[a.id]?.trim()}
                                                            onClick={() => createCommentMutation.mutate({ id: a.id, content: commentTexts[a.id] })}
                                                        >
                                                            <Send className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </ScrollArea >

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Зарлал засах</DialogTitle>
                    </DialogHeader>
                    {editingAnnouncement && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Гарчиг</Label>
                                <Input
                                    value={editingAnnouncement.title}
                                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Агуулга</Label>
                                <Textarea
                                    rows={4}
                                    value={editingAnnouncement.content}
                                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, content: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Төрөл</Label>
                                    <Select
                                        value={editingAnnouncement.type}
                                        onValueChange={(val) => setEditingAnnouncement({ ...editingAnnouncement, type: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">Ерөнхий</SelectItem>
                                            <SelectItem value="urgent">Яаралтай</SelectItem>
                                            <SelectItem value="event">Арга хэмжээ</SelectItem>
                                            <SelectItem value="celebration">Баяр</SelectItem>
                                            <SelectItem value="policy">Бодлого</SelectItem>
                                            <SelectItem value="safety">АБТ</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Онцлох</Label>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch
                                            checked={editingAnnouncement.isPinned}
                                            onCheckedChange={(checked) => setEditingAnnouncement({ ...editingAnnouncement, isPinned: checked })}
                                        />
                                        <Label>Онцлох зарлал</Label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Болих</Button>
                        <Button onClick={() => editingAnnouncement && updateAnnouncementMutation.mutate({ id: editingAnnouncement.id, data: editingAnnouncement })}>
                            Хадгалах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Зарлал устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Энэ үйлдлийг буцаах боломжгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deletingId && deleteAnnouncementMutation.mutate(deletingId)}
                        >
                            Устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
};

// ==========================================
// Chat Tab
// ==========================================

interface Employee {
    id: string;
    fullName: string;
    email: string;
}

const ChatTab = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [chatType, setChatType] = useState<"direct" | "group">("direct");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [groupName, setGroupName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");

    // Common emojis for quick access
    const commonEmojis = ["😀", "😂", "❤️", "👍", "👎", "🎉", "🔥", "👏", "💯", "🤔", "😊", "🙏", "✅", "⭐", "💪", "🚀"];

    // Socket.io for real-time
    const { socket, isConnected, joinChannel, leaveChannel, startTyping, stopTyping, markMessageRead } = useSocket();
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Join/leave channel rooms when selected channel changes
    useEffect(() => {
        if (!socket || !selectedChannel) return;

        joinChannel(selectedChannel.id);

        // Listen for real-time events
        socket.on("message:new", (message: ChatMessage) => {
            // Update messages connection if in this channel
            if (message.channelId === selectedChannel.id) {
                queryClient.setQueryData(
                    ["chat-messages", selectedChannel.id],
                    (old: ChatMessage[] | undefined) => old ? [message, ...old] : [message]
                );
            }

            // Update channels list (preview + unread count)
            queryClient.setQueryData(
                ["chat-channels"],
                (old: ChatChannel[] | undefined) => {
                    if (!old) return old;
                    return old.map(ch => {
                        if (ch.id === message.channelId) {
                            return {
                                ...ch,
                                lastMessagePreview: message.content.substring(0, 100),
                                lastMessageAt: message.createdAt,
                                unreadCount: message.channelId === selectedChannel.id ? ch.unreadCount : (ch.unreadCount || 0) + 1
                            };
                        }
                        return ch;
                    }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
                }
            );
        });

        socket.on("message:edit", ({ messageId, content }: { messageId: string; content: string }) => {
            queryClient.setQueryData(
                ["chat-messages", selectedChannel.id],
                (old: ChatMessage[] | undefined) =>
                    old?.map(m => m.id === messageId ? { ...m, content } : m)
            );
        });

        socket.on("message:delete", ({ messageId }: { messageId: string }) => {
            queryClient.setQueryData(
                ["chat-messages", selectedChannel.id],
                (old: ChatMessage[] | undefined) => old?.filter(m => m.id !== messageId)
            );
        });

        socket.on("typing:start", ({ userId }: { userId: string }) => {
            setTypingUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
        });

        socket.on("typing:stop", ({ userId }: { userId: string }) => {
            setTypingUsers(prev => prev.filter(id => id !== userId));
        });

        socket.on("message:read", () => {
            refetchMembers();
        });

        return () => {
            leaveChannel(selectedChannel.id);
            socket.off("message:new");
            socket.off("message:edit");
            socket.off("message:delete");
            socket.off("typing:start");
            socket.off("typing:stop");
            socket.off("message:read");
        };
    }, [socket, selectedChannel?.id, queryClient, joinChannel, leaveChannel]);

    const { data: channels = [], isLoading: channelsLoading } = useQuery<ChatChannel[]>({
        queryKey: ["chat-channels"],
        queryFn: async () => {
            const res = await fetch("/api/chat/channels");
            if (!res.ok) throw new Error("Failed to load");
            return res.json();
        }
    });

    const { data: employees = [] } = useQuery<Employee[]>({
        queryKey: ["chat-employees", searchQuery],
        queryFn: async () => {
            const res = await fetch(`/api/chat/employees/search?q=${encodeURIComponent(searchQuery)}`);
            if (!res.ok) throw new Error("Failed to load");
            return res.json();
        }
    });

    const { data: channelMembers = [], refetch: refetchMembers } = useQuery<ChatChannelMember[]>({
        queryKey: ["chat-members", selectedChannel?.id],
        queryFn: async () => {
            if (!selectedChannel) return [];
            const res = await fetch(`/api/chat/channels/${selectedChannel.id}/members`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!selectedChannel
    });

    const getReadStatus = (message: ChatMessage) => {
        if (!channelMembers.length) return "sent"; // Default

        // Count how many others have read it
        const participants = channelMembers.filter(m => m.userId !== user?.id);
        if (participants.length === 0) return "read"; // Just me

        const readCount = participants.filter(m =>
            m.lastReadAt && new Date(m.lastReadAt) >= new Date(message.createdAt)
        ).length;

        if (readCount === participants.length) return "read";
        return "delivered"; // Simplified
    };

    const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
        queryKey: ["chat-messages", selectedChannel?.id],
        enabled: !!selectedChannel,
        queryFn: async () => {
            const res = await fetch(`/api/chat/channels/${selectedChannel!.id}/messages`);
            if (!res.ok) throw new Error("Failed to load");
            return res.json();
        }
    });

    // Mark messages as read when channel opens or messages arrive
    useEffect(() => {
        if (!socket || !selectedChannel || !messages.length) return;

        const unreadMessages = messages.filter(m => {
            // Find my own read status
            const myMember = channelMembers.find(member => member.userId === user?.id);
            if (!myMember?.lastReadAt) return true;
            return new Date(m.createdAt) > new Date(myMember.lastReadAt);
        });

        if (unreadMessages.length > 0) {
            // Mark the latest message as read, which implies all previous are read
            const newest = messages.reduce((prev, current) =>
                (new Date(prev.createdAt) > new Date(current.createdAt)) ? prev : current
            );

            markMessageRead(selectedChannel.id, newest.id);
        }
    }, [socket, selectedChannel?.id, messages, channelMembers, user?.id, markMessageRead]);




    const sendMutation = useMutation({
        mutationFn: async ({ content, fileUrl, type }: { content: string; fileUrl?: string; type?: string }) => {
            const res = await fetch(`/api/chat/channels/${selectedChannel!.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, fileUrl, type })
            });
            if (!res.ok) throw new Error("Failed to send");
            return res.json();
        },
        onSuccess: () => {
            setNewMessage("");
            queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedChannel?.id] });
            queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
        }
    });

    const deleteMessageMutation = useMutation({
        mutationFn: async (messageId: string) => {
            const res = await fetch(`/api/chat/messages/${messageId}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedChannel?.id] });
            toast({ title: "Амжилттай", description: "Мессеж устгагдлаа" });
        },
        onError: (error: any) => {
            toast({ title: "Алдаа", description: error.message, variant: "destructive" });
        }
    });

    const deleteChannelMutation = useMutation({
        mutationFn: async (channelId: string) => {
            const res = await fetch(`/api/chat/channels/${channelId}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to delete");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
            setSelectedChannel(null);
            toast({ title: "Амжилттай", description: "Групп устгагдлаа" });
        },
        onError: (error: any) => {
            toast({ title: "Алдаа", description: error.message, variant: "destructive" });
        }
    });

    const editMessageMutation = useMutation({
        mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
            const res = await fetch(`/api/chat/messages/${messageId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to edit");
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["chat-messages", selectedChannel?.id] });
            setEditingMessageId(null);
            setEditContent("");
            toast({ title: "Амжилттай", description: "Мессеж засагдлаа" });
        },
        onError: (error: any) => {
            toast({ title: "Алдаа", description: error.message, variant: "destructive" });
        }
    });

    const createDirectMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch("/api/chat/channels/direct", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId })
            });
            if (!res.ok) throw new Error("Failed to create");
            return res.json();
        },
        onSuccess: (channel) => {
            queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
            setSelectedChannel(channel);
            setIsNewChatOpen(false);
            resetForm();
            toast({ title: "Амжилттай", description: "Чат үүсгэгдлээ" });
        }
    });

    const createGroupMutation = useMutation({
        mutationFn: async (data: { name: string; memberIds: string[] }) => {
            const res = await fetch("/api/chat/channels/group", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create");
            return res.json();
        },
        onSuccess: (channel) => {
            queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
            setSelectedChannel(channel);
            setIsNewChatOpen(false);
            resetForm();
            toast({ title: "Амжилттай", description: "Бүлгийн чат үүсгэгдлээ" });
        }
    });

    const resetForm = () => {
        setChatType("direct");
        setSelectedUserId("");
        setGroupName("");
        setSelectedMembers([]);
        setSearchQuery("");
    };

    const handleCreateChat = () => {
        if (chatType === "direct" && selectedUserId) {
            createDirectMutation.mutate(selectedUserId);
        } else if (chatType === "group" && groupName && selectedMembers.length > 0) {
            createGroupMutation.mutate({ name: groupName, memberIds: selectedMembers });
        }
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !selectedFile) || !selectedChannel) return;

        let fileUrl = undefined;
        let type = "text";

        // Upload file first if selected
        if (selectedFile) {
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append("file", selectedFile);

                const uploadRes = await fetch("/api/upload", {
                    method: "POST",
                    body: formData
                });

                if (!uploadRes.ok) throw new Error("Upload failed");
                const uploadData = await uploadRes.json();
                fileUrl = uploadData.url;

                // Determine type based on mimetype
                if (uploadData.mimetype.startsWith("image/")) {
                    type = "image";
                } else {
                    type = "file";
                }
            } catch (error) {
                toast({ title: "Алдаа", description: "Файл илгээж чадсангүй", variant: "destructive" });
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        // Send message
        sendMutation.mutate({
            content: newMessage.trim() || (fileUrl ? (type === 'image' ? "📷 Зураг" : "📎 Файл") : ""),
            fileUrl,
            type
        });

        // Clear file state
        setSelectedFile(null);
        setFilePreview(null);
    };

    const renderMessageContent = (content: string) => {
        if (!content) return null;

        // Find mentions of likely employees
        // This is a simple implementation that matches @Name
        if (!content.includes("@")) return content;

        const parts = content.split(/(@[\w\s\u0400-\u04FF]+)/g);

        return parts.map((part, index) => {
            if (part.startsWith("@")) {
                const name = part.substring(1).trim();
                const employee = employees.find(e => name.startsWith(e.fullName));
                if (employee) {
                    return <span key={index} className="text-blue-600 dark:text-blue-400 font-medium">{part}</span>;
                }
            }
            return part;
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            // Create preview for images
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => setFilePreview(e.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setNewMessage(value);

        // Detect mention
        const lastAt = value.lastIndexOf("@");
        if (lastAt !== -1) {
            const query = value.slice(lastAt + 1);
            if (!query.includes(" ")) {
                setShowMentions(true);
                setMentionQuery(query);
            } else {
                setShowMentions(false);
            }
        } else {
            setShowMentions(false);
        }

        // Typing detection
        if (selectedChannel) {
            startTyping(selectedChannel.id);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
                stopTyping(selectedChannel.id);
            }, 2000);
        }
    };

    const insertMention = (memberName: string) => {
        const lastAt = newMessage.lastIndexOf("@");
        if (lastAt !== -1) {
            const newValue = newMessage.substring(0, lastAt) + `@${memberName} ` + newMessage.substring(lastAt + 1 + mentionQuery.length);
            setNewMessage(newValue);
            setShowMentions(false);
        }
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const addEmoji = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
    };

    const toggleMember = (id: string) => {
        setSelectedMembers(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    return (
        <div className="flex h-full">
            {/* Channel List */}
            <div className={`w-80 border-r flex flex-col ${selectedChannel ? "hidden md:flex" : "flex"}`}>
                <div className="p-4 border-b">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Чат
                    </h2>
                    <div className="mt-3 relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Хайх..." />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    {channelsLoading ? (
                        <div className="p-4 text-center text-muted-foreground">Уншиж байна...</div>
                    ) : channels.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">Чат байхгүй</div>
                    ) : (
                        channels.map((ch) => (
                            <div
                                key={ch.id}
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selectedChannel?.id === ch.id ? "bg-muted" : ""
                                    }`}
                                onClick={() => setSelectedChannel(ch)}
                            >
                                <Avatar className="h-10 w-10">
                                    {ch.type === "direct" ? (
                                        <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                                    ) : (
                                        <AvatarFallback><Users className="w-4 h-4" /></AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{ch.name || "Шууд чат"}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {ch.lastMessagePreview || "Мессеж байхгүй"}
                                    </p>
                                </div>
                                {ch.lastMessageAt && (
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(ch.lastMessageAt), "HH:mm")}
                                        </span>
                                        {ch.unreadCount && ch.unreadCount > 0 ? (
                                            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                                {ch.unreadCount}
                                            </Badge>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </ScrollArea>
                <div className="p-3 border-t">
                    <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full gap-2">
                                <Plus className="w-4 h-4" />
                                Шинэ чат
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Шинэ чат эхлүүлэх</DialogTitle>
                                <DialogDescription>
                                    Нэг хүнтэй эсвэл бүлгийн чат үүсгэх
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                {/* Chat Type Selection */}
                                <div className="flex gap-2">
                                    <Button
                                        variant={chatType === "direct" ? "default" : "outline"}
                                        className="flex-1 gap-2"
                                        onClick={() => setChatType("direct")}
                                    >
                                        <User className="w-4 h-4" />
                                        1:1 Чат
                                    </Button>
                                    <Button
                                        variant={chatType === "group" ? "default" : "outline"}
                                        className="flex-1 gap-2"
                                        onClick={() => setChatType("group")}
                                    >
                                        <Users className="w-4 h-4" />
                                        Бүлгийн чат
                                    </Button>
                                </div>

                                {/* Group name input */}
                                {chatType === "group" && (
                                    <div className="space-y-2">
                                        <Label>Бүлгийн нэр</Label>
                                        <Input
                                            placeholder="Бүлгийн нэрийг оруулна уу"
                                            value={groupName}
                                            onChange={(e) => setGroupName(e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* Employee Search */}
                                <div className="space-y-2">
                                    <Label>{chatType === "direct" ? "Хүн сонгох" : "Гишүүд сонгох"}</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            placeholder="Нэрээр хайх..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Employee List */}
                                <ScrollArea className="h-48 border rounded-md">
                                    {employees.length === 0 ? (
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                            Ажилтан олдсонгүй
                                        </div>
                                    ) : (
                                        <div className="p-2 space-y-1">
                                            {employees.map((emp) => (
                                                <div
                                                    key={emp.id}
                                                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${chatType === "direct"
                                                        ? selectedUserId === emp.id ? "bg-primary/10" : "hover:bg-muted"
                                                        : selectedMembers.includes(emp.id) ? "bg-primary/10" : "hover:bg-muted"
                                                        }`}
                                                    onClick={() => {
                                                        if (chatType === "direct") {
                                                            setSelectedUserId(emp.id);
                                                        } else {
                                                            toggleMember(emp.id);
                                                        }
                                                    }}
                                                >
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback>
                                                            {emp.fullName?.charAt(0) || <User className="w-3 h-3" />}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{emp.fullName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                                                    </div>
                                                    {chatType === "direct" ? (
                                                        selectedUserId === emp.id && <Check className="w-4 h-4 text-primary" />
                                                    ) : (
                                                        selectedMembers.includes(emp.id) && <Check className="w-4 h-4 text-primary" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>

                                {/* Selected members badges for group */}
                                {chatType === "group" && selectedMembers.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {selectedMembers.map(id => {
                                            const emp = employees.find(e => e.id === id);
                                            return emp ? (
                                                <Badge key={id} variant="secondary" className="gap-1">
                                                    {emp.fullName}
                                                    <button onClick={() => toggleMember(id)} className="ml-1 hover:text-destructive">×</button>
                                                </Badge>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsNewChatOpen(false); resetForm(); }}>
                                    Цуцлах
                                </Button>
                                <Button
                                    onClick={handleCreateChat}
                                    disabled={
                                        (chatType === "direct" && !selectedUserId) ||
                                        (chatType === "group" && (!groupName || selectedMembers.length === 0))
                                    }
                                >
                                    Чат эхлүүлэх
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!selectedChannel ? "hidden md:flex" : "flex"}`}>
                {selectedChannel ? (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center gap-3 p-4 border-b">
                            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedChannel(null)}>
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <Avatar>
                                {selectedChannel.type === "direct" ? (
                                    <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                                ) : (
                                    <AvatarFallback><Users className="w-4 h-4" /></AvatarFallback>
                                )}
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-semibold">{selectedChannel.name || "Шууд чат"}</p>
                                <p className="text-xs text-muted-foreground">
                                    {selectedChannel.type === "direct" ? "1:1 Чат" : "Бүлгийн чат"}
                                </p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                            const confirmMsg = selectedChannel.type === "group"
                                                ? "Энэ группыг устгахдаа итгэлтэй байна уу?"
                                                : "Энэ чатыг устгахдаа итгэлтэй байна уу?";
                                            if (confirm(confirmMsg)) {
                                                deleteChannelMutation.mutate(selectedChannel.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {selectedChannel.type === "group" ? "Групп устгах" : "Чат устгах"}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* Messages */}
                        <ScrollArea className="flex-1 p-4">
                            {messagesLoading ? (
                                <div className="text-center text-muted-foreground">Уншиж байна...</div>
                            ) : messages.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">Мессеж байхгүй. Эхний мессежийг илгээнэ үү!</div>
                            ) : (
                                <div className="space-y-4">
                                    {[...messages].reverse().map((msg) => (
                                        <div key={msg.id} className="flex gap-3 group">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>
                                                    {msg.senderName?.charAt(0) || <User className="w-3 h-3" />}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-medium text-sm">{msg.senderName || "Хэрэглэгч"}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format(new Date(msg.createdAt.replace("Z", "")), "HH:mm")}
                                                    </span>
                                                    {/* Read receipt checkmarks */}
                                                    {msg.senderId === user?.id && (
                                                        <span className="ml-1">
                                                            {getReadStatus(msg) === "read" ? (
                                                                <CheckCheck className="w-3 h-3 text-blue-500" />
                                                            ) : (
                                                                <Check className="w-3 h-3 text-muted-foreground" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>

                                                {editingMessageId === msg.id ? (
                                                    <div className="flex gap-2 mt-1">
                                                        <Input
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            className="flex-1 h-8 text-sm"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    editMessageMutation.mutate({ messageId: msg.id, content: editContent });
                                                                } else if (e.key === "Escape") {
                                                                    setEditingMessageId(null);
                                                                    setEditContent("");
                                                                }
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8"
                                                            onClick={() => editMessageMutation.mutate({ messageId: msg.id, content: editContent })}
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8"
                                                            onClick={() => {
                                                                setEditingMessageId(null);
                                                                setEditContent("");
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {msg.fileUrl && (
                                                            <div className="mt-1 mb-2">
                                                                {(msg.type === 'image' || msg.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
                                                                    <div
                                                                        className="relative group cursor-pointer overflow-hidden rounded-md border bg-muted/20"
                                                                        onClick={() => setPreviewImage(msg.fileUrl!)}
                                                                    >
                                                                        <img
                                                                            src={msg.fileUrl}
                                                                            alt="Attachment"
                                                                            className="max-w-[300px] max-h-[300px] w-auto h-auto object-cover rounded-md hover:scale-105 transition-transform duration-300"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                                            <Maximize2 className="w-8 h-8 text-white drop-shadow-md" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <a
                                                                        href={msg.fileUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors border max-w-sm group"
                                                                    >
                                                                        <div className="bg-primary/10 p-2 rounded-full">
                                                                            <Paperclip className="w-5 h-5 text-primary" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-medium text-sm truncate text-foreground">
                                                                                {msg.fileUrl.split('/').pop()}
                                                                            </p>
                                                                            <p className="text-xs text-muted-foreground">Татах</p>
                                                                        </div>
                                                                        <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-sm rounded-lg p-2 bg-transparent whitespace-pre-wrap">
                                                            {renderMessageContent(msg.content)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Edit and Delete buttons - appear on hover */}
                                            {editingMessageId !== msg.id && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        onClick={() => {
                                                            setEditingMessageId(msg.id);
                                                            setEditContent(msg.content);
                                                        }}
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => {
                                                            if (confirm("Мессежийг устгах уу?")) {
                                                                deleteMessageMutation.mutate(msg.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Typing indicator */}
                        {
                            typingUsers.length > 0 && (
                                <div className="px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                    <span className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </span>
                                    <span>Бичиж байна...</span>
                                </div>
                            )
                        }

                        {/* Message Input */}
                        < div className="p-4 border-t" >
                            {/* File Preview */}
                            {selectedFile && (
                                <div className="mb-3 p-2 bg-muted/50 rounded-lg flex items-center gap-3">
                                    {filePreview ? (
                                        <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                                    ) : (
                                        <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                                            <Paperclip className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={removeSelectedFile}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}

                            {/* Mention list */}
                            {showMentions && (
                                <div className="absolute bottom-16 left-4 z-50 w-64 bg-popover border rounded-md shadow-md overflow-hidden">
                                    <Command className="max-h-60">
                                        <CommandList>
                                            <CommandGroup heading="Гишүүд">
                                                {channelMembers
                                                    .filter(m => {
                                                        const employee = employees.find(e => e.id === m.userId);
                                                        return employee?.fullName.toLowerCase().includes(mentionQuery.toLowerCase());
                                                    })
                                                    .map(m => {
                                                        const employee = employees.find(e => e.id === m.userId);
                                                        if (!employee) return null;
                                                        return (
                                                            <CommandItem
                                                                key={m.id}
                                                                onSelect={() => insertMention(employee.fullName)}
                                                                className="cursor-pointer"
                                                            >
                                                                <Avatar className="w-6 h-6 mr-2">
                                                                    <AvatarFallback>{employee.fullName[0]}</AvatarFallback>
                                                                </Avatar>
                                                                {employee.fullName}
                                                            </CommandItem>
                                                        );
                                                    })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                />

                                {/* File upload button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                >
                                    <Paperclip className="w-4 h-4" />
                                </Button>

                                <Textarea
                                    value={newMessage}
                                    onChange={handleInputChange}
                                    placeholder="Мессеж бичих..."
                                    className="flex-1 min-h-[44px] max-h-32 resize-none py-3"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                        // Close mentions on escape
                                        if (e.key === "Escape") {
                                            setShowMentions(false);
                                        }
                                    }}
                                />

                                {/* Emoji Picker */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Smile className="w-4 h-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2" align="end">
                                        <div className="grid grid-cols-8 gap-1">
                                            {commonEmojis.map((emoji) => (
                                                <button
                                                    key={emoji}
                                                    className="w-7 h-7 text-lg hover:bg-muted rounded transition-colors flex items-center justify-center"
                                                    onClick={() => addEmoji(emoji)}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>

                                <Button
                                    size="icon"
                                    onClick={handleSendMessage}
                                    disabled={(!newMessage.trim() && !selectedFile) || isUploading}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Чат сонгоно уу</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Preview Lightbox */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-transparent border-none shadow-none flex flex-col justify-center items-center">
                    <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                        <div className="pointer-events-auto relative">
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute -top-10 right-0 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm z-50"
                                onClick={() => setPreviewImage(null)}
                            >
                                <X className="w-6 h-6" />
                            </Button>
                            {previewImage && (
                                <img
                                    src={previewImage}
                                    alt="Preview"
                                    className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
};

// ==========================================
// Main Communication Page
// ==========================================

export default function CommunicationPage() {
    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <Tabs defaultValue="announcements" className="flex-1 flex flex-col">
                <div className="border-b px-6 py-2 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 dark:from-blue-600/5 dark:via-purple-600/5 dark:to-pink-600/5">
                    <TabsList className="bg-transparent">
                        <TabsTrigger value="announcements" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                            <Bell className="w-4 h-4" />
                            Зарлал
                        </TabsTrigger>
                        <TabsTrigger value="chat" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                            <MessageSquare className="w-4 h-4" />
                            Чат
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="announcements" className="flex-1 m-0 data-[state=inactive]:hidden">
                    <AnnouncementsTab />
                </TabsContent>

                <TabsContent value="chat" className="flex-1 m-0 data-[state=inactive]:hidden">
                    <ChatTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
