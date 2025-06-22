import crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  tag?: string;
}

export class BackendEncryptionService {
  private static instance: BackendEncryptionService;
  private config: EncryptionConfig = {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16,
    saltLength: 32,
    iterations: 10000,
  };

  private constructor() {}

  public static getInstance(): BackendEncryptionService {
    if (!BackendEncryptionService.instance) {
      BackendEncryptionService.instance = new BackendEncryptionService();
    }
    return BackendEncryptionService.instance;
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptData(data: any, userKey: string): EncryptedData {
    try {
      const dataString = JSON.stringify(data);
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Derive key from user key + salt
      const key = crypto.pbkdf2Sync(
        userKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      let encrypted = cipher.update(dataString, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        data: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
      };
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data for retrieval
   */
  decryptData(encryptedData: EncryptedData, userKey: string): any {
    try {
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      
      // Derive same key
      const key = crypto.pbkdf2Sync(
        userKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt sensitive fields in sync data
   */
  encryptSyncData(syncData: any, userKey: string): any {
    try {
      if (!syncData || typeof syncData !== 'object') {
        return syncData;
      }

      const sensitiveFields = [
        'content', 'notes', 'description', 'answer', 'question',
        'personal_notes', 'study_notes', 'summary_text', 'title'
      ];

      const encrypted = { ...syncData };
      const encryptedFields: string[] = [];

      for (const field of sensitiveFields) {
        if (encrypted[field] && typeof encrypted[field] === 'string') {
          const encryptedField = this.encryptData(encrypted[field], userKey);
          encrypted[`${field}_encrypted`] = encryptedField;
          delete encrypted[field]; // Remove plain text
          encryptedFields.push(field);
        }
      }

      // Track which fields were encrypted
      if (encryptedFields.length > 0) {
        encrypted._encrypted_fields = encryptedFields;
      }

      return encrypted;
    } catch (error) {
      console.error('Error encrypting sync data:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive fields in sync data
   */
  decryptSyncData(syncData: any, userKey: string): any {
    try {
      if (!syncData || typeof syncData !== 'object') {
        return syncData;
      }

      const decrypted = { ...syncData };

      // Find encrypted fields and decrypt them
      const encryptedFields = Object.keys(decrypted).filter(key => 
        key.endsWith('_encrypted')
      );

      for (const encryptedField of encryptedFields) {
        try {
          const originalField = encryptedField.replace('_encrypted', '');
          const decryptedValue = this.decryptData(
            decrypted[encryptedField], 
            userKey
          );
          decrypted[originalField] = decryptedValue;
          delete decrypted[encryptedField]; // Remove encrypted version
        } catch (error) {
          console.warn(`Failed to decrypt field ${encryptedField}:`, error);
          // Keep encrypted field if decryption fails
        }
      }

      // Clean up metadata
      delete decrypted._encrypted_fields;

      return decrypted;
    } catch (error) {
      console.error('Error decrypting sync data:', error);
      throw error;
    }
  }

  /**
   * Hash data for integrity checking
   */
  hashData(data: any): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate device fingerprint hash
   */
  generateDeviceFingerprintHash(deviceInfo: any): string {
    const fingerprintData = {
      ...deviceInfo,
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)), // Daily rotation
    };
    return this.hashData(fingerprintData);
  }

  /**
   * Validate request signature
   */
  validateRequestSignature(
    body: string,
    signature: string,
    timestamp: string,
    nonce: string,
    userKey: string
  ): boolean {
    try {
      // Check timestamp (within 5 minutes)
      const now = Date.now();
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
        return false;
      }

      // Generate expected signature
      const expectedSignature = this.hashData(`${body}:${timestamp}:${nonce}:${userKey}`);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error validating signature:', error);
      return false;
    }
  }

  /**
   * Validate data integrity
   */
  validateDataIntegrity(data: any, expectedHash: string): boolean {
    try {
      const actualHash = this.hashData(data);
      return crypto.timingSafeEqual(
        Buffer.from(actualHash, 'hex'),
        Buffer.from(expectedHash, 'hex')
      );
    } catch (error) {
      console.error('Error validating data integrity:', error);
      return false;
    }
  }

  /**
   * Generate checksum for sync metadata
   */
  generateChecksum(data: any): string {
    return this.hashData(data);
  }

  /**
   * Encrypt user key for storage
   */
  encryptUserKey(userKey: string, masterKey: string): string {
    try {
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);
      
      const key = crypto.pbkdf2Sync(
        masterKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);
      
      let encrypted = cipher.update(userKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return JSON.stringify({
        data: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
      });
    } catch (error) {
      console.error('Error encrypting user key:', error);
      throw new Error('Failed to encrypt user key');
    }
  }

  /**
   * Decrypt user key from storage
   */
  decryptUserKey(encryptedUserKey: string, masterKey: string): string {
    try {
      const encryptedData = JSON.parse(encryptedUserKey);
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      
      const key = crypto.pbkdf2Sync(
        masterKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );

      const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Error decrypting user key:', error);
      throw new Error('Failed to decrypt user key');
    }
  }
}

export const backendEncryptionService = BackendEncryptionService.getInstance(); 