import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Folder, FileText, ArrowLeft, Upload, Search, Filter, Plus, Home, ChevronRight,
  File as FileIcon, CheckCircle, ShieldCheck, Download, Trash2, Edit2, X, CheckSquare, Square,
  Clock, AlertCircle, Info, Send, MoreHorizontal, User as UserIcon, Archive, Eye, RotateCcw
} from "lucide-react";
import { format, addDays } from "date-fns";
import { mn } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTenantUsers, useForwardRecipients } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth"; // Ensure we know current user role for helper text
import { isPrivileged } from "@shared/roles";
import { DocumentHistory } from "@/components/document-history";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- Types ---

type DocumentType = 'incoming' | 'outgoing' | 'internal' | 'folder' | 'file';
type DocumentPriority = 'normal' | 'urgent' | 'critical';
type DocumentStatus = 'draft' | 'pending' | 'processing' | 'completed' | 'expired' | 'unsolved';



interface Document {
  id: string;
  tenantId: string;
  name: string;
  docNumber?: string;
  description?: string;
  type: DocumentType;
  priority?: DocumentPriority;
  status: DocumentStatus;

  // File props
  mimeType?: string;
  path: string;
  size?: number;
  parentId?: string | null;

  // DMS props
  currentHolderId?: string;
  deadline?: string;
  isOverdue?: boolean;
  isSigned?: boolean;
  signedBy?: string;
  signedAt?: string;

  uploadedBy?: string;
  createdBy?: string; // Creator
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

// --- Components ---

// 1. FileManagerTab (Existing Logic)
const FileManagerTab = ({
  documents,
  onFolderClick,
  onFileClick,
  currentFolderId,
  folderHistory,
  handleBreadcrumbClick,
  handleFileUpload,
  handleCreateFolder,
  isCreateFolderOpen,
  setIsCreateFolderOpen,
  newFolderName,
  setNewFolderName,
  fileInputRef,
  onArchiveToggle,
  showArchived,
  setShowArchived,
  user
}: any) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      {/* Breadcrumbs & Actions */}
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-slate-950/50 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 overflow-x-auto">
          {folderHistory.map((item: any, index: number) => (
            <div key={item.id || 'root'} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1 ${index === folderHistory.length - 1 ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                onClick={() => handleBreadcrumbClick(index)}
              >
                {index === 0 && <Home className="w-4 h-4 mr-1" />}
                {item.name === 'Root' ? 'Үндсэн' : item.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          {(user as any)?.permissions?.includes("document.create") && (
            <>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Хуулах
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateFolderOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Хавтас
              </Button>
            </>
          )}

          <div className="flex items-center space-x-2 border-l pl-3 ml-1">
            <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="show-archived" className="text-sm text-muted-foreground whitespace-nowrap">Архив</Label>
          </div>
        </div>
      </div>

      {/* Grid View */}
      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {/* Folders */}
          {documents
            .filter((d: Document) => d.type === 'folder')
            .map((folder: Document) => (
              <div
                key={folder.id}
                className="group relative flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md"
                onClick={() => onFolderClick(folder)}
              >
                <div className="w-16 h-16 mb-3 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Folder className="w-10 h-10 fill-current" />
                </div>
                <div className="text-sm font-medium text-center truncate w-full px-2">{folder.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {folder.updatedAt ? format(new Date(folder.updatedAt), 'yyyy-MM-dd') : '-'}
                </div>
              </div>
            ))}

          {/* Files */}
          {documents
            .filter((d: Document) => d.type !== 'folder') // Show all files in current folder
            .map((file: Document) => (
              <div
                key={file.id}
                className="group relative flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md"
                onClick={() => onFileClick(file)}
              >
                <div className="w-16 h-16 mb-3 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 relative">
                  <FileIcon className="w-9 h-9" />
                  {file.isSigned && (
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-950">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-center truncate w-full px-2" title={file.name}>
                  {file.name}
                  {file.isArchived && <span className="ml-1 text-xs text-orange-500">(Архив)</span>}
                </div>
                {/* Archive Action for File Manager */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onArchiveToggle(file); }}>
                    {file.isArchived ? <RotateCcw className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </ScrollArea>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Шинэ хавтас үүсгэх</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Хавтасны нэр"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>Болих</Button>
            <Button onClick={handleCreateFolder}>Үүсгэх</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 2. DocumentListTab (Table View for DMS)

const getPriorityColor = (p?: DocumentPriority) => {
  switch (p) {
    case 'critical': return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
    case 'urgent': return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800";
    default: return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
};

const getStatusColor = (s: DocumentStatus) => {
  switch (s) {
    case 'completed': return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case 'processing': return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case 'pending': return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300";
    case 'unsolved': return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case 'expired': return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default: return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  }
};

const getStatusLabel = (s: DocumentStatus) => {
  switch (s) {
    case 'draft': return 'Ноорог';
    case 'pending': return 'Хүлээгдэж буй';
    case 'processing': return 'Боловсруулж буй';
    case 'completed': return 'Дууссан (Шийдэгдсэн)';
    case 'unsolved': return 'Шийдэгдээгүй';
    case 'expired': return 'Хугацаа хэтэрсэн';
    default: return s;
  }
};

const getPriorityLabel = (p?: string) => {
  switch (p) {
    case 'normal': return 'Энгийн';
    case 'urgent': return 'Яаралтай';
    case 'critical': return 'Маш яаралтай';
    default: return 'Энгийн';
  }
};

const getHolderName = (id: string | undefined, users: any[]) => {
  if (!id) return "-";
  const u = users.find(u => u.id === id);
  if (!u) return "Тодорхойгүй";
  return `${u.fullName || u.username}${u.jobTitle ? ` | ${u.jobTitle}` : ''}`;
};


const DocumentListTab = ({
  documents,
  onViewClick,
  onForwardClick,
  users,
  onArchiveToggle,
  user
}: {
  documents: Document[],
  onViewClick: (doc: Document) => void,
  onForwardClick: (doc: Document) => void,
  users: any[],
  onArchiveToggle: (doc: Document) => void,
  user: any
}) => {
  return (
    <Card className="border-border bg-card shadow-sm">
      <div className="rounded-md border p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-muted/50">
              <TableHead>Баримт №</TableHead>
              <TableHead>Гарчиг</TableHead>
              <TableHead>Төрөл / Зэрэглэл</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead>Хариуцагч</TableHead>
              <TableHead>Хугацаа</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 opacity-20" />
                    <p>Одоогоор танд хамаарах баримт алга байна.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => {
                const deadline = doc.deadline ? new Date(doc.deadline) : null;
                const isOverdue = deadline ? new Date() > deadline && doc.status !== 'completed' : false;
                const isUnread = !(doc as any).isRead; // Check read status

                return (
                  <TableRow key={doc.id} className={cn("cursor-pointer hover:bg-muted/50 transition-colors", isUnread && "bg-blue-50/50 font-medium dark:bg-blue-900/10")} onClick={() => onViewClick(doc)}>
                    <TableCell className="font-mono text-xs">
                      {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-2" />}
                      {doc.docNumber || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{doc.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityColor(doc.priority)}>
                        {getPriorityLabel(doc.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getStatusColor(doc.status)}>{getStatusLabel(doc.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px]">{getHolderName(doc.currentHolderId, users).substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{getHolderName(doc.currentHolderId, users)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {deadline && (
                        <div className={`flex items-center gap-1 text-sm ${isOverdue ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {isOverdue && <AlertCircle className="w-4 h-4" />}
                          {format(deadline, "yyyy-MM-dd")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onViewClick(doc); }}>
                          <Eye className="w-4 h-4 text-blue-500" />
                        </Button>
                        {(user as any)?.permissions?.includes("document.forward") && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onForwardClick(doc); }}>
                            <Send className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchiveToggle(doc); }}>
                              {doc.isArchived ? (
                                <>
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Сэргээх
                                </>
                              ) : (
                                <>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Архивлах
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};


// --- Main Component ---

export default function DocumentsPage() {
  const [currentTab, setCurrentTab] = useState("incoming");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false); // For file manager
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: users = [] } = useTenantUsers();
  const { data: forwardRecipients = [], isError: isRecipientError, error: recipientError } = useForwardRecipients();

  useEffect(() => {
    if (isRecipientError && recipientError) {
      console.error("Recipient Fetch Error:", recipientError);
      toast({ title: "Алдаа", description: "Хүлээн авагчдын жагсаалтыг авахад алдаа гарлаа", variant: "destructive" });
    }
  }, [isRecipientError, recipientError, toast]);

  // Helper to group recipients
  const groupedRecipients = React.useMemo(() => {
    const groups = {
      Manager: [] as any[],
      HR: [] as any[],
      Registry: [] as any[],
      Employee: [] as any[],
      Other: [] as any[]
    };
    forwardRecipients.forEach(r => {
      if (groups[r.category as keyof typeof groups]) {
        groups[r.category as keyof typeof groups].push(r);
      } else {
        groups.Other.push(r);
      }
    });
    return groups;
  }, [forwardRecipients]);

  // Fetch document logs
  const { data: docLogs = [] } = useQuery({
    queryKey: ["/api/documents", selectedDoc?.id, "logs"],
    queryFn: async () => {
      if (!selectedDoc) return [];
      const res = await fetch(`/api/documents/${selectedDoc.id}/logs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedDoc && isPreviewOpen
  });

  // Create Form State
  const [newDocData, setNewDocData] = useState<Partial<Document>>({
    type: 'internal',
    priority: 'normal',
    name: '',
    description: '',
    deadline: undefined
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Archiving State
  const [showArchived, setShowArchived] = useState(false);

  // Forward Form State
  const [forwardUserId, setForwardUserId] = useState<string>("");
  const [forwardComment, setForwardComment] = useState("");

  // Fetch Documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["/api/documents", currentFolderId, showArchived, user?.id, (user as any)?.tenantId],
    enabled: !!user,
    queryFn: async () => {
      let url = currentTab === 'files' && currentFolderId
        ? `/api/documents?parentId=${currentFolderId}`
        : `/api/documents`;

      // Handle parentId param correctly if already exists
      if (url.includes('?')) {
        url += `&archived=${showArchived}`;
      } else {
        url += `?archived=${showArchived}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // Data Filtering
  const incomingDocs = documents.filter((d: Document) => d.type === 'incoming');
  const outgoingDocs = documents.filter((d: Document) => d.type === 'outgoing');
  const internalDocs = documents.filter((d: Document) => d.type === 'internal');
  const repositoryDocs = documents.filter((d: Document) => d.type === 'folder' || d.type === 'file' || !['incoming', 'outgoing', 'internal'].includes(d.type));

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Build FormData from state if not provided (though we will provide it)
      const data = new FormData();
      data.append('name', newDocData.name || '');
      data.append('type', newDocData.type || 'internal');
      data.append('description', newDocData.description || '');
      data.append('priority', newDocData.priority || 'normal');
      data.append('parentId', 'null');
      if (newDocData.deadline) {
        data.append('deadline', newDocData.deadline);
      }

      // If we have a selected file (future proofing, though currently dialog doesn't have it)
      if (selectedFile) {
        data.append('file', selectedFile);
      }

      return fetch("/api/documents", {
        method: "POST",
        // Content-Type header excluded so browser sets boundary
        body: data
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to create document");
        }
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });

      // Auto-switch tab to the type created
      if (newDocData.type && ['incoming', 'outgoing', 'internal'].includes(newDocData.type)) {
        setCurrentTab(newDocData.type);
      }

      setIsCreateOpen(false);
      setNewDocData({ type: 'internal', priority: 'normal', name: '', description: '' });
      setSelectedFile(null);
      toast({ title: "Амжилттай", description: "Бичиг үүсгэгдлээ" });
    },
    onError: (err) => {
      toast({ title: "Алдаа", description: err.message || "Бичиг үүсгэхэд алдаа гарлаа", variant: "destructive" });
    }
  });

  const forwardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoc) return;
      const res = await fetch(`/api/documents/${selectedDoc.id}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: forwardUserId, comment: forwardComment })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDoc?.id, "logs"] });
      setIsForwardOpen(false);
      toast({ title: "Амжилттай", description: "Бичиг шилжүүлэгдлээ" });
    },
    onError: (err) => {
      toast({ title: "Алдаа", description: err.message || "Шилжүүлэхэд алдаа гарлаа", variant: "destructive" });
    }
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoc) return;
      const res = await fetch(`/api/documents/${selectedDoc.id}/sign`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sign");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", selectedDoc?.id, "logs"] });
      // Update local state to reflect signed status immediately in preview
      if (selectedDoc) {
        setSelectedDoc({ ...selectedDoc, isSigned: true, signedAt: new Date().toISOString() });
      }
      toast({ title: "Амжилттай", description: "Баримт баталгаажлаа" });
    },
    onError: () => {
      toast({ title: "Алдаа", description: "Баталгаажуулахад алдаа гарлаа", variant: "destructive" });
    }
  });

  const readMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, isArchived }: { id: string, isArchived: boolean }) => {
      const res = await fetch(`/api/documents/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived })
      });
      if (!res.ok) throw new Error("Failed to update archive status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Амжилттай", description: "Архивын төлөв шинэчлэгдлээ" });
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    }
  });


  // --- Handlers ---
  const handleView = (doc: Document) => {
    setSelectedDoc(doc);
    setIsPreviewOpen(true);
    // Mark as read if not already read (and incoming/internal/forwarded)
    if (!(doc as any).isRead) {
      readMutation.mutate(doc.id);
    }
  };

  const handleArchiveToggle = (doc: Document) => {
    archiveMutation.mutate({ id: doc.id, isArchived: !doc.isArchived });
  };


  const handleForward = (doc: Document) => {
    setSelectedDoc(doc);
    setIsForwardOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!newDocData.name) return toast({ title: "Алдаа", description: "Гарчиг оруулна уу", variant: "destructive" });
    createMutation.mutate(new FormData());
  };

  // File Manager Handlers
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folderData = {
      title: newFolderName,
      name: newFolderName,
      type: 'folder' as DocumentType,
      parentId: currentFolderId,
      status: 'completed' as DocumentStatus
    };

    fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(folderData)
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsCreateFolderOpen(false);
      setNewFolderName("");
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    if (currentFolderId) formData.append("parentId", currentFolderId);
    fetch("/api/documents/upload", { method: "POST", body: formData }).then(async (res) => {
      if (!res.ok) {
        toast({ title: "Алдаа", description: "Файл хуулахад алдаа гарлаа", variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        toast({ title: "Амжилттай", description: "Файл хуулагдлаа" });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  return (
    <div className="p-6 space-y-6 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Албан хэрэг хөтлөлт</h1>
        {(user as any)?.permissions?.includes("document.create") && (
          <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Шинэ бичиг
          </Button>
        )}
      </div>

      <Tabs defaultValue="incoming" value={currentTab} onValueChange={setCurrentTab} className="w-full flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-4 bg-muted">
          <TabsTrigger value="incoming">📥 Ирсэн ({incomingDocs.length})</TabsTrigger>
          <TabsTrigger value="outgoing">📤 Явсан ({outgoingDocs.length})</TabsTrigger>
          <TabsTrigger value="internal">🏢 Дотоод ({internalDocs.length})</TabsTrigger>
          <TabsTrigger value="files">📂 Архив / Файл ({repositoryDocs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="mt-4 flex-1 overflow-auto">
          {incomingDocs.filter((d: any) => !d.isRead).length > 0 && (
            <Alert className="mb-4 bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
              <Info className="h-4 w-4" />
              <AlertTitle>Танд {incomingDocs.filter((d: any) => !d.isRead).length} уншаагүй бичиг байна.</AlertTitle>
            </Alert>
          )}
          <DocumentListTab documents={incomingDocs} onViewClick={handleView} onForwardClick={handleForward} users={users} onArchiveToggle={handleArchiveToggle} user={user} />
        </TabsContent>
        <TabsContent value="outgoing" className="mt-4 flex-1 overflow-auto">
          <DocumentListTab documents={outgoingDocs} onViewClick={handleView} onForwardClick={handleForward} users={users} onArchiveToggle={handleArchiveToggle} user={user} />
        </TabsContent>
        <TabsContent value="internal" className="mt-4 flex-1 overflow-auto">
          <DocumentListTab documents={internalDocs} onViewClick={handleView} onForwardClick={handleForward} users={users} onArchiveToggle={handleArchiveToggle} user={user} />
        </TabsContent>
        <TabsContent value="files" className="mt-4 flex-1 overflow-hidden border rounded-lg bg-card">
          <FileManagerTab
            documents={repositoryDocs}
            currentFolderId={currentFolderId}
            folderHistory={folderHistory}
            onFolderClick={(f: Document) => {
              setCurrentFolderId(f.id);
              setFolderHistory(prev => [...prev, { id: f.id, name: f.name }]);
            }}
            onFileClick={handleView}
            handleBreadcrumbClick={(idx: number) => {
              const item = folderHistory[idx];
              setCurrentFolderId(item.id);
              setFolderHistory(prev => prev.slice(0, idx + 1));
            }}
            isCreateFolderOpen={isCreateFolderOpen}
            setIsCreateFolderOpen={setIsCreateFolderOpen}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            fileInputRef={fileInputRef}
            handleCreateFolder={handleCreateFolder}
            handleFileUpload={handleFileUpload}
            onArchiveToggle={handleArchiveToggle}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            user={user}
          />
        </TabsContent>
      </Tabs>

      {/* --- Dialogs --- */}

      {/* Create Document Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Шинэ бичиг үүсгэх</DialogTitle>
            <DialogDescription>Бичгийн дэлгэрэнгүйг оруулна уу.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Гарчиг</Label>
              <Input className="col-span-3" value={newDocData.name} onChange={e => setNewDocData({ ...newDocData, name: e.target.value })} placeholder="Бичгийн товч утга" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Төрөл</Label>
              <Select onValueChange={(v: any) => setNewDocData({ ...newDocData, type: v })} value={newDocData.type}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Төрөл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">Ирсэн бичиг</SelectItem>
                  <SelectItem value="outgoing">Явсан бичиг</SelectItem>
                  <SelectItem value="internal">Дотоод бичиг</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Зэрэглэл</Label>
              <Select
                value={newDocData.priority}
                onValueChange={(v: any) => {
                  const date = new Date();
                  if (v === 'normal') date.setDate(date.getDate() + 7);
                  if (v === 'urgent') date.setDate(date.getDate() + 1);
                  if (v === 'critical') date.setHours(date.getHours() + 4); // For information, but input is date type

                  setNewDocData({
                    ...newDocData,
                    priority: v,
                    deadline: date.toISOString().split('T')[0]
                  });
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Зэрэглэл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Энгийн (7 хоног)</SelectItem>
                  <SelectItem value="urgent">Яаралтай (24 цаг)</SelectItem>
                  <SelectItem value="critical">Маш яаралтай (Нэн даруй)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Файл хавсаргах</Label>
              <div className="col-span-3">
                <Input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Хугацаа</Label>
              <Input
                type="date"
                className="col-span-3"
                value={newDocData.deadline}
                onChange={e => setNewDocData({ ...newDocData, deadline: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Тайлбар</Label>
              <Textarea className="col-span-3" value={newDocData.description} onChange={e => setNewDocData({ ...newDocData, description: e.target.value })} placeholder="Нэмэлт тайлбар..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateSubmit}>Үүсгэх</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isFullPreviewOpen} onOpenChange={setIsFullPreviewOpen}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0 overflow-hidden bg-slate-950/90 border-slate-800 backdrop-blur-sm">
          <div className="absolute top-4 right-4 z-50 flex gap-2">
            <Button variant="secondary" size="icon" onClick={() => window.open(selectedDoc?.path, '_blank')}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="icon" onClick={() => setIsFullPreviewOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4 relative">
            {selectedDoc?.mimeType?.startsWith('image/') ? (
              <img src={selectedDoc.path} alt="Full Preview" className="max-w-full max-h-full object-contain rounded-md shadow-2xl" />
            ) : selectedDoc?.mimeType === 'application/pdf' ? (
              <div className="w-full h-full flex justify-center overflow-auto">
                <PDFDocument
                  file={selectedDoc.path}
                  loading={<div className="text-white">Уншиж байна...</div>}
                  error={<div className="text-red-400">PDF файл нээхэд алдаа гарлаа.</div>}
                >
                  <Page pageNumber={1} scale={1.5} renderTextLayer={false} renderAnnotationLayer={false} />
                </PDFDocument>
              </div>
            ) : (
              <div className="text-white text-center">
                <FileIcon className="w-20 h-20 mx-auto mb-4 opacity-50" />
                <p className="text-xl">Урьдчилан харах боломжгүй файл байна.</p>
              </div>
            )}

            {/* Signature Overlay - Full Screen */}
            {selectedDoc?.isSigned && selectedDoc.signedBy && (
              <div className="absolute bottom-10 right-10 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 pointer-events-none">
                {(() => {
                  const signer = users.find(u => u.id === selectedDoc.signedBy);
                  return (
                    <div className="text-center">
                      {signer?.signatureUrl ? (
                        <img src={signer.signatureUrl} alt="Signature" className="h-20 object-contain mx-auto mb-2" />
                      ) : (
                        <div className="h-16 w-32 border-b-2 border-dashed border-slate-400 mb-2 mx-auto" />
                      )}
                      {(signer?.signatureTitle || signer?.jobTitle) && <p className="text-sm font-bold text-slate-800">{signer.signatureTitle || signer.jobTitle}</p>}
                      <p className="text-xs text-slate-600 font-medium">{signer?.fullName || "Unknown User"}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{selectedDoc.signedAt && format(new Date(selectedDoc.signedAt), "yyyy-MM-dd HH:mm")}</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={isForwardOpen} onOpenChange={setIsForwardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Бичиг шилжүүлэх</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>Хэнд шилжүүлэх</Label>
            <Select onValueChange={setForwardUserId} value={forwardUserId}>
              <SelectTrigger>
                <SelectValue placeholder={isPrivileged(user?.role) ? "Ажилтан сонгох" : "Менежер / HR / Бичиг хэрэг сонгоно уу"} />
              </SelectTrigger>
              <SelectContent>
                {/* Manager Group */}
                {groupedRecipients.Manager.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Менежер</SelectLabel>
                    {groupedRecipients.Manager.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-bold">{u.fullName}</span>
                          <span className="text-xs text-muted-foreground">{u.jobTitle || 'Албан тушаалгүй'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {/* HR Group */}
                {groupedRecipients.HR.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>HR</SelectLabel>
                    {groupedRecipients.HR.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-bold">{u.fullName}</span>
                          <span className="text-xs text-muted-foreground">{u.jobTitle || 'HR'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {/* Registry Group */}
                {groupedRecipients.Registry.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Бичиг хэрэг</SelectLabel>
                    {groupedRecipients.Registry.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <div className="flex flex-col text-left">
                          <span className="font-bold">{u.fullName}</span>
                          <span className="text-xs text-muted-foreground">{u.jobTitle || 'Registry'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {/* Employees (for Admin/HR or Team members) */}
                {groupedRecipients.Employee.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Ажилчид</SelectLabel>
                    {groupedRecipients.Employee.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} <span className="text-muted-foreground text-xs">({u.jobTitle || '-'})</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {/* Fallback for others if any */}
                {groupedRecipients.Other.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Бусад</SelectLabel>
                    {groupedRecipients.Other.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {!isPrivileged(user?.role) && (
              <p className="text-[10px] text-muted-foreground">
                Та зөвхөн Менежер, HR болон Бичиг хэрэг рүү шилжүүлнэ.
              </p>
            )}
            <Label>Тайлбар / Чиглэл</Label>
            <Textarea placeholder="Нэмэлт тайлбар бичих..." value={forwardComment} onChange={e => setForwardComment(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => forwardMutation.mutate()} disabled={!forwardUserId || forwardMutation.isPending}>
              {forwardMutation.isPending ? "Шилжүүлж байна..." : "Шилжүүлэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Sheet with History */}
      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent className="sm:max-w-xl w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl">{selectedDoc?.name || "Бичгийн дэлгэрэнгүй"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* File Preview */}
            <Card className="bg-slate-50 dark:bg-slate-900 border overflow-hidden cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setIsFullPreviewOpen(true)}>
              <CardContent className="p-0 flex items-center justify-center min-h-[200px] relative group">
                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg">
                    <Eye className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                {selectedDoc?.mimeType?.startsWith('image/') ? (
                  <img src={selectedDoc.path} alt="Preview" className="max-w-full max-h-[400px] object-contain" />
                ) : selectedDoc?.mimeType === 'application/pdf' ? (
                  <div className="w-full h-[400px] overflow-auto flex justify-center bg-gray-100 dark:bg-gray-800 p-4">
                    {/* Basic PDF Preview - showing first page */}
                    <PDFDocument
                      file={selectedDoc.path}
                      loading={<div className="flex items-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>Уншиж байна...</div>}
                      error={<div className="text-red-500 text-sm">PDF файл нээхэд алдаа гарлаа.</div>}
                    >
                      <Page pageNumber={1} width={400} renderTextLayer={false} renderAnnotationLayer={false} />
                    </PDFDocument>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <FileIcon className="w-12 h-12 mb-2 opacity-50" />
                    <p>Урьдчилан харах боломжгүй файл байна.</p>
                    <Button variant="link" onClick={(e) => { e.stopPropagation(); window.open(selectedDoc?.path, '_blank'); }}>
                      <Download className="w-4 h-4 mr-2" /> Татах / Нээх
                    </Button>
                  </div>
                )}
              </CardContent>

              {/* Signature Overlay - Small Preview */}
              {selectedDoc?.isSigned && selectedDoc.signedBy && (
                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded border border-slate-200 pointer-events-none scale-75 origin-bottom-right shadow-sm z-20">
                  {(() => {
                    const signer = users.find(u => u.id === selectedDoc.signedBy);
                    return (
                      <div className="text-center">
                        {signer?.signatureUrl && (
                          <img src={signer.signatureUrl} alt="Signature" className="h-8 object-contain mx-auto mb-1" />
                        )}
                        <p className="text-[8px] font-bold text-slate-800 leading-tight">{signer?.signatureTitle || signer?.jobTitle}</p>
                        <p className="text-[8px] text-slate-600 leading-tight">{signer?.fullName}</p>
                        <p className="text-[6px] text-slate-500 mt-0.5 whitespace-nowrap">{selectedDoc.signedAt && format(new Date(selectedDoc.signedAt), "yyyy-MM-dd")}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>

            {/* Document Meta */}
            <Card className="bg-muted/50 border-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Төрөл:</span>
                  <span className="text-sm font-semibold">{getPriorityLabel(selectedDoc?.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Зэрэглэл:</span>
                  <Badge variant="outline">{getPriorityLabel(selectedDoc?.priority)}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Төлөв:</span>
                  <Badge>{getStatusLabel(selectedDoc?.status || 'draft')}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Одоогийн эзэмшигч:</span>
                  <span className="text-sm">{getHolderName(selectedDoc?.currentHolderId, users)}</span>
                </div>
                {selectedDoc?.isSigned && (
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> Баталгаажсан
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedDoc.signedAt && format(new Date(selectedDoc.signedAt), "yyyy-MM-dd HH:mm")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History Timeline */}
            <div>
              <DocumentHistory logs={docLogs} users={users} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end sticky bottom-0 bg-background/80 backdrop-blur p-2 border-t -mx-6 px-6">
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Хаах</Button>

              {!selectedDoc?.isSigned && (
                <Button
                  variant="secondary"
                  className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300"
                  onClick={() => signMutation.mutate()}
                  disabled={signMutation.isPending}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {signMutation.isPending ? "Баталгаажуулж байна..." : "Гарын үсэг зурах"}
                </Button>
              )}

              <Button onClick={() => { setIsPreviewOpen(false); if (selectedDoc) handleForward(selectedDoc); }}>
                <Send className="w-4 h-4 mr-2" /> Шилжүүлэх
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}