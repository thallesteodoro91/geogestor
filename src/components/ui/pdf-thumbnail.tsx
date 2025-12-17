import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfThumbnailProps {
  url: string;
  width?: number;
  className?: string;
}

export function PdfThumbnail({ url, width = 128, className }: PdfThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-md ${className}`} style={{ width, height: width * 1.4 }}>
        <FileText className="h-12 w-12 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height: width * 1.4 }}>
      {loading && <Skeleton className="absolute inset-0" />}
      <Document
        file={url}
        onLoadSuccess={() => setLoading(false)}
        onLoadError={() => {
          setError(true);
          setLoading(false);
        }}
        loading={null}
      >
        <Page 
          pageNumber={1} 
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}
