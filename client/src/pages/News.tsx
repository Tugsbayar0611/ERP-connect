import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/hooks/use-employees";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Heart, MessageCircle, Share2, Pin, Plus, Loader2, Send, Trash2, Edit,
  Bell, Trophy, Cake, Calendar, Image as ImageIcon, X
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

interface Post {
  id: string;
  title: string;
  content: string;
  postType: string;
  authorName: string;
  authorId: string;
  images?: string[] | null;
  likesCount: number;
  commentsCount: number;
  isPinned: boolean;
  createdAt: string;
  isLiked?: boolean;
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
  const [postContent, setPostContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postType, setPostType] = useState("announcement");

  // Get current employee
  const currentEmployee = employees?.find((e: any) =>
    e.email === user?.email ||
    (user?.email && user.email.toLowerCase() === e.email?.toLowerCase())
  );

  // Fetch posts
  const { data: posts = [], isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts?limit=50");
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
  });

  // Create post mutation
  const createPost = useMutation({
    mutationFn: async (data: { title: string; content: string; postType: string; images?: string[] }) => {
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

  // Toggle like mutation
  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to toggle like");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
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
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts", "comments", _] });
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

  const handleCreatePost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) {
      toast({
        title: "Алдаа",
        description: "Гарчиг болон агуулга бөглөнө үү",
        variant: "destructive",
      });
      return;
    }
    const data = {
      title: postTitle,
      content: postContent,
      postType: postType || "announcement",
    };
    createPost.mutate(data, {
      onSuccess: () => {
        // Reset form
        setPostTitle("");
        setPostContent("");
        setPostType("announcement");
      },
    });
  };

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

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreatePostOpen(false);
                        setPostTitle("");
                        setPostContent("");
                        setPostType("announcement");
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
                    onLike={() => toggleLike.mutate(post.id)}
                    onComment={(content) => createComment.mutate({ postId: post.id, content })}
                    onDelete={user?.role === "Admin" || (currentEmployee && post.authorId === currentEmployee.id) ? () => deletePost.mutate(post.id) : undefined}
                    expandedComments={expandedComments}
                    setExpandedComments={setExpandedComments}
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
                  onLike={() => toggleLike.mutate(post.id)}
                  onComment={(content) => createComment.mutate({ postId: post.id, content })}
                  onDelete={user?.role === "Admin" || (currentEmployee && post.authorId === currentEmployee.id) ? () => deletePost.mutate(post.id) : undefined}
                  expandedComments={expandedComments}
                  setExpandedComments={setExpandedComments}
                  commentTexts={commentTexts}
                  setCommentTexts={setCommentTexts}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Post Card Component - Memoized to prevent unnecessary re-renders
const PostCard = React.memo(function PostCard({
  post,
  currentEmployee,
  onLike,
  onComment,
  onDelete,
  expandedComments,
  setExpandedComments,
  commentTexts,
  setCommentTexts,
  isFullWidth = false,
}: {
  post: Post;
  currentEmployee: any;
  onLike: () => void;
  onComment: (content: string) => void;
  onDelete?: () => void;
  expandedComments: Set<string>;
  setExpandedComments: (set: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  commentTexts: { [postId: string]: string };
  setCommentTexts: (texts: { [postId: string]: string } | ((prev: any) => any)) => void;
  isFullWidth?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isCommentsExpanded = expandedComments.has(post.id);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

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

  const typeConfig = postTypeConfig[post.postType] || postTypeConfig.announcement;
  const PostTypeIcon = typeConfig.icon;

  return (
    <Card className={`${post.isPinned ? "border-primary border-2" : ""} ${isFullWidth ? "" : "h-full flex flex-col"}`}>
      {/* Category Badge at top */}
      <div className="px-4 pt-4 flex flex-wrap gap-2">
        {post.isPinned && (
          <Badge variant="default" className="gap-1">
            <Pin className="w-3 h-3" />
            Чухал
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
                {post.authorName} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
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

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLike}
            className={post.isLiked ? "text-red-500 hover:text-red-600" : ""}
          >
            <Heart className={`w-4 h-4 mr-2 ${post.isLiked ? "fill-current" : ""}`} />
            {post.likesCount}
          </Button>

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
            {post.commentsCount}
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
                        {comment.employeeName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{comment.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
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
