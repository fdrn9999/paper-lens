'use client';

import { useCallback, useRef, useState } from 'react';
import useStore from '@/store/useStore';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function FileUploader() {
  const { setPdfFile, setPdfData, setIsLoadingPdf, reset } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.type !== 'application/pdf') {
        setError('PDF 파일만 업로드 가능합니다.');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError('파일 크기는 10MB 이하여야 합니다.');
        return;
      }

      reset();
      setIsLoadingPdf(true);

      try {
        const arrayBuffer = await file.arrayBuffer();
        setPdfFile(file);
        setPdfData(new Uint8Array(arrayBuffer));
      } catch {
        setError('파일을 읽는 중 오류가 발생했습니다.');
        setIsLoadingPdf(false);
      }
    },
    [setPdfFile, setPdfData, setIsLoadingPdf, reset]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  const onClickUpload = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div
      onClick={onClickUpload}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickUpload(); } }}
      aria-label="PDF 파일 업로드 영역"
      className={`
        flex flex-col items-center justify-center
        border-2 border-dashed rounded-2xl p-6 sm:p-8 md:p-12 text-center
        transition-all duration-200 cursor-pointer min-h-[200px] sm:min-h-[300px]
        ${
          isDragging
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={onFileSelect}
        className="hidden"
        aria-label="PDF 파일 선택"
      />
      <div className="text-6xl mb-4">
        {isDragging ? '📥' : '📄'}
      </div>
      <p className="text-xl font-semibold text-gray-700 mb-2">
        {isDragging ? '여기에 놓으세요!' : (
          <>
            <span className="sm:hidden">PDF 파일을 탭하여 업로드</span>
            <span className="hidden sm:inline">PDF 파일을 드래그하거나 클릭하여 업로드</span>
          </>
        )}
      </p>
      <p className="text-sm text-gray-500">최대 10MB · PDF 형식만 지원</p>
      {error && (
        <p role="alert" className="text-red-500 text-sm mt-4 bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}
