/**
 * Document Storage Port & Bluehost Adapter Simulation
 * 
 * ARCHITECTURE PRINCIPLE:
 * The frontend/Vercel client NEVER writes directly to the Bluehost filesystem.
 * In production, uploads go through an authenticated backend API route with tenant
 * authorization checks, which handles the protected storage adapter.
 * Metadata is stored in Supabase/PostgreSQL.
 */

export interface StorageUploadRequest {
  organizationId: string;
  employeeId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileBufferOrBase64?: string;
}

export interface StorageUploadResponse {
  success: boolean;
  storageReference: string;
  signedDownloadUrl: string;
  fileSizeFormatted: string;
  storedAt: string;
}

export interface PersonnelDocumentStoragePort {
  uploadDocument(request: StorageUploadRequest): Promise<StorageUploadResponse>;
  getDownloadUrl(storageReference: string, organizationId: string): Promise<string>;
  deleteDocument(storageReference: string, organizationId: string): Promise<boolean>;
}

/**
 * Simulated Adapter for external Bluehost document vault.
 * Prepares the contract for when Bluehost SFTP / S3-compatible bucket is configured.
 */
export class BluehostPersonnelDocumentStorageAdapter implements PersonnelDocumentStoragePort {
  private readonly baseUrl: string = 'https://vault.internal.horecamodular.es/storage/bluehost';

  async uploadDocument(request: StorageUploadRequest): Promise<StorageUploadResponse> {
    // Simulate network latency of secure backend upload
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Generate secure opaque reference (never raw physical filesystem paths)
    const sanitizedName = request.fileName.toLowerCase().replace(/[^a-z0-9.-]/g, '_');
    const timestamp = Date.now();
    const storageReference = `bluehost://org_${request.organizationId}/emp_${request.employeeId}/${timestamp}_${sanitizedName}`;

    // Size formatting
    const sizeKB = Math.round(request.fileSize / 1024) || 240;
    const fileSizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    return {
      success: true,
      storageReference,
      signedDownloadUrl: `${this.baseUrl}/token_auth_${timestamp}.pdf`,
      fileSizeFormatted,
      storedAt: new Date().toISOString(),
    };
  }

  async getDownloadUrl(storageReference: string, organizationId: string): Promise<string> {
    // Generates a simulated time-limited signed URL with authorization check
    return `${this.baseUrl}/download?ref=${encodeURIComponent(storageReference)}&org=${organizationId}&exp=${Date.now() + 3600000}`;
  }

  async deleteDocument(storageReference: string, organizationId: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return true;
  }
}

export const documentStorageService: PersonnelDocumentStoragePort = new BluehostPersonnelDocumentStorageAdapter();
