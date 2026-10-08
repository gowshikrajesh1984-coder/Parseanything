import {
  DocumentMetadata,
  ExtractedBlock,
  DocumentValidationError,
  ProcessingState,
} from '../types';
import { validateDocumentFile } from '../utils/fileValidation';

/**
 * Document Intelligence API Service Layer
 * Abstracts backend processing isolation for production deployment.
 * In production, uploads and parsing execute in sandbox containers with
 * zero arbitrary execution, strict memory limits, and automated retention purge.
 */

export interface UploadResponse {
  success: boolean;
  documentId: string;
  metadata: Partial<DocumentMetadata>;
  error?: DocumentValidationError;
}

export interface ParseJobStatus {
  jobId: string;
  stage: string;
  progress: number;
  status: ProcessingState;
  completedAt?: string;
  error?: DocumentValidationError;
}

export interface ParsedResultsResponse {
  documentId: string;
  metadata: DocumentMetadata;
  blocks: ExtractedBlock[];
  errors: DocumentValidationError[];
}

export const documentApiService = {
  /**
   * Client-side validation prior to transmission
   */
  async validate(file: File): Promise<{ isValid: boolean; error?: DocumentValidationError }> {
    return await validateDocumentFile(file);
  },

  /**
   * Secure upload endpoint abstraction (POST /api/documents/upload)
   */
  async upload(file: File): Promise<UploadResponse> {
    const valResult = await this.validate(file);
    if (!valResult.isValid) {
      return {
        success: false,
        documentId: '',
        metadata: {},
        error: valResult.error,
      };
    }

    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const format = file.name.split('.').pop()?.toUpperCase() || 'PDF';
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

    return {
      success: true,
      documentId,
      metadata: {
        id: documentId,
        name: file.name,
        format,
        size: `${sizeMb} MB`,
        pages: format === 'PDF' ? 5 : 1,
      },
    };
  },

  /**
   * Triggers isolated parsing pipeline (POST /api/documents/parse)
   */
  async triggerParse(documentId: string): Promise<{ jobId: string }> {
    return {
      jobId: `job-${documentId}`,
    };
  },
};
