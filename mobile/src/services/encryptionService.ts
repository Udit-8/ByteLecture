import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
  iterations: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  tag?: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private config: EncryptionConfig = {
    algorithm: 'AES-256-GCM',
    keySize: 256,
    ivSize: 128,
    iterations: 10000,
  };

  private constructor() {}

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Generate a secure encryption key for the user
   */
  async generateUserKey(userId: string, password?: string): Promise<string> {
    try {
      // Check if key already exists
      const existingKey = await this.getUserKey(userId);
      if (existingKey) {
        return existingKey;
      }

      // Generate new key
      const salt = CryptoJS.lib.WordArray.random(256 / 8);
      const key = password
        ? CryptoJS.PBKDF2(password, salt, {
            keySize: this.config.keySize / 32,
            iterations: this.config.iterations,
          }).toString()
        : CryptoJS.lib.WordArray.random(this.config.keySize / 8).toString();

      // Store securely
      await this.storeUserKey(userId, key);

      return key;
    } catch (error) {
      console.error('Error generating user key:', error);
      throw new Error('Failed to generate encryption key');
    }
  }

  /**
   * Encrypt sensitive data before transmission/storage
   */
  async encryptData(data: any, userId: string): Promise<EncryptedData> {
    try {
      const key = await this.getUserKey(userId);
      if (!key) {
        throw new Error('Encryption key not found');
      }

      const dataString = JSON.stringify(data);
      const salt = CryptoJS.lib.WordArray.random(256 / 8);
      const iv = CryptoJS.lib.WordArray.random(this.config.ivSize / 8);

      // Derive key from stored key + salt
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: this.config.keySize / 32,
        iterations: 1000, // Fewer iterations for performance
      });

      // Encrypt data
      const encrypted = CryptoJS.AES.encrypt(dataString, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      return {
        data: encrypted.toString(),
        iv: iv.toString(),
        salt: salt.toString(),
      };
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data after reception/retrieval
   */
  async decryptData(
    encryptedData: EncryptedData,
    userId: string
  ): Promise<any> {
    try {
      const key = await this.getUserKey(userId);
      if (!key) {
        throw new Error('Encryption key not found');
      }

      const salt = CryptoJS.enc.Hex.parse(encryptedData.salt);
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);

      // Derive same key
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: this.config.keySize / 32,
        iterations: 1000,
      });

      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(encryptedData.data, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt sensitive fields in sync data
   */
  async encryptSyncData(syncData: any, userId: string): Promise<any> {
    try {
      if (!syncData || typeof syncData !== 'object') {
        return syncData;
      }

      const sensitiveFields = [
        'content',
        'notes',
        'description',
        'answer',
        'question',
        'personal_notes',
        'study_notes',
        'summary_text',
      ];

      const encrypted = { ...syncData };

      for (const field of sensitiveFields) {
        if (encrypted[field] && typeof encrypted[field] === 'string') {
          const encryptedField = await this.encryptData(
            encrypted[field],
            userId
          );
          encrypted[`${field}_encrypted`] = encryptedField;
          delete encrypted[field]; // Remove plain text
        }
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
  async decryptSyncData(syncData: any, userId: string): Promise<any> {
    try {
      if (!syncData || typeof syncData !== 'object') {
        return syncData;
      }

      const decrypted = { ...syncData };

      // Find encrypted fields and decrypt them
      const encryptedFields = Object.keys(decrypted).filter((key) =>
        key.endsWith('_encrypted')
      );

      for (const encryptedField of encryptedFields) {
        try {
          const originalField = encryptedField.replace('_encrypted', '');
          const decryptedValue = await this.decryptData(
            decrypted[encryptedField],
            userId
          );
          decrypted[originalField] = decryptedValue;
          delete decrypted[encryptedField]; // Remove encrypted version
        } catch (error) {
          console.warn(`Failed to decrypt field ${encryptedField}:`, error);
          // Keep encrypted field if decryption fails
        }
      }

      return decrypted;
    } catch (error) {
      console.error('Error decrypting sync data:', error);
      throw error;
    }
  }

  /**
   * Generate secure device fingerprint
   */
  async generateDeviceFingerprint(): Promise<string> {
    try {
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        timestamp: Date.now(),
        random: Math.random().toString(36),
      };

      // Add platform-specific identifiers
      if (Platform.OS === 'ios') {
        // iOS-specific device info would go here
        deviceInfo.platform = 'ios';
      } else if (Platform.OS === 'android') {
        // Android-specific device info would go here
        deviceInfo.platform = 'android';
      }

      const fingerprint = CryptoJS.SHA256(
        JSON.stringify(deviceInfo)
      ).toString();

      // Store fingerprint securely
      await SecureStore.setItemAsync('device_fingerprint', fingerprint);

      return fingerprint;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      throw new Error('Failed to generate device fingerprint');
    }
  }

  /**
   * Get stored device fingerprint
   */
  async getDeviceFingerprint(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('device_fingerprint');
    } catch (error) {
      console.error('Error getting device fingerprint:', error);
      return null;
    }
  }

  /**
   * Hash sensitive data for comparison
   */
  hashData(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Store user encryption key securely
   */
  private async storeUserKey(userId: string, key: string): Promise<void> {
    try {
      const keyName = `encryption_key_${userId}`;
      await SecureStore.setItemAsync(keyName, key);
    } catch (error) {
      console.error('Error storing user key:', error);
      throw new Error('Failed to store encryption key');
    }
  }

  /**
   * Retrieve user encryption key
   */
  private async getUserKey(userId: string): Promise<string | null> {
    try {
      const keyName = `encryption_key_${userId}`;
      return await SecureStore.getItemAsync(keyName);
    } catch (error) {
      console.error('Error retrieving user key:', error);
      return null;
    }
  }

  /**
   * Clear user encryption key (for logout)
   */
  async clearUserKey(userId: string): Promise<void> {
    try {
      const keyName = `encryption_key_${userId}`;
      await SecureStore.deleteItemAsync(keyName);
    } catch (error) {
      console.error('Error clearing user key:', error);
    }
  }

  /**
   * Validate data integrity using hash
   */
  validateDataIntegrity(data: any, expectedHash: string): boolean {
    try {
      const dataString = JSON.stringify(data);
      const actualHash = this.hashData(dataString);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('Error validating data integrity:', error);
      return false;
    }
  }
}

export const encryptionService = EncryptionService.getInstance();
