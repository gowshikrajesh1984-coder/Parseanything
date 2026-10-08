import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  DocumentMetadata,
  ConfidenceDistribution,
  FlaggedPageItem,
  ProcessedDocumentItem,
  ExtractedBlock,
  DocumentValidationError,
  DrawerType,
  ProcessingState,
  ExportFormat,
} from '../types';
import {
  initialDocument,
  defaultConfidenceDistribution,
  defaultFlaggedPages,
  defaultProcessedDocuments,
  initialExtractedBlocks,
  sampleExtractionErrors,
} from '../data/mockData';
import { validateDocumentFile } from '../utils/fileValidation';

interface DocumentContextType {
  document: DocumentMetadata;
  setDocument: React.Dispatch<React.SetStateAction<DocumentMetadata>>;
  confidenceDistribution: ConfidenceDistribution;
  flaggedPages: FlaggedPageItem[];
  resolveFlaggedPage: (page: number) => void;
  processedDocuments: ProcessedDocumentItem[];
  activeDrawer: DrawerType;
  openDrawer: (type: DrawerType) => void;
  closeDrawer: () => void;
  bookModalOpen: boolean;
  openBookModal: () => void;
  closeBookModal: () => void;
  bookPage: 1 | 2;
  setBookPage: (p: 1 | 2) => void;
  selectedFlaggedPage: number | null;
  setSelectedFlaggedPage: (p: number | null) => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  uploadStatus: ProcessingState;
  setUploadStatus: React.Dispatch<React.SetStateAction<ProcessingState>>;
  uploadProgress: number;
  parsingProgress: number;
  parsingStage: string;
  exportFormat: ExportFormat;
  setExportFormat: (f: ExportFormat) => void;
  uploadedFile: File | null;
  uploadedFileUrl: string | null;
  validationError: DocumentValidationError | null;
  clearValidationError: () => void;
  extractedBlocks: ExtractedBlock[];
  extractionErrors: DocumentValidationError[];
  startUpload: (fileInput?: File | { name: string; size: string; type: string }) => Promise<boolean>;
  removeFile: () => void;
  startParsing: (onComplete?: () => void) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [document, setDocument] = useState<DocumentMetadata>(initialDocument);
  const [confidenceDistribution] = useState<ConfidenceDistribution>(defaultConfidenceDistribution);
  const [flaggedPages, setFlaggedPages] = useState<FlaggedPageItem[]>(defaultFlaggedPages);
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocumentItem[]>(defaultProcessedDocuments);
  const [extractedBlocks, setExtractedBlocks] = useState<ExtractedBlock[]>(initialExtractedBlocks);
  const [extractionErrors] = useState<DocumentValidationError[]>(sampleExtractionErrors);

  // File objects & Object URLs for local rendering (never persisted to localStorage)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(
    '/src/assets/images/invoice_doc_preview_1791377572904.jpg'
  );
  const currentObjectUrlRef = useRef<string | null>(null);

  // Validation state
  const [validationError, setValidationError] = useState<DocumentValidationError | null>(null);

  // Drawer state
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);

  // Book modal state
  const [bookModalOpen, setBookModalOpen] = useState<boolean>(false);
  const [bookPage, setBookPage] = useState<1 | 2>(1);

  // Selected flagged page / block in review
  const [selectedFlaggedPage, setSelectedFlaggedPage] = useState<number | null>(3);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('block-023');

  // Upload & parsing states
  const [uploadStatus, setUploadStatus] = useState<ProcessingState>('uploaded');
  const [uploadProgress, setUploadProgress] = useState<number>(100);
  const [parsingProgress, setParsingProgress] = useState<number>(0);
  const [parsingStage, setParsingStage] = useState<string>('Ready');

  // Export format selection
  const [exportFormat, setExportFormat] = useState<ExportFormat>('JSON');

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (currentObjectUrlRef.current && currentObjectUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, []);

  // Keyboard accessibility: ESC closes drawer or book modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (bookModalOpen) {
          setBookModalOpen(false);
        } else if (activeDrawer) {
          setActiveDrawer(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookModalOpen, activeDrawer]);

  const openDrawer = useCallback((type: DrawerType) => {
    setActiveDrawer(type);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  const openBookModal = useCallback(() => {
    setBookPage(1);
    setBookModalOpen(true);
  }, []);

  const closeBookModal = useCallback(() => {
    setBookModalOpen(false);
  }, []);

  const clearValidationError = useCallback(() => {
    setValidationError(null);
  }, []);

  const resolveFlaggedPage = useCallback((pageNumber: number) => {
    setFlaggedPages((prev) =>
      prev.map((item) =>
        item.page === pageNumber ? { ...item, resolved: !item.resolved } : item
      )
    );
  }, []);

  const removeFile = useCallback(() => {
    // Revoke object URL
    if (currentObjectUrlRef.current && currentObjectUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setUploadedFile(null);
    setUploadedFileUrl(null);
    setValidationError(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setParsingProgress(0);
  }, []);

  const startUpload = useCallback(
    async (fileInput?: File | { name: string; size: string; type: string }): Promise<boolean> => {
      setValidationError(null);

      // If real File object passed, perform validation first!
      if (fileInput instanceof File) {
        const val = await validateDocumentFile(fileInput);
        if (!val.isValid && val.error) {
          setValidationError(val.error);
          setUploadStatus('idle');
          return false;
        }

        // Revoke prior URL
        if (currentObjectUrlRef.current && currentObjectUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(currentObjectUrlRef.current);
        }
        const objUrl = URL.createObjectURL(fileInput);
        currentObjectUrlRef.current = objUrl;
        setUploadedFile(fileInput);
        setUploadedFileUrl(objUrl);
      }

      const fileName = fileInput?.name || 'Invoice_2025.pdf';
      const fileSize =
        typeof fileInput?.size === 'number'
          ? `${(fileInput.size / (1024 * 1024)).toFixed(1)} MB`
          : (fileInput?.size as string) || '2.4 MB';
      const fileFormat = fileName.split('.').pop()?.toUpperCase() || 'PDF';

      setUploadStatus('uploading');
      setUploadProgress(0);

      let current = 0;
      const interval = setInterval(() => {
        current += Math.floor(Math.random() * 22) + 16;
        if (current >= 100) {
          clearInterval(interval);
          setUploadProgress(100);
          setUploadStatus('uploaded');
          setDocument((prev) => ({
            ...prev,
            name: fileName,
            size: fileSize,
            format: fileFormat,
            pages: fileFormat === 'PDF' ? 5 : 1,
            processedAt: 'Apr 26, 2025 • 10:32 AM',
            confidence: 92.4,
          }));
        } else {
          setUploadProgress(current);
        }
      }, 150);

      return true;
    },
    []
  );

  const startParsing = useCallback(
    (onComplete?: () => void) => {
      setUploadStatus('parsing');
      setParsingProgress(0);
      setParsingStage('Validating Document Security & Isolation Sandbox...');

      const stages = [
        { progress: 20, stage: 'Scanning Document OCR Layers & Glyphs...' },
        { progress: 45, stage: 'Extracting Table Grids & Hierarchy...' },
        { progress: 70, stage: 'Detecting Entities & Semantic Equations...' },
        { progress: 90, stage: 'Computing Confidence & Cross-Validation...' },
        { progress: 100, stage: 'Document parsing is complete!' },
      ];

      let currentStageIndex = 0;
      const stageInterval = setInterval(() => {
        if (currentStageIndex < stages.length) {
          setParsingProgress(stages[currentStageIndex].progress);
          setParsingStage(stages[currentStageIndex].stage);
          currentStageIndex++;
        } else {
          clearInterval(stageInterval);
          setUploadStatus('completed');

          // Add to processed documents list if not already present
          setProcessedDocuments((prev) => {
            if (prev.some((d) => d.name === document.name)) return prev;
            return [
              {
                id: `doc-${Date.now()}`,
                name: document.name,
                type: document.format,
                size: document.size,
                date: 'Apr 26, 2025',
                time: '10:35 AM',
                status: 'Processed',
                confidence: document.confidence,
                pages: document.pages,
              },
              ...prev,
            ];
          });

          // Wait a short moment on green completion before opening book popup
          setTimeout(() => {
            setBookPage(1);
            setBookModalOpen(true);
            if (onComplete) onComplete();
          }, 850);
        }
      }, 550);
    },
    [document]
  );

  return (
    <DocumentContext.Provider
      value={{
        document,
        setDocument,
        confidenceDistribution,
        flaggedPages,
        resolveFlaggedPage,
        processedDocuments,
        activeDrawer,
        openDrawer,
        closeDrawer,
        bookModalOpen,
        openBookModal,
        closeBookModal,
        bookPage,
        setBookPage,
        selectedFlaggedPage,
        setSelectedFlaggedPage,
        selectedBlockId,
        setSelectedBlockId,
        uploadStatus,
        setUploadStatus,
        uploadProgress,
        parsingProgress,
        parsingStage,
        exportFormat,
        setExportFormat,
        uploadedFile,
        uploadedFileUrl,
        validationError,
        clearValidationError,
        extractedBlocks,
        extractionErrors,
        startUpload,
        removeFile,
        startParsing,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
};
