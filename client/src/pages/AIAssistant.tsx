import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Code2,
  FileSearch,
  BarChart3,
  MessageSquare,
  Copy,
  Check,
  Trash2,
  StopCircle,
  ChevronDown,
  Zap,
  Globe,
  PlusCircle,
  Clock,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { mn } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface QuickPrompt {
  icon: React.ElementType;
  label: string;
  prompt: string;
  color: string;
}

// ─── Quick Prompts ─────────────────────────────────────────────────────────
const QUICK_PROMPTS: QuickPrompt[] = [
  // {
  //   icon: Code2,
  //   label: "Код бичих",
  //   prompt: "ERP системд шинэ CRUD endpoint бичихэд туслаач. Express + TypeScript + Drizzle ORM ашиглана.",
  //   color: "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-400",
  // },
  {
    icon: BarChart3,
    label: "Тайлан үүсгэх",
    prompt: "Энэ сарын борлуулалтын тайлан гаргахад хэрхэн тусалж чадах вэ? Ямар өгөгдөл хэрэгтэй вэ?",
    color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
  },
  // {
  //   icon: FileSearch,
  //   label: "Код шалгах",
  //   prompt: "Дараах TypeScript кодыг шалгаад алдаа, аюулгүй байдлын асуудлуудыг тайлбарлаач:",
  //   color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400",
  // },
  {
    icon: MessageSquare,
    label: "ERP тусламж",
    prompt: "MonERP системийн ямар функцүүд байдаг вэ? Хэрхэн ашиглах вэ?",
    color: "from-emerald-500/20 to-green-500/20 border-emerald-500/30 text-emerald-400",
  },
];

// ─── Code block renderer ──────────────────────────────────────────────────
function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("```")) {
      const lines = part.split("\n");
      const lang = lines[0].replace("```", "").trim();
      const code = lines.slice(1, -1).join("\n");
      return (
        <div key={idx} className="my-3 rounded-xl overflow-hidden border border-white/10">
          <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
            <span className="text-xs font-mono text-muted-foreground">{lang || "code"}</span>
            <CopyButton text={code} />
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 bg-black/30">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    // Bold, inline code
    const formatted = part
      .split(/(`[^`]+`)/g)
      .map((s, i) =>
        s.startsWith("`") && s.endsWith("`") ? (
          <code key={i} className="px-1.5 py-0.5 rounded bg-muted text-violet-600 dark:text-violet-300 font-mono text-[0.85em]">
            {s.slice(1, -1)}
          </code>
        ) : (
          s.split(/(\*\*[^*]+\*\*)/g).map((b, j) =>
            b.startsWith("**") && b.endsWith("**") ? (
              <strong key={j} className="font-semibold text-foreground">{b.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{b}</span>
            )
          )
        )
      );
    return <span key={idx}>{formatted}</span>;
  });
}

// ─── Copy Button ──────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Хуулагдлаа" : "Хуулах"}
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1",
          isUser
            ? "bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25"
            : "bg-secondary border border-border"
        )}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-foreground/80" />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-tr-sm shadow-lg shadow-violet-500/20"
              : "bg-muted/40 border border-border text-foreground rounded-tl-sm shadow-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose-sm">
              {msg.isStreaming && msg.content === "" ? (
                <div className="flex gap-1 items-center py-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{renderContent(msg.content)}</div>
              )}
              {msg.isStreaming && msg.content !== "" && (
                <span className="inline-block w-0.5 h-4 bg-violet-400 animate-pulse ml-0.5 align-bottom" />
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {msg.timestamp.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function AIAssistant() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasAutoSelected = useRef(false);

  // Fetch sessions
  const { data: sessions = [], isSuccess: sessionsLoaded, refetch: refetchSessions } = useQuery({
    queryKey: ["ai-chat-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/ai/chat/sessions");
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    }
  });

  // Load history when a session is explicitly selected
  const loadSession = useCallback((id: string) => {
    if (id === sessionId) return;
    setSessionId(id);
    fetch(`/api/ai/chat/sessions/${id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt)
          })));
        }
      });
  }, [sessionId]);

  // Auto-select most recent session on first load
  useEffect(() => {
    if (sessionsLoaded && !hasAutoSelected.current) {
      hasAutoSelected.current = true;
      if (sessions.length > 0) {
        loadSession(sessions[0].id);
      }
    }
  }, [sessions, sessionsLoaded, loadSession]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  };


  // Send message
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
        signal: abortRef.current.signal,
      });

      if (res.status === 429) {
        const data = await res.json();
        throw new Error(data.error || "Rate limit exceeded");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.sessionId && !sessionId) {
              // If this is a new session, update state and refetch sidebar
              setSessionId(data.sessionId);
              refetchSessions();
            }
            if (data.done) {
              refetchSessions();
              break;
            }
            if (data.error) throw new Error(data.error);
            if (data.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsg.id ? { ...m, content: m.content + data.text } : m
                )
              );
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsg.id
              ? { ...m, content: `❌ Алдаа гарлаа: ${err.message}`, isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsg.id ? { ...m, isStreaming: false } : m))
      );
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setSessionId(null);
    setMessages([]);
    setInput("");
  };

  const useQuickPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const renderSidebarContent = () => (
    <>
      <div className="p-4 border-b border-border/50 shrink-0">
        <Button onClick={() => { clearChat(); setMobileSidebarOpen(false); }} className="w-full justify-start gap-2" variant="outline">
          <PlusCircle className="w-4 h-4" />
          Шинэ чат
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map((s: any) => (
            <button
              key={s.id}
              onClick={() => { loadSession(s.id); setMobileSidebarOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors group flex flex-col gap-1",
                sessionId === s.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="font-medium truncate">{s.title}</div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-70">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: mn })}
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="text-center text-xs text-muted-foreground p-4">
              Өмнөх яриа байхгүй байна
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div className="flex h-full bg-background overflow-hidden relative">
      {/* ─── Desktop Sidebar (Sessions) ────────────────────────────────────────── */}
      <div
        className={cn(
          "flex-shrink-0 flex-col border-r border-border/50 bg-muted/20 transition-all duration-300 overflow-hidden hidden md:flex",
          sidebarOpen ? "w-64" : "w-0 border-r-0"
        )}
      >
        {renderSidebarContent()}
      </div>

      {/* ─── Main Chat Area ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Desktop Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="mr-1 h-8 w-8 text-muted-foreground hidden md:flex"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="w-4 h-4" />
              </Button>

              {/* Mobile Toggle (Sheet Trigger) */}
              <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 h-8 w-8 text-muted-foreground md:hidden"
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 flex flex-col w-[280px] glass-card border-r-0">
                  <SheetTitle className="sr-only">AI Чатын түүх</SheetTitle>
                  <div className="p-4 border-b border-border/50 sidebar-gradient text-white flex items-center gap-3 shrink-0">
                    <div className="relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold font-display tracking-tight text-white">AI Туслагч</h1>
                    </div>
                  </div>
                  {renderSidebarContent()}
                </SheetContent>
              </Sheet>

              <div className="relative w-8 h-8 md:w-10 md:h-10">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 opacity-20 blur-sm" />
                <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-violet-400" />
                </div>
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                  MonERP AI Туслагч
                  {/* <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-400 border-violet-500/20">
                    claude-opus-4-5
                  </Badge> */}
                </h1>
                {/* <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="w-3 h-3" />
                  <span>AWS Bedrock</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Ажиллаж байна</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Streaming</span>
                </div>
              </div> */}
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-muted-foreground hover:text-destructive gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Цэвэрлэх
              </Button>
            )}
          </div>
        </div>

        {/* ─── Messages Area ───────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto px-6 py-6"
            style={{ scrollBehavior: "smooth" }}
          >
            {messages.length === 0 ? (
              /* Welcome State */
              <div className="h-full flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto">
                {/* Hero */}
                <div className="text-center">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 opacity-20 blur-xl scale-110" />
                    <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-violet-400" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Сайн уу! Би таны AI туслагч
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
                    AWS Bedrock дээрх <span className="text-violet-400 font-medium">Claude claude-opus-4-5</span> загварыг ашиглан
                    ERP системийн аливаа асуултанд хариулахад туслана.
                  </p>
                </div>

                {/* Quick Prompts Grid */}
                {/* <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {QUICK_PROMPTS.map((qp) => {
                    const Icon = qp.icon;
                    return (
                      <button
                        key={qp.label}
                        onClick={() => useQuickPrompt(qp.prompt)}
                        className={cn(
                          "group flex flex-col gap-2 p-4 rounded-xl border bg-gradient-to-br text-left",
                          "transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
                          qp.color
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{qp.label}</span>
                        <span className="text-xs opacity-70 line-clamp-2">{qp.prompt.slice(0, 60)}...</span>
                      </button>
                    );
                  })}
                </div> */}

                <p className="text-xs text-muted-foreground text-center">
                  Enter дарж илгээх · Shift+Enter шинэ мөр
                </p>
              </div>
            ) : (
              /* Messages */
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
              </div>
            )}
          </div>

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-card border border-border shadow-lg flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ─── Input Area ─────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-3 p-3 rounded-2xl border border-border/60 bg-background/50 focus-within:border-violet-500/50 focus-within:shadow-lg focus-within:shadow-violet-500/10 transition-all duration-200">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Асуулт бичэх... (Enter = илгээх, Shift+Enter = шинэ мөр)"
                className="flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-muted-foreground/60 py-2 px-1"
                rows={1}
                disabled={isStreaming}
              />
              <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
                {isStreaming ? (
                  <Button
                    onClick={stopStreaming}
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                  >
                    <StopCircle className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25 border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </Button>
                )}
              </div>
            </div>
            {/* <p className="text-center text-[10px] text-muted-foreground mt-2">
              Claude claude-opus-4-5 · AWS Bedrock · us-east-1 region
            </p> */}
          </div>
        </div>
      </div>
    </div>
  );
}
