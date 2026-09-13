'use client';

import { useRef, useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type DocumentKind =
  | 'tenth-marksheet'
  | 'twelfth-marksheet'
  | 'grade-card'
  | 'experience-certificate';

export interface FileAttachFieldProps {
  /** Current stored URL, or null when nothing is attached. */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Which document slot this is - the server derives the storage path. */
  kind: DocumentKind;
  /** Shown when nothing is attached yet. */
  placeholder?: string;
  /** Compact variant used inside the semester grade cards. */
  size?: 'md' | 'sm';
}

/**
 * One attachment row: the current file name (linking to the uploaded file)
 * plus an Attach / Replace button. Uploads go straight to Vercel Blob via
 * the documents API and hand the resulting URL back through onChange, so the
 * parent form saves the URL along with the rest of its fields.
 */
export default function FileAttachField({
  value,
  onChange,
  kind,
  placeholder = 'No file attached',
  size = 'md',
}: FileAttachFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const fileName = value ? decodeURIComponent(value.split('/').pop() ?? '') : '';

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);

      const response = await fetch('/api/students/documents', {
        method: 'POST',
        body,
      });
      const result = await response.json();

      if (result.success) {
        onChange(result.url);
        toast({ title: 'File attached', description: file.name });
      } else {
        toast({
          title: 'Upload failed',
          description: result.error ?? 'Could not upload the file.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Upload failed',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={`attach-row ${size === 'sm' ? 'attach-row-sm' : ''}`.trim()}>
      <FileText size={13} className="ar-icon" aria-hidden />

      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="ar-filename"
          title={fileName}
        >
          {fileName}
        </a>
      ) : (
        <span className="ar-label">{placeholder}</span>
      )}

      <div className="ar-actions">
        {value && (
          <button
            type="button"
            className="ar-remove"
            onClick={() => onChange(null)}
            aria-label="Remove attachment"
            title="Remove attachment"
          >
            <X size={12} aria-hidden />
          </button>
        )}

        <button
          type="button"
          className="ar-btn"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={11} aria-hidden />
          {isUploading ? 'Uploading…' : value ? 'Replace file' : 'Attach'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
