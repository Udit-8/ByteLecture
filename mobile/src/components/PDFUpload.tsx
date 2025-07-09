import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { theme } from '../constants/theme';
import { Card, LoadingIndicator, PremiumUpsellModal } from './';
import { UploadErrorBoundary } from './ErrorBoundary';
import {
  validatePDFFile,
  getValidationErrorMessage,
  formatFileSize,
} from '../utils';
import {
  uploadPDFToSupabase,
  UploadController,
  UploadProgress as ServiceUploadProgress,
  UploadResult as ServiceUploadResult,
  getProgressText,
  checkBucketAccess,
} from '../services/uploadService';
import { permissionService } from '../services';
import { supabase } from '../config/supabase';

interface PDFUploadProps {
  onFileSelected: (file: PDFFile) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
  allowCancellation?: boolean;
  maxFileSize?: number; // in MB
  disabled?: boolean;
  navigation?: any; // Optional navigation prop for quota exceeded cases
}

export interface PDFFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  path?: string;
  message?: string;
  error?: string;
}

export const PDFUpload: React.FC<PDFUploadProps> = ({
  onFileSelected,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  allowCancellation = true,
  maxFileSize = 10, // 10MB default
  disabled = false,
  navigation,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<PDFFile | null>(null);
  const [uploadController, setUploadController] =
    useState<UploadController | null>(null);
  const [detailedProgress, setDetailedProgress] =
    useState<ServiceUploadProgress | null>(null);
  const [bucketReady, setBucketReady] = useState<boolean | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<{
    remaining?: number;
    limit?: number;
    isPremium?: boolean;
  }>({});
  const [showPremiumUpsell, setShowPremiumUpsell] = useState(false);

  // Check bucket access on component mount
  React.useEffect(() => {
    const checkBucket = async () => {
      console.log('[PDFUpload] Checking bucket access on mount...');
      const hasAccess = await checkBucketAccess('pdfs');
      setBucketReady(hasAccess);
      if (!hasAccess) {
        console.warn('Documents bucket is not accessible. Uploads may fail.');

        // Retry after a short delay in case auth wasn't ready
        setTimeout(async () => {
          console.log('[PDFUpload] Retrying bucket access check...');
          const retryAccess = await checkBucketAccess('pdfs');
          setBucketReady(retryAccess);
          if (retryAccess) {
            console.log('[PDFUpload] Bucket access retry succeeded!');
          } else {
            console.warn('[PDFUpload] Bucket access retry failed');
          }
        }, 2000);
      } else {
        console.log('[PDFUpload] Bucket access check succeeded');
      }
    };
    checkBucket();
  }, []);

  // Check quota on component mount
  React.useEffect(() => {
    const checkQuota = async () => {
      try {
        const permissionResult = await permissionService.checkFeatureUsage(
          'pdf_processing',
          'pdf_upload'
        );
        if (permissionResult.limit !== undefined) {
          setQuotaInfo({
            remaining: permissionResult.remaining,
            limit: permissionResult.limit,
            isPremium: permissionResult.limit === -1,
          });
        }
      } catch (error) {
        console.error('Error checking quota:', error);
      }
    };
    checkQuota();
  }, []);

  const performPDFValidation = useCallback(
    async (file: PDFFile): Promise<boolean> => {
      setIsValidating(true);

      try {
        const validationResult = await validatePDFFile(file, {
          maxFileSize: maxFileSize,
          allowEncrypted: false,
        });

        if (!validationResult.isValid) {
          const errorMessage = getValidationErrorMessage(
            validationResult.error || 'Unknown error'
          );
          Alert.alert('Invalid PDF', errorMessage);
          return false;
        }

        return true;
      } catch (error) {
        console.error('PDF validation error:', error);
        Alert.alert(
          'Validation Error',
          'Failed to validate PDF file. Please try again.'
        );
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    [maxFileSize]
  );

  const handleDocumentPicker = useCallback(async () => {
    if (disabled || isUploading || isValidating) return;

    try {
      // Check permissions before allowing file selection
      const permissionResult = await permissionService.checkFeatureUsage(
        'pdf_processing',
        'pdf_upload'
      );

      if (!permissionResult.allowed) {
        setShowPremiumUpsell(true);
        return;
      }

      // Show remaining quota if not unlimited
      if (
        permissionResult.remaining !== undefined &&
        permissionResult.limit !== -1
      ) {
        console.log(
          `PDF uploads remaining today: ${permissionResult.remaining}`
        );
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        const pdfFile: PDFFile = {
          uri: file.uri,
          name: file.name,
          size: file.size || 0,
          type: file.mimeType || 'application/pdf',
        };

        const isValid = await performPDFValidation(pdfFile);
        if (isValid) {
          setSelectedFile(pdfFile);
          onFileSelected(pdfFile);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
      onUploadError?.('Failed to select file');
    }
  }, [
    disabled,
    isUploading,
    isValidating,
    performPDFValidation,
    onFileSelected,
    onUploadError,
    navigation,
  ]);

  const performSupabaseUpload = useCallback(
    async (file: PDFFile) => {
      setIsUploading(true);
      setUploadProgress(0);
      setDetailedProgress(null);

      // Create new upload controller
      const controller = new UploadController();
      setUploadController(controller);

      try {
        // Check bucket access before upload - but don't block if uncertain
        if (bucketReady === false) {
          console.warn(
            '[PDFUpload] Bucket access check failed, but attempting upload anyway...'
          );
          // Don't throw error here - let the actual upload attempt reveal the real issue
        }

        // Double-check authentication right before upload
        console.log('[PDFUpload] Verifying authentication before upload...');
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();

        if (authError || !session?.user) {
          throw new Error(
            'Authentication required. Please sign in and try again.'
          );
        }

        console.log(
          `[PDFUpload] Authentication verified for user: ${session.user.email}`
        );

        const result = await uploadPDFToSupabase(
          file,
          {
            bucketName: 'pdfs',
            folder: 'pdfs',
            retryCount: 3,
            onProgress: (progress: ServiceUploadProgress) => {
              setDetailedProgress(progress);
              setUploadProgress(progress.progress);
              onUploadProgress?.(progress.progress);
            },
          },
          controller
        );

        if (result.success) {
          const uploadResult: UploadResult = {
            success: true,
            fileId: result.fileId,
            publicUrl: result.publicUrl,
            path: result.path,
            message: result.message || 'PDF uploaded successfully',
          };

          onUploadComplete?.(uploadResult);
          Alert.alert('Success', '✅ PDF uploaded successfully!');

          // Refresh quota info after successful upload
          try {
            const updatedPermission = await permissionService.checkFeatureUsage(
              'pdf_processing',
              'pdf_upload'
            );
            if (updatedPermission.limit !== undefined) {
              setQuotaInfo({
                remaining: updatedPermission.remaining,
                limit: updatedPermission.limit,
                isPremium: updatedPermission.limit === -1,
              });
            }
          } catch (error) {
            console.error('Error refreshing quota:', error);
          }
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);

        // Enhanced error handling for different error types
        let errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to upload PDF. Please try again.';
        let alertTitle = 'Upload Failed';

        // Check for quota exceeded errors
        if (
          errorMessage.includes('quota') ||
          errorMessage.includes('limit') ||
          errorMessage.includes('exceeded')
        ) {
          setShowPremiumUpsell(true);

          const uploadResult: UploadResult = {
            success: false,
            error: 'Upload limit reached',
          };

          onUploadError?.('Upload limit reached');
          onUploadComplete?.(uploadResult);
          setIsUploading(false);
          setUploadProgress(0);
          setDetailedProgress(null);
          setUploadController(null);
          return; // Exit early to avoid duplicate alerts
        }
        // Check for authentication errors
        else if (
          errorMessage.includes('Authentication') ||
          errorMessage.includes('auth') ||
          errorMessage.includes('login')
        ) {
          alertTitle = 'Authentication Error';
          errorMessage = 'Please sign in again and try uploading your file.';
        }
        // Check for network errors
        else if (
          errorMessage.includes('Network') ||
          errorMessage.includes('network') ||
          errorMessage.includes('connection')
        ) {
          alertTitle = 'Connection Error';
          errorMessage = 'Please check your internet connection and try again.';
        }
        // Check for file validation errors
        else if (
          errorMessage.includes('file') ||
          errorMessage.includes('format') ||
          errorMessage.includes('size')
        ) {
          alertTitle = 'File Error';
          errorMessage =
            'There was an issue with your file. Please ensure it is a valid PDF under 10MB.';
        }

        const uploadResult: UploadResult = {
          success: false,
          error: errorMessage,
        };

        onUploadError?.(errorMessage);
        onUploadComplete?.(uploadResult);
        Alert.alert(alertTitle, `❌ ${errorMessage}`);
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setDetailedProgress(null);
        setUploadController(null);
      }
    },
    [onUploadProgress, onUploadComplete, onUploadError, bucketReady]
  );

  const handleUpload = useCallback(() => {
    if (selectedFile && !isUploading) {
      performSupabaseUpload(selectedFile);
    }
  }, [selectedFile, isUploading, performSupabaseUpload]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
    setDetailedProgress(null);
  }, []);

  const handleCancelUpload = useCallback(() => {
    if (uploadController && isUploading) {
      uploadController.abort();
      Alert.alert('Upload Cancelled', 'The upload has been cancelled.');
    }
  }, [uploadController, isUploading]);

  return (
    <UploadErrorBoundary
      onError={(error, errorInfo) => {
        console.error('PDFUpload error boundary caught:', error, errorInfo);
        onUploadError?.(
          'An unexpected error occurred during upload. Please try again.'
        );
      }}
    >
      <View style={styles.container}>
        {!selectedFile ? (
          <TouchableOpacity
            style={[styles.uploadArea, disabled && styles.uploadAreaDisabled]}
            onPress={handleDocumentPicker}
            disabled={disabled || isUploading || isValidating}
            activeOpacity={0.7}
          >
            <View style={styles.uploadContent}>
              <View style={styles.iconContainer}>
                {isValidating ? (
                  <LoadingIndicator size="large" />
                ) : (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={48}
                    color={
                      disabled
                        ? theme.colors.gray[400]
                        : theme.colors.primary[600]
                    }
                  />
                )}
              </View>
              <Text
                style={[
                  styles.uploadTitle,
                  disabled && styles.uploadTitleDisabled,
                ]}
              >
                {isValidating ? 'Validating PDF...' : 'Upload PDF File'}
              </Text>
              <Text
                style={[
                  styles.uploadSubtitle,
                  disabled && styles.uploadSubtitleDisabled,
                ]}
              >
                {isValidating
                  ? 'Please wait while we validate your file'
                  : 'Tap to select a PDF file from your device'}
              </Text>
              <Text
                style={[
                  styles.uploadHint,
                  disabled && styles.uploadHintDisabled,
                ]}
              >
                Maximum file size: {maxFileSize}MB
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Card style={styles.fileCard}>
            <View style={styles.fileInfo}>
              <View style={styles.fileIcon}>
                <Ionicons
                  name="document-text"
                  size={24}
                  color={theme.colors.error[600]}
                />
              </View>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.fileSize}>
                  {formatFileSize(selectedFile.size)}
                </Text>
              </View>
              {!isUploading && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={handleRemoveFile}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={theme.colors.gray[400]}
                  />
                </TouchableOpacity>
              )}
            </View>

            {isUploading && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressText}>
                    {detailedProgress
                      ? getProgressText(detailedProgress)
                      : `Uploading... ${uploadProgress}%`}
                  </Text>
                  {allowCancellation && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelUpload}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={theme.colors.gray[600]}
                      />
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${uploadProgress}%` },
                    ]}
                  />
                </View>
                {bucketReady === false && (
                  <Text style={styles.warningText}>
                    ⚠️ Storage connection may be unstable
                  </Text>
                )}
              </View>
            )}

            {!isUploading && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.selectAnotherButton}
                  onPress={handleDocumentPicker}
                >
                  <Text style={styles.selectAnotherText}>Select Another</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUpload}
                  disabled={isUploading}
                >
                  <Text style={styles.uploadButtonText}>Upload PDF</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {isUploading && (
          <View style={styles.loadingOverlay}>
            <LoadingIndicator size="large" />
          </View>
        )}
      </View>

      <PremiumUpsellModal
        visible={showPremiumUpsell}
        onClose={() => setShowPremiumUpsell(false)}
        onUpgrade={() => {
          setShowPremiumUpsell(false);
          navigation?.navigate('Subscription', { from: 'pdf-quota' });
        }}
        featureType="pdf-processing"
        currentUsage={
          quotaInfo.limit && quotaInfo.remaining !== undefined
            ? quotaInfo.limit - quotaInfo.remaining
            : undefined
        }
        limit={quotaInfo.limit}
      />
    </UploadErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: theme.colors.primary[300],
    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary[50],
    minHeight: 200,
  },
  uploadAreaDisabled: {
    borderColor: theme.colors.gray[300],
    backgroundColor: theme.colors.gray[100],
  },
  uploadContent: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.base,
  },
  uploadTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  uploadTitleDisabled: {
    color: theme.colors.gray[500],
  },
  uploadSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  uploadSubtitleDisabled: {
    color: theme.colors.gray[400],
  },
  uploadHint: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    textAlign: 'center',
  },
  uploadHintDisabled: {
    color: theme.colors.gray[400],
  },
  fileCard: {
    padding: theme.spacing.base,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.error[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.base,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  fileSize: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  progressContainer: {
    marginBottom: theme.spacing.base,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.full,
  },
  progressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    flex: 1,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.gray[100],
  },
  cancelText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginLeft: theme.spacing.xs,
  },
  warningText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.warning[600],
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.base,
  },
  selectAnotherButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    alignItems: 'center',
  },
  selectAnotherText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
  },
});
