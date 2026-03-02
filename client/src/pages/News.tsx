import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/hooks/use-employees";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Heart, MessageCircle, Share2, Pin, Plus, Loader2, Send, Trash2, Edit,
  Bell, Trophy, Cake, Calendar, Image as ImageIcon, X, AlertTriangle, Link as LinkIcon, Search, Filter,
  Paperclip, FileText, Smile
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";

interface Post {
  id: string;
  title: string;
  content: string;
  postType: string;
  severity?: "info" | "warning" | "critical";
  actions?: { label: string; url: string; style: "primary" | "outline" | "ghost" }[];
  files?: { name: string; url: string; size: number; type: string }[];
  authorName: string;
  authorId: string;
  images?: string[] | null;
  likesCount: number;
  commentsCount: number;
  isPinned: boolean;
  createdAt: string;
  reactionType?: string;
  currentUserReaction?: string;
}

interface Comment {
  id: string;
  content: string;
  employeeName: string;
  employeeId: string;
  createdAt: string;
}

export default function News() {
  const { user } = useAuth();
  const { employees } = useEmployees();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<{ [postId: string]: string }>({});
  const [refreshedComments, setRefreshedComments] = useState<{ postId: string; comments: Comment[] } | null>(null);
  const [postContent, setPostContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postType, setPostType] = useState("announcement");
  const [postSeverity, setPostSeverity] = useState<"info" | "warning" | "critical">("info");
  const [postActions, setPostActions] = useState<{ label: string; url: string; style: "primary" | "outline" | "ghost" }[]>([]);
  const [newAction, setNewAction] = useState({ label: "", url: "", style: "primary" as const });

  // File Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");

  // Get current employee
  const currentEmployee = employees?.find((e: any) =>
    e.email === user?.email ||
    (user?.email && user.email.toLowerCase() === e.email?.toLowerCase())
  );

  // Fetch posts with deduplication and sorting
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts", searchQuery, filterType, filterSeverity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (filterType && filterType !== "all") params.append("type", filterType);
      if (filterSeverity && filterSeverity !== "all") params.append("severity", filterSeverity);
      params.append("limit", "50");

      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch posts");
      const data = await res.json();

      // Deduplicate by ID
      const uniquePosts = Array.from(new Map(data.map((p: Post) => [p.id, p])).values()) as Post[];

      // Sort: Pinned first, then by date desc
      return uniquePosts.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
  });

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!postContent.trim() && !postTitle.trim()) {
      toast({ title: "Error", description: "Title and content are required", variant: "destructive" });
      return;
    }

    try {
      setIsUploading(true);
      const uploadedFiles = [];

      // Upload files first
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          uploadedFiles.push({
            name: file.name,
            url: data.url,
            size: data.size,
            type: data.mimetype
          });
        }
      }

      await createPost.mutateAsync({
        title: postTitle,
        content: postContent,
        postType,
        severity: postSeverity,
        actions: postActions,
        files: uploadedFiles,
      });
      setCreatePostOpen(false);
      setPostContent("");
      setPostTitle("");
      setPostActions([]);
      setSelectedFiles([]);
      setPostSeverity("info");
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create post", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleReaction = useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: string, reactionType: string }) => {
      // Optimistically update
      queryClient.setQueryData(["/api/posts", searchQuery, filterType, filterSeverity], (old: Post[] | undefined) => {
        if (!old) return [];
        return old.map(p => {
          if (p.id === postId) {
            const wasLiked = !!p.currentUserReaction;
            const sameReaction = p.currentUserReaction === reactionType;

            let newCount = p.likesCount;
            if (sameReaction) {
              newCount--; // Remove reaction
            } else if (!wasLiked) {
              newCount++; // Add reaction
            }
            // If changing reaction type, count stays same

            return {
              ...p,
              likesCount: newCount,
              currentUserReaction: sameReaction ? undefined : reactionType
            };
          }
          return p;
        });
      });

      await apiRequest("POST", `/api/posts/${postId}/like`, { reactionType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  // Create post mutation
  const createPost = useMutation({


    mutationFn: async (data: any) => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        // Try to parse error as JSON, fallback to text
        let errorMessage = "Мэдээлэл нийтлэхэд алдаа гарлаа";
        try {
          const error = await res.json();
          errorMessage = error.message || errorMessage;
        } catch {
          // If response is not JSON (e.g., "Unauthorized"), use status text
          errorMessage = res.status === 401 || res.status === 403
            ? "Эрх хүрэхгүй байна. Админ эсвэл Manager эрхтэй байх шаардлагатай."
            : res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setCreatePostOpen(false);
      toast({ title: "Амжилттай", description: "Мэдээлэл амжилттай нийтлэгдлээ." });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "Мэдээлэл нийтлэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });



  // Create comment mutation
  const createComment = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create comment");
      }
      return res.json();
    },
    onSuccess: async (_, { postId }) => {
      // Invalidate posts list to update comment counts
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      // Re-fetch comments for this post to update local state
      try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setRefreshedComments({ postId, comments: data });
        }
      } catch (e) {
        // Fallback: comments will be stale until manual refresh
      }
      setCommentTexts((prev) => ({ ...prev, [postId]: "" }));
    },
  });

  // Delete post mutation
  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete post");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Амжилттай", description: "Мэдээлэл устгагдлаа." });
    },
  });



  // Check if user can create posts (must be admin/manager or have employee record)
  const canCreatePost = user?.role === "Admin" || user?.role === "Manager" || !!currentEmployee;

  // Generate Demo News mutation
  const generateDemoNews = useMutation({
    mutationFn: async () => {
      const demoData = [
        {
          title: '"Шинэ жил 2026" баярын үдэшлэг 🎄',
          content: `<p>Сайн байцгаана уу? Манай компанийн ээлжит шинэ жилийн баярын үдэшлэг ирэх Баасан гарагт "Shangri-La" ресторанд болно. Та бүхэн 18:00 цагт хоцрохгүй ирээрэй.</p><p><strong>Dress Code:</strong> Tuxedo & Evening Gown. Шилдэг хувцаслалттай ажилтныг сюрприз хүлээж байна! 🥂✨</p>`,
          postType: "event",
        },
        {
          title: "Системийн төлөвлөгөөт шинэчлэл ⚠️",
          content: `<p><strong>Анхаар:</strong> Системийн серверт засвар үйлчилгээ хийх тул 2026-01-25-ны Бямба гарагийн 22:00-00:00 цагийн хооронд ERP систем түр зогсохыг мэдэгдье.</p><p>Энэ хугацаанд мэдээлэл хадгалагдахгүй тул та бүхэн ажлаа эрт зохицуулна уу. 🛠️</p>`,
          postType: "maintenance",
        },
        {
          title: "Багтаа тавтай морил: Б.Болд 👋",
          content: `<p>Манай IT багт <strong>Ахлах хөгжүүлэгч</strong>-ээр Б.Болд нэгдэж байна. Тэрээр Fintech салбарт 5 жил ажилласан туршлагатай бөгөөд манай шинэ Mobile App төсөл дээр ажиллах болно.</p><p>Болдоо, амжилт хүсье! Бүгдээрээ тусалж дэмжээрэй. 🚀</p>`,
          postType: "hr",
        },
      ];

      for (const post of demoData) {
        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(post),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Амжилттай", description: "Demo мэдээллүүд үүсгэгдлээ!" });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "Demo мэдээлэл үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Мэдээлэл 📢
          </h2>
          <p className="text-muted-foreground mt-2">
            Компанийн мэдээлэл, мэдэгдэл, амжилтууд
          </p>

          {/* Search and Filters */}
          <div className="flex flex-wrap gap-2 mt-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Төрөл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх төрөл</SelectItem>
                <SelectItem value="announcement">📢 Мэдэгдэл</SelectItem>
                <SelectItem value="maintenance">⚠️ Засвар</SelectItem>
                <SelectItem value="event">🎉 Арга хэмжээ</SelectItem>
                <SelectItem value="hr">👋 HR</SelectItem>
                <SelectItem value="birthday">🎂 Төрсөн өдөр</SelectItem>
                <SelectItem value="achievement">🏆 Амжилт</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px]">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Зэрэглэл" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүгд</SelectItem>
                <SelectItem value="info">ℹ️ Мэдээлэл</SelectItem>
                <SelectItem value="warning">⚠️ Анхааруулга</SelectItem>
                <SelectItem value="critical">🚨 Чухал</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {canCreatePost && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateDemoNews.mutate()}
              disabled={generateDemoNews.isPending}
            >
              {generateDemoNews.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              🎲 Demo Data
            </Button>
            <Dialog open={createPostOpen} onOpenChange={setCreatePostOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Мэдээлэл нийтлэх
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Шинэ мэдээлэл нийтлэх</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Төрөл</Label>
                      <Select value={postType} onValueChange={setPostType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="announcement">📢 Мэдэгдэл</SelectItem>
                          <SelectItem value="maintenance">⚠️ Засвар үйлчилгээ</SelectItem>
                          <SelectItem value="event">🎉 Арга хэмжээ</SelectItem>
                          <SelectItem value="hr">👋 Шинэ ажилтан</SelectItem>
                          <SelectItem value="birthday">🎂 Төрсөн өдөр</SelectItem>
                          <SelectItem value="achievement">🏆 Амжилт</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Зэрэглэл</Label>
                      <Select value={postSeverity} onValueChange={(v: any) => setPostSeverity(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">ℹ️ Мэдээлэл</SelectItem>
                          <SelectItem value="warning">⚠️ Анхааруулга</SelectItem>
                          <SelectItem value="critical">🚨 Чухал</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Гарчиг</Label>
                    <Input
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      placeholder="Мэдээллийн гарчиг"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Агуулга</Label>
                    <RichTextEditor
                      value={postContent}
                      onChange={setPostContent}
                      placeholder="Мэдээллийн агуулга оруулах..."
                    />
                  </div>

                  {/* File Attachments */}
                  <div className="space-y-2">
                    <Label>Хавсралт файл</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedFiles.map((file, i) => (
                        <Badge key={i} variant="secondary" className="flex items-center gap-1">
                          {file.name}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => removeFile(i)} />
                        </Badge>
                      ))}
                      <div className="relative">
                        <Input type="file" multiple className="hidden" id="file-upload" onChange={handleFileSelect} />
                        <Label htmlFor="file-upload" className="cursor-pointer">
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span><Paperclip className="h-4 w-4 mr-2" /> Файл нэмэх</span>
                          </Button>
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Action Builder */}
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Label>Товчлуур нэмэх (Actions)</Label>
                    <div className="flex gap-2 items-end">
                      <div className="grid gap-2 flex-1">
                        <Label className="text-xs">Товчлуурын нэр</Label>
                        <Input
                          value={newAction.label}
                          onChange={(e) => setNewAction({ ...newAction, label: e.target.value })}
                          placeholder="Жишээ: Бүртгүүлэх"
                        />
                      </div>
                      <div className="grid gap-2 flex-1">
                        <Label className="text-xs">URL (Холбоос)</Label>
                        <Input
                          value={newAction.url}
                          onChange={(e) => setNewAction({ ...newAction, url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="grid gap-2 w-32">
                        <Label className="text-xs">Төрөл</Label>
                        <Select value={newAction.style} onValueChange={(v: any) => setNewAction({ ...newAction, style: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            <SelectItem value="outline">Outline</SelectItem>
                            <SelectItem value="ghost">Ghost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          if (newAction.label && newAction.url) {
                            setPostActions([...postActions, newAction]);
                            setNewAction({ label: "", url: "", style: "primary" });
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {postActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {postActions.map((action, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-2 pl-2 pr-1 py-1">
                            {action.label}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1 hover:bg-transparent"
                              onClick={() => setPostActions(postActions.filter((_, i) => i !== idx))}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreatePostOpen(false);
                        setPostTitle("");
                        setPostContent("");
                        setPostType("announcement");
                        setPostSeverity("info");
                        setPostActions([]);
                      }}
                    >
                      Цуцлах
                    </Button>
                    <Button type="submit" disabled={createPost.isPending || !postTitle.trim() || !postContent.trim()}>
                      {createPost.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Нийтлэх
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Posts Feed */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">Мэдээлэл байхгүй байна</p>
              <p className="text-sm text-muted-foreground mt-2">
                Эхний мэдээллийг нийтлэх үү?
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Pinned Posts - Full Width */}
            {posts.filter(p => p.isPinned).length > 0 && (
              <div className="space-y-4">
                {posts.filter(p => p.isPinned).map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentEmployee={currentEmployee}
                    onReaction={(type) => toggleReaction.mutate({ postId: post.id, reactionType: type })}
                    onComment={(content) => createComment.mutate({ postId: post.id, content })}
                    onDelete={user?.role === "Admin" || (currentEmployee && post.authorId === currentEmployee.id) ? () => deletePost.mutate(post.id) : undefined}
                    expandedComments={expandedComments}
                    setExpandedComments={setExpandedComments}
                    refreshedComments={refreshedComments}
                    commentTexts={commentTexts}
                    setCommentTexts={setCommentTexts}
                    isFullWidth
                  />
                ))}
              </div>
            )}

            {/* Regular Posts - Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.filter(p => !p.isPinned).map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentEmployee={currentEmployee}
                  onReaction={(type) => toggleReaction.mutate({ postId: post.id, reactionType: type })}
                  onComment={(content) => createComment.mutate({ postId: post.id, content })}
                  onDelete={user?.role === "Admin" || (currentEmployee && post.authorId === currentEmployee.id) ? () => deletePost.mutate(post.id) : undefined}
                  expandedComments={expandedComments}
                  setExpandedComments={setExpandedComments}
                  commentTexts={commentTexts}
                  setCommentTexts={setCommentTexts}
                  refreshedComments={refreshedComments}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PostCard = React.memo(function PostCard({
  post,
  currentEmployee,
  onReaction,
  onComment,
  onDelete,
  expandedComments,
  setExpandedComments,
  commentTexts,
  setCommentTexts,
  isFullWidth = false,
  refreshedComments,
}: {
  post: Post;
  currentEmployee: any;
  onReaction: (type: string) => void;
  onComment: (content: string) => void;
  onDelete?: () => void;
  expandedComments: Set<string>;
  setExpandedComments: (set: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  commentTexts: { [postId: string]: string };
  setCommentTexts: (texts: { [postId: string]: string } | ((prev: any) => any)) => void;
  isFullWidth?: boolean;
  refreshedComments?: { postId: string; comments: Comment[] } | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCommentsExpanded = expandedComments.has(post.id);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  // Update comments when parent signals a refresh (after creating a comment)
  React.useEffect(() => {
    if (refreshedComments && refreshedComments.postId === post.id) {
      setComments(refreshedComments.comments);
    }
  }, [refreshedComments, post.id]);

  const formatSafeDistance = (dateStr: string) => {
    try {
      // Enforce UTC if Z is missing to handle server offset
      const date = new Date(dateStr + (dateStr.endsWith('Z') || dateStr.includes('+') ? '' : 'Z'));
      if (isNaN(date.getTime())) return "Мэдэгдэхгүй";

      // If it's in the future (due to slight clock desync), show "Just now"
      if (date > new Date()) return "Дөнгөж сая";

      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Мэдэгдэхгүй";
    }
  };

  const loadComments = async () => {
    if (isCommentsExpanded) {
      setExpandedComments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(post.id);
        return newSet;
      });
      return;
    }

    setIsLoadingComments(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      setComments(data);
      setExpandedComments((prev) => new Set(prev).add(post.id));
    } catch (err: any) {
      toast({
        title: "Алдаа",
        description: err.message || "Сэтгэгдэл авахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsLoadingComments(false);
    }
  };

  const postTypeConfig: { [key: string]: { icon: any; label: string; className: string } } = {
    announcement: { icon: Bell, label: "Мэдэгдэл", className: "bg-blue-100 text-blue-700 border-blue-200" },
    maintenance: { icon: Bell, label: "Засвар", className: "bg-red-100 text-red-700 border-red-200" },
    event: { icon: Calendar, label: "Арга хэмжээ", className: "bg-green-100 text-green-700 border-green-200" },
    hr: { icon: Bell, label: "HR", className: "bg-purple-100 text-purple-700 border-purple-200" },
    birthday: { icon: Cake, label: "Төрсөн өдөр", className: "bg-pink-100 text-pink-700 border-pink-200" },
    achievement: { icon: Trophy, label: "Амжилт", className: "bg-amber-100 text-amber-700 border-amber-200" },
  };

  const severityConfig: { [key: string]: { label: string; className: string; icon?: any } } = {
    info: { label: "Мэдээлэл", className: "bg-slate-100 text-slate-700 border-slate-200" },
    warning: { label: "Анхааруулга", className: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
    critical: { label: "Чухал", className: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  };

  const typeConfig = postTypeConfig[post.postType] || postTypeConfig.announcement;
  const PostTypeIcon = typeConfig.icon;
  const severity = severityConfig[post.severity as string] || severityConfig.info;
  const SeverityIcon = severity.icon;

  return (
    <Card className={`${post.isPinned ? "border-primary border-2 shadow-md" : ""} ${post.severity === 'critical' ? "border-red-500 border-2" : ""} ${isFullWidth ? "" : "h-full flex flex-col"}`}>
      {/* Category Badge at top */}
      <div className="px-4 pt-4 flex flex-wrap gap-2">
        {post.isPinned && (
          <Badge variant="default" className="gap-1 bg-primary text-primary-foreground">
            <Pin className="w-3 h-3" />
            Онцлох
          </Badge>
        )}

        {post.severity && post.severity !== 'info' && (
          <Badge className={`${severity.className} gap-1`}>
            {SeverityIcon && <SeverityIcon className="w-3 h-3" />}
            {severity.label}
          </Badge>
        )}

        <Badge className={`${typeConfig.className} gap-1`}>
          <PostTypeIcon className="w-3 h-3" />
          {typeConfig.label}
        </Badge>
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Avatar>
              <AvatarFallback>
                {post.authorName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className={`${isFullWidth ? "text-xl" : "text-lg"} line-clamp-2`}>{post.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {post.authorName} • {formatSafeDistance(post.createdAt)}
              </p>
            </div>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Та энэ мэдээллийг устгахдаа итгэлтэй байна уу?")) {
                  onDelete();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_img]:rounded-lg [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.images && post.images.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {post.images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Post image ${idx + 1}`}
                className="rounded-lg object-cover w-full h-48"
              />
            ))}
          </div>
        )}

        {/* Files Section */}
        {post.files && post.files.length > 0 && (
          <div className="mt-4 space-y-2">
            {post.files.map((file, i) => (
              <a key={i} href={file.url} target="_blank" rel="noreferrer" className="flex items-center p-2 border rounded hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm font-medium flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
              </a>
            ))}
          </div>
        )}

        {/* CTA Actions */}
        {post.actions && post.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {post.actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.style as any || "default"}
                size="sm"
                className="gap-2"
                asChild
              >
                <a href={action.url} target="_blank" rel="noopener noreferrer">
                  <LinkIcon className="w-4 h-4" />
                  {action.label}
                </a>
              </Button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t">

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={post.currentUserReaction ? "text-primary" : "text-muted-foreground"}>
                {post.currentUserReaction === 'love' ? '❤️' :
                  post.currentUserReaction === 'haha' ? '😂' :
                    post.currentUserReaction === 'wow' ? '😮' :
                      post.currentUserReaction === 'sad' ? '😢' :
                        post.currentUserReaction === 'angry' ? '😡' :
                          <Heart className={`w-4 h-4 mr-2 ${post.currentUserReaction === 'like' ? "fill-current" : ""}`} />
                }
                {post.likesCount > 0 && post.likesCount} {post.likesCount > 0 ? " " : " Like"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1 flex gap-1">
              {['like', 'love', 'haha', 'wow', 'sad', 'angry'].map(type => (
                <button
                  key={type}
                  className="p-2 hover:bg-muted rounded-full text-lg transition-transform hover:scale-125 focus:outline-none"
                  onClick={() => onReaction(type)}
                >
                  {type === 'like' ? '👍' :
                    type === 'love' ? '❤️' :
                      type === 'haha' ? '😂' :
                        type === 'wow' ? '😮' :
                          type === 'sad' ? '😢' : '😡'}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadComments}
            disabled={isLoadingComments}
          >
            {isLoadingComments ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            {post.commentsCount > 0 ? post.commentsCount : "Сэтгэгдэл"}
          </Button>
        </div>

        {/* Comments Section */}
        {isCommentsExpanded && (
          <div className="border-t pt-4 space-y-4">
            {/* Comment List */}
            {comments.length > 0 && (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {(comment.employeeName || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{comment.employeeName || "Хэрэглэгч"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSafeDistance(comment.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment Input */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Сэтгэгдэл бичих..."
                value={commentTexts[post.id] || ""}
                onChange={(e) => setCommentTexts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  const text = commentTexts[post.id]?.trim();
                  if (text) {
                    onComment(text);
                  }
                }}
                disabled={!commentTexts[post.id]?.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card >
  );
});
