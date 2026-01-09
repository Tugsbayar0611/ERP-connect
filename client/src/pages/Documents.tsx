import { useState } from "react";
import { useDocuments } from "@/hooks/use-documents";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDocumentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

import { FileText, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Documents() {
  const { documents, isLoading, createDocument, deleteDocument } = useDocuments();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertDocumentSchema),
    defaultValues: {
      title: "",
      description: "",
      filePath: "",
      fileType: "",
      fileSize: 0,
      categoryId: undefined,
    },
  });

  // Файл сонгоход ажиллах функц
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const file = e.target.files?.[0];
    if (file) {
      // 1. Файлын нэрийг Title болгох (хэрэв хоосон бол)
      if (!form.getValues("title")) {
        form.setValue("title", file.name);
      }

      // 2. Файлын хэмжээ, төрлийг хадгалах
      form.setValue("fileSize", file.size);
      form.setValue("fileType", file.type);

      // 3. Файлыг Base64 болгох (Server руу явуулахын тулд)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        form.setValue("filePath", base64String); // Файлын агуулгыг хадгалах
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      fileSize: Number(data.fileSize),
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      // uploadedBy handled by backend
    };

    createDocument.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Амжилттай", description: "Баримт амжилттай хадгалагдлаа." });
        setOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({ title: "Алдаа", description: error.message, variant: "destructive" });
      },
    });
  };

  // Устгах функц
  const handleDelete = (id: string) => {
    if (confirm("Та энэ баримтыг устгахдаа итгэлтэй байна уу?")) {
      deleteDocument.mutate(id, {
        onSuccess: () => {
          toast({ title: "Устгагдсан", description: "Баримт амжилттай устгагдлаа." });
        },
        onError: () => {
          toast({ title: "Алдаа", description: "Баримт устгахад алдаа гарлаа.", variant: "destructive" });
        }
      });
    }
  };

  // Файл татах (Download) функц - Base64 декод хийх
  const handleDownload = (doc: any) => {
    if (!doc.filePath.startsWith("data:")) {
      alert("Энэ файл зүгээр л туршилтын өгөгдөл байна.");
      return;
    }
    const link = document.createElement("a");
    link.href = doc.filePath;
    link.download = doc.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in-fade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Баримт бичиг
          </h2>
          <p className="text-muted-foreground">
            Байгууллагын бичиг баримтын нэгдсэн сан.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-premium">
              <Upload className="w-4 h-4 mr-2" />
              Баримт хуулах
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Шинэ баримт оруулах
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">

                <FormField
                  control={form.control}
                  name="filePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Файл сонгох</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          onChange={(e) => handleFileChange(e, field)}
                          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Гарчиг</FormLabel>
                      <FormControl>
                        <Input placeholder="Файлын нэр" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тайлбар</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Тайлбар..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full btn-premium" disabled={createDocument.isPending}>
                  {createDocument.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Хуулж байна...
                    </>
                  ) : (
                    "Хадгалах"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : documents?.length === 0 ? (
          <div className="col-span-full text-center py-12 glass-card rounded-xl border border-dashed">
            <div className="flex flex-col items-center gap-2">
              <FileText className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Одоогоор баримт оруулаагүй байна.</p>
            </div>
          </div>
        ) : (
          documents?.map((doc, index) => (
            <Card key={doc.id} className="glass-card hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1 w-full">
                  <h3 className="font-semibold text-foreground truncate w-full" title={doc.title}>{doc.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {doc.createdAt ? format(new Date(doc.createdAt), "MMM d, yyyy") : "N/A"} • {Math.round((doc.fileSize || 0) / 1024)} KB
                  </p>
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 hover:text-primary hover:border-primary/50"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Татах
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}