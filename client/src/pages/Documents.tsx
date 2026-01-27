import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Folder, FileText, ArrowLeft, Upload, Search, Filter, Plus, Home, ChevronRight, File, CheckCircle, ShieldCheck, Download, Trash2, Edit2, X, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker with standard import compatible with modern bundlers
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Document = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  path: string;
  size?: number;
  parentId?: string | null;
  isSigned?: boolean;
  signedBy?: string;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export default function Documents() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<string | Blob | null>(null);
  const [pdfError, setPdfError] = useState<Error | null>(null);

  // Handle preview URL generation for data: URIs
  useEffect(() => {
    if (selectedDoc?.path?.startsWith('data:')) {
      console.log("Attempting Data URI conversion. Length:", selectedDoc.path.length);
      try {
        const byteString = atob(selectedDoc.path.split(',')[1]);
        const mimeString = selectedDoc.path.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const url = URL.createObjectURL(blob);
        console.log("Created Blob URL:", url);
        setPreviewUrl(url);
        setPreviewData(blob);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Failed to convert data URI:", e);
        setPreviewUrl(null);
        setPreviewData(null);
      }
    } else {
      console.log("Standard path preview:", selectedDoc?.path);
      setPreviewUrl(selectedDoc?.path || null);
      setPreviewData(selectedDoc?.path || null);
    }
  }, [selectedDoc]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Selection Handlers
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAll = () => {
    const ids = new Set<string>(documents.map((d: any) => d.id as string));
    setSelectedIds(ids);
  };

  // Fetch documents for current folder
  const { data: documents = [], isLoading, isFetching } = useQuery({
    queryKey: ["/api/documents", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId
        ? `/api/documents?parentId=${currentFolderId}`
        : "/api/documents";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  // Create Document/Folder Mutation
  const createMutation = useMutation({
    mutationFn: async (newDoc: any) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newDoc, parentId: currentFolderId }),
      });
      if (!res.ok) throw new Error("Failed to create document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  // Sign Document Mutation
  const signMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}/sign`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sign document");
      return res.json();
    },
    onSuccess: (updatedDoc) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedDoc(updatedDoc);
      toast({
        title: "Амжилттай баталгаажууллаа",
        description: "Баримт бичигт гарын үсэг зурагдлаа.",
        className: "bg-green-50 border-green-200 text-green-800",
      });
    },
  });

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/documents/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete documents");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedIds(new Set());
      toast({ title: "Амжилттай", description: "Сонгогдсон файлууд устгагдлаа." });
    },
    onError: (err) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    }
  });

  // Rename Mutation
  const renameMutation = useMutation({
    mutationFn: async (data: { id: string, name: string }) => {
      const res = await fetch(`/api/documents/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) throw new Error("Failed to rename document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsRenameOpen(false);
      setRenamingId(null);
      setRenameName("");
      setSelectedIds(new Set());
      toast({ title: "Амжилттай", description: "Нэр өөрчлөгдлө." });
    },
  });

  const handleBulkDelete = () => {
    if (confirm("Та сонгосон файлуудыг устгахдаа итгэлтэй байна уу?")) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const startRename = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const doc = documents.find((d: any) => d.id === id);
    if (doc) {
      setRenamingId(id);
      setRenameName(doc.name);
      setIsRenameOpen(true);
    }
  };

  // --- Auto-Integration Logic Removed ---
  // Mock data generation is now handled server-side to prevent client-side loops and lag.


  // Navigation Handlers
  const handleFolderClick = (folder: Document) => {
    if (folder.type !== 'folder') return;
    setCurrentFolderId(folder.id);
    setFolderHistory(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const historyItem = folderHistory[index];
    setCurrentFolderId(historyItem.id);
    setFolderHistory(prev => prev.slice(0, index + 1));
  };

  const handleFileClick = (file: Document) => {
    setSelectedDoc(file);
    setIsPreviewOpen(true);
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createMutation.mutate({
      name: newFolderName,
      type: 'folder',
      path: currentFolderId ? `/Documents/${newFolderName}` : `/${newFolderName}`,
      mimeType: null
    });
    setIsCreateFolderOpen(false);
    setNewFolderName("");
  };

  // Real Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolderId) formData.append("parentId", currentFolderId);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Амжилттай", description: "Файл хуулагдлаа." });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  // Mock Data generation can be removed or kept as fallback logic if needed
  // ...

  // UI Helpers
  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50">
      {/* Top Bar: Breadcrumbs & Actions */}
      <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-slate-950/50 backdrop-blur sticky top-0 z-10 min-h-[73px]">
        {selectedIds.size > 0 ? (
          <div className="flex items-center justify-between w-full bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-blue-700 dark:text-blue-300">{selectedIds.size} сонгогдсон</span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X className="w-4 h-4 mr-2" />
                Болих
              </Button>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                <CheckSquare className="w-4 h-4 mr-2" />
                Бүгд
              </Button>
            </div>
            <div className="flex gap-2">
              {selectedIds.size === 1 && (
                <Button variant="outline" size="sm" onClick={startRename}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Нэрлэх
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Устгах
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-x-auto">
              {folderHistory.map((item, index) => (
                <div key={item.id || 'root'} className="flex items-center">
                  {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex items-center gap-1 ${index === folderHistory.length - 1 ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {index === 0 && <Home className="w-4 h-4 mr-1" />}
                    {item.name}
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
              <div className="relative w-64 hidden md:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Файл хайх..."
                  className="pl-9 h-9 bg-slate-100 dark:bg-slate-800 border-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
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
            </div>
          </>
        )}
      </div>

      {/* Main Content: Grid View */}
      <ScrollArea className="flex-1 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">

            {/* Render Folders */}
            {documents
              .filter((d: Document) => d.type === 'folder')
              .map((folder: Document) => (
                <div
                  key={folder.id}
                  className="group relative flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-blue-50 dark:hover:bg-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-1"
                  onClick={() => handleFolderClick(folder)}
                >
                  <div
                    className="absolute top-2 left-2 p-1 rounded-sm hover:bg-black/10 z-20"
                    onClick={(e) => toggleSelection(folder.id, e)}
                  >
                    {selectedIds.has(folder.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 fill-blue-100" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                    )}
                  </div>
                  <div className="w-16 h-16 mb-3 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                    <Folder className="w-10 h-10 fill-current" />
                  </div>
                  <div className="text-sm font-medium text-center truncate w-full px-2">{folder.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {folder.updatedAt ? format(new Date(folder.updatedAt), 'yyyy-MM-dd') : '-'}
                  </div>
                </div>
              ))}

            {/* Render Files */}
            {documents
              .filter((d: Document) => d.type === 'file')
              .map((file: Document) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-1"
                  onClick={() => handleFileClick(file)}
                >
                  <div
                    className="absolute top-2 left-2 p-1 rounded-sm hover:bg-black/10 z-20"
                    onClick={(e) => toggleSelection(file.id, e)}
                  >
                    {selectedIds.has(file.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 fill-blue-100" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                    )}
                  </div>
                  <div className="w-16 h-16 mb-3 flex items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 relative">
                    <FileText className="w-9 h-9" />
                    {file.isSigned && (
                      <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-950">
                        <ShieldCheck className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-center truncate w-full px-2" title={file.name}>{file.name}</div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                    {file.isSigned && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Signed</Badge>}
                  </div>
                </div>
              ))}

            {documents.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                <Folder className="w-16 h-16 mb-4 text-slate-300" />
                <p>Хоосон хавтас</p>
                <p className="text-xs">Файл хуулах эсвэл хавтас үүсгэнэ үү</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>



      {/* New Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Шинэ хавтас үүсгэх</DialogTitle>
            <DialogDescription>
              Үүсгэх хавтасны нэрийг оруулна уу.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                id="link"
                placeholder="Хавтасны нэр"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="button" variant="secondary" onClick={() => setIsCreateFolderOpen(false)}>
              Болих
            </Button>
            <Button type="button" onClick={handleCreateFolder}>
              Үүсгэх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Нэр өөрчлөх</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Шинэ нэр"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)}>Болих</Button>
            <Button onClick={() => renamingId && renameMutation.mutate({ id: renamingId, name: renameName })}>
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden [&>button]:hidden">


          <div className="flex items-center justify-between p-4 border-b bg-slate-50 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white dark:bg-slate-800 rounded border shadow-sm">
                <FileText className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <DialogTitle>{selectedDoc?.name || "Document Preview"}</DialogTitle>
                <DialogDescription>
                  {selectedDoc && `${formatSize(selectedDoc.size)} • ${format(new Date(selectedDoc.createdAt), 'yyyy-MM-dd HH:mm')}`}
                </DialogDescription>
              </div>
            </div>

            <div className="flex gap-2">
              {selectedDoc?.isSigned ? (
                <div className="flex flex-col items-end mr-4">
                  <Badge className="bg-green-600 hover:bg-green-700 gap-1 pl-1 pr-2">
                    <CheckCircle className="w-4 h-4" />
                    Баталгаажсан
                  </Badge>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {selectedDoc.signedAt && format(new Date(selectedDoc.signedAt), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
              ) : (
                <Button
                  onClick={() => selectedDoc && signMutation.mutate(selectedDoc.id)}
                  disabled={signMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  {signMutation.isPending ? "Уншиж байна..." : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Гарын үсэг зурах
                    </>
                  )}
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setIsPreviewOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-8 flex justify-center overflow-auto relative">
            {previewUrl && (previewUrl.startsWith('/uploads/') || previewUrl.startsWith('blob:') || previewUrl.startsWith('data:')) ? (
              <div className="relative shadow-lg bg-white min-h-[600px] inline-block">
                <Document
                  file={previewData}
                  onLoadError={(error) => {
                    console.error("PDF Load Error:", error);
                    setPdfError(error);
                  }}
                  loading={
                    <div className="flex items-center justify-center h-[600px] w-[500px] bg-white">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-[600px] w-[500px] bg-white text-red-500 gap-2 p-8 text-center">
                      <p>Unable to render PDF directly.</p>
                      {pdfError && <p className="text-xs text-red-400 font-mono mt-2 break-all max-w-[400px]">{pdfError.message}</p>}
                      <a href={previewUrl} download className="text-blue-600 underline text-sm">Download instead</a>
                    </div>
                  }
                >
                  <Page
                    pageNumber={1}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    width={600}
                    className="bg-white"
                  />
                </Document>

                {/* Signature Overlay */}
                {selectedDoc?.isSigned && (
                  <div
                    className="absolute bottom-32 right-10 w-40 h-40 pointer-events-none z-50 flex flex-col items-center justify-center mix-blend-multiply dark:mix-blend-screen opacity-90 animate-stamp-in"
                    style={{ mixBlendMode: 'multiply' }}
                  >
                    <div className="border-4 border-green-600/80 rounded-full w-full h-full flex flex-col items-center justify-center -rotate-12 bg-white/10 backdrop-blur-sm p-2 shadow-sm">
                      <span className="text-xs uppercase font-bold tracking-widest text-green-700 border-b border-green-600 mb-1">Digitally Signed</span>
                      <ShieldCheck className="w-10 h-10 text-green-600 mb-1" />
                      <span className="text-[10px] text-center px-2 leading-tight text-green-800 font-mono">
                        Approved by Admin<br />
                        {selectedDoc.signedAt ? format(new Date(selectedDoc.signedAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                      </span>
                    </div>
                  </div>
                )}

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end gap-2 z-50 pointer-events-auto">
                  <a href={previewUrl} download={`document-${selectedDoc?.id || 'file'}.pdf`} className="bg-blue-600 text-white px-3 py-1 rounded text-sm shadow hover:bg-blue-700 flex items-center gap-2">
                    <Download className="w-3 h-3" />
                    Татах
                  </a>
                  {selectedDoc?.isSigned && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-1 rounded shadow-sm border border-yellow-200">
                      Note: Signature is not burned into file
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 shadow-2xl w-[600px] h-[800px] rounded-sm p-12 flex flex-col relative border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-start mb-8">
                  <div className="w-32 h-10 bg-slate-200 dark:bg-slate-800 rounded flex items-center px-2">
                    <span className="text-xs font-bold text-slate-400">DOC PREVIEW</span>
                  </div>
                  {/* ... existing mock UI ... */}
                  <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Logo</span>
                  </div>
                </div>

                <div className="text-center py-20 border-y my-auto">
                  <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-xl font-bold text-slate-300 uppercase">System Generated File</h3>
                  <p className="text-sm text-slate-400 mt-2">This is a mock file. Please upload a real PDF.</p>
                </div>

              </div>
            )}

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}