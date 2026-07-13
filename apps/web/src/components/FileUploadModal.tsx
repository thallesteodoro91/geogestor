import React, { useId, useState } from 'react';
import { CloudArrowUp, FileArrowUp, SpinnerGap } from '@phosphor-icons/react';

export interface FileUploadModalProps {
  onUpload: (file: File) => Promise<void> | void;
  uploading?: boolean;
  accept?: string;
  title?: string;
  helperText?: string;
  inputId?: string;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  onUpload,
  uploading = false,
  accept,
  title = 'Arraste arquivos ou clique para fazer upload',
  helperText = 'PDF, GPKG, KML, DWG, SHP, Excel, imagens (máx. 50 MB)',
  inputId
}) => {
  const generatedInputId = useId();
  const resolvedInputId = inputId ?? `file-upload-${generatedInputId}`;
  const helperId = `${resolvedInputId}-helper`;
  const statusId = `${resolvedInputId}-status`;
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      await onUpload(file);
    } finally {
      input.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (uploading) {
      setDragActive(false);
      return;
    }

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await onUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      aria-busy={uploading}
      className={`rounded-lg border-2 border-dashed p-6 transition-colors duration-150 ${
        dragActive
          ? 'border-brand-primary-400 bg-brand-primary-50 text-brand-primary-900 dark:border-brand-primary-300 dark:bg-brand-primary-400/10 dark:text-brand-primary-100'
          : 'border-brand-border bg-brand-surface-subtle text-zinc-900 hover:border-brand-primary-300/55 hover:bg-brand-surface dark:text-zinc-100 dark:hover:bg-brand-surface-muted'
      }`}
    >
      <input
        type="file"
        id={resolvedInputId}
        name="arquivo"
        className="peer sr-only"
        accept={accept}
        onChange={handleFileUpload}
        disabled={uploading}
        aria-describedby={`${statusId} ${helperId}`}
      />
      <label
        htmlFor={resolvedInputId}
        className={`flex min-h-52 w-full flex-col items-center justify-center gap-4 rounded-lg border border-transparent px-4 py-7 text-center transition-[background-color,border-color,box-shadow,transform] duration-150 peer-focus-visible:border-brand-primary-400 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary-400/25 motion-reduce:transition-none ${
          uploading
            ? 'cursor-not-allowed opacity-75'
            : 'cursor-pointer hover:border-brand-border hover:bg-brand-surface motion-safe:hover:-translate-y-0.5 dark:hover:bg-brand-surface-muted'
        }`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-brand-primary-600 shadow-brand dark:text-brand-primary-100">
          {uploading ? (
            <SpinnerGap weight="bold" className="h-7 w-7 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : dragActive ? (
            <FileArrowUp weight="duotone" className="h-7 w-7" aria-hidden="true" />
          ) : (
            <CloudArrowUp weight="duotone" className="h-7 w-7" aria-hidden="true" />
          )}
        </div>

        <span id={statusId} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100" aria-live="polite">
          {uploading ? 'Enviando arquivo…' : title}
        </span>

        <span id={helperId} className="max-w-md text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">
          {helperText}
        </span>

        <span className="geo-badge-base geo-badge-primary px-3 py-1.5 text-xs">
          {uploading ? 'Aguarde o processamento' : 'Selecionar arquivo'}
        </span>
      </label>
    </div>
  );
};
