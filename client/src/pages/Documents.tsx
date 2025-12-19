import { useDocuments } from "@/hooks/use-documents";
import { format } from "date-fns";
import { FileText, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Documents() {
  const { documents, isLoading } = useDocuments();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Documents</h2>
          <p className="text-muted-foreground mt-1">Centralized document management.</p>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          <div>Loading...</div>
        ) : documents?.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-muted/20 rounded-xl border border-dashed">
            <p className="text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          documents?.map((doc) => (
            <Card key={doc.id} className="group hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground truncate w-full">{doc.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(doc.createdAt!), "MMM d, yyyy")} • {(doc.fileSize || 0) / 1024} KB
                  </p>
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
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
