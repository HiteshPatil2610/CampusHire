'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface CompanyLogoFieldProps {
  /** Current stored logo URL, or null when nothing is attached. */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * Logo upload for a drive's recruiting company.
 *
 * The file goes to Vercel Blob through `/api/admin/drives/logo` and only the
 * returned URL is stored on the Drive row, per the storage model. Drive cards
 * fall back to a text tile when no logo is set, so this is always optional.
 */
export default function CompanyLogoField({
  value,
  onChange,
  disabled = false,
}: CompanyLogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  async function handleFile(file: File) {
    setIsUploading(true);

    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/admin/drives/logo', {
        method: 'POST',
        body,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        toast({
          title: 'Upload failed',
          description: result.error ?? 'Could not upload the logo.',
          variant: 'destructive',
        });
        return;
      }

      onChange(result.url as string);
    } catch {
      toast({
        title: 'Upload failed',
        description: 'Could not reach the server. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Allow re-selecting the same file after a failure.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="field">
      <label>Company Logo</label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {value ? (
          <Image
            src={value}
            alt=""
            width={44}
            height={44}
            style={{
              borderRadius: 8,
              objectFit: 'contain',
              border: '0.5px solid var(--border)',
              background: 'var(--surface)',
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '0.5px dashed var(--border-strong)',
              color: 'var(--text-muted)',
            }}
          >
            <ImageIcon size={16} />
          </div>
        )}

        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={disabled || isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? 'Uploading…' : value ? 'Replace' : 'Upload logo'}
        </button>

        {value && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
            aria-label="Remove logo"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <p className="panel-hint" style={{ marginTop: 6 }}>
        Optional — cards show the first letters of the company name when no
        logo is set. JPEG, PNG or WebP, up to 2MB.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
