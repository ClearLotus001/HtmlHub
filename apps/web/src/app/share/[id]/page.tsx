'use client';

import { useEffect, useState, use } from 'react';
import { api, type PageDto } from '@/lib/api';
import { AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ReportSharePage({ params }: Props) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const [report, setReport] = useState<PageDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(id)
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background p-6">
        <div className="glass-card rounded-2xl border-destructive/30 p-5 text-destructive shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl px-8 py-12">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-[14px]">加载分享页...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background">
      <iframe
        src={report.url}
        title={report.title}
        className="h-full w-full border-0"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
