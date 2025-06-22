import { supabaseAdmin } from '../config/supabase';
import {
  SyncConflict,
  ConflictType,
  ConflictSeverity,
  ResolutionStrategy,
  FieldConflict,
  FieldResolution,
  ConflictDeviceInfo,
  ConflictResolutionMetadata,
  ContentAwareRule,
  ConflictResolutionPreferences,
  ResolveConflictRequest,
  ResolveConflictResponse,
  BatchResolveConflictsRequest,
  BatchResolveConflictsResponse,
  ConflictPreviewRequest,
  ConflictPreviewResponse,
} from '../types/sync';

export class ConflictResolutionService {
  // Content-aware resolution rules for different data types
  private readonly contentAwareRules: ContentAwareRule[] = [
    // Flashcard rules
    {
      table_name: 'flashcards',
      field_name: 'front_text',
      conflict_type: 'field_conflict',
      default_strategy: 'user_choice',
    },
    {
      table_name: 'flashcards',
      field_name: 'back_text',
      conflict_type: 'field_conflict',
      default_strategy: 'user_choice',
    },
    {
      table_name: 'flashcards',
      field_name: 'difficulty',
      conflict_type: 'field_conflict',
      default_strategy: 'merge',
    },
    // Study session rules
    {
      table_name: 'study_sessions',
      field_name: 'score',
      conflict_type: 'field_conflict',
      default_strategy: 'last_write_wins',
    },
    {
      table_name: 'study_sessions',
      field_name: 'completed_at',
      conflict_type: 'field_conflict',
      default_strategy: 'last_write_wins',
    },
    // Content items rules
    {
      table_name: 'content_items',
      field_name: 'title',
      conflict_type: 'field_conflict',
      default_strategy: 'user_choice',
    },
    {
      table_name: 'content_items',
      field_name: 'notes',
      conflict_type: 'field_conflict',
      default_strategy: 'merge',
    },
    // Quiz rules
    {
      table_name: 'quiz_attempts',
      field_name: 'score',
      conflict_type: 'field_conflict',
      default_strategy: 'last_write_wins',
    },
    // Mind map rules
    {
      table_name: 'mind_maps',
      field_name: 'title',
      conflict_type: 'field_conflict',
      default_strategy: 'user_choice',
    },
    {
      table_name: 'mind_map_nodes',
      field_name: 'content',
      conflict_type: 'field_conflict',
      default_strategy: 'user_choice',
    },
  ];

  /**
   * Detect conflicts between local and remote data with field-level analysis
   */
  async detectConflicts(
    tableName: string,
    recordId: string,
    localData: any,
    remoteData: any,
    localDeviceInfo: ConflictDeviceInfo,
    remoteDeviceInfo: ConflictDeviceInfo
  ): Promise<SyncConflict | null> {
    // Skip if data is identical
    if (JSON.stringify(localData) === JSON.stringify(remoteData)) {
      return null;
    }

    const fieldConflicts = this.analyzeFieldConflicts(localData, remoteData);

    if (fieldConflicts.length === 0) {
      return null;
    }

    const conflictType = this.determineConflictType(fieldConflicts);
    const severity = this.calculateConflictSeverity(tableName, fieldConflicts);
    const autoResolvable = this.isAutoResolvable(
      tableName,
      fieldConflicts,
      severity
    );

    const conflict: SyncConflict = {
      id: crypto.randomUUID(),
      table_name: tableName,
      record_id: recordId,
      user_id: localData.user_id || remoteData.user_id,
      local_data: localData,
      remote_data: remoteData,
      conflict_type: conflictType,
      severity,
      conflicting_fields: fieldConflicts.map((fc) => fc.field_name),
      local_device_info: localDeviceInfo,
      remote_device_info: remoteDeviceInfo,
      auto_resolvable: autoResolvable,
      resolved: false,
      created_at: new Date().toISOString(),
    };

    return conflict;
  }

  /**
   * Analyze field-level conflicts between local and remote data
   */
  private analyzeFieldConflicts(
    localData: any,
    remoteData: any
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];
    const allFields = new Set([
      ...Object.keys(localData),
      ...Object.keys(remoteData),
    ]);

    for (const field of allFields) {
      const localValue = localData[field];
      const remoteValue = remoteData[field];

      // Skip system fields that shouldn't conflict
      if (['id', 'created_at', 'user_id'].includes(field)) {
        continue;
      }

      // Skip if values are identical
      if (JSON.stringify(localValue) === JSON.stringify(remoteValue)) {
        continue;
      }

      const conflictType = this.determineFieldConflictType(
        localValue,
        remoteValue
      );
      const isMergeable = this.isFieldMergeable(field, localValue, remoteValue);

      conflicts.push({
        field_name: field,
        local_value: localValue,
        remote_value: remoteValue,
        conflict_type: conflictType,
        is_mergeable: isMergeable,
        suggested_resolution: this.suggestFieldResolution(
          field,
          localValue,
          remoteValue,
          isMergeable
        ),
        merge_strategy: isMergeable
          ? this.getMergeStrategy(field, localValue, remoteValue)
          : undefined,
      });
    }

    return conflicts;
  }

  /**
   * Determine the type of field conflict
   */
  private determineFieldConflictType(
    localValue: any,
    remoteValue: any
  ): 'value_mismatch' | 'type_mismatch' | 'null_conflict' {
    if (localValue === null || remoteValue === null) {
      return 'null_conflict';
    }
    if (typeof localValue !== typeof remoteValue) {
      return 'type_mismatch';
    }
    return 'value_mismatch';
  }

  /**
   * Check if a field can be automatically merged
   */
  private isFieldMergeable(
    fieldName: string,
    localValue: any,
    remoteValue: any
  ): boolean {
    // String fields that can be merged (like notes, descriptions)
    if (
      fieldName.includes('note') ||
      fieldName.includes('description') ||
      fieldName.includes('content')
    ) {
      return typeof localValue === 'string' && typeof remoteValue === 'string';
    }

    // Numeric fields that can be averaged or summed
    if (
      fieldName.includes('score') ||
      fieldName.includes('count') ||
      fieldName.includes('rating')
    ) {
      return typeof localValue === 'number' && typeof remoteValue === 'number';
    }

    // Array fields that can be merged
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return true;
    }

    // Object fields that can be merged
    if (
      typeof localValue === 'object' &&
      typeof remoteValue === 'object' &&
      localValue !== null &&
      remoteValue !== null
    ) {
      return true;
    }

    return false;
  }

  /**
   * Suggest the best resolution for a field conflict
   */
  private suggestFieldResolution(
    fieldName: string,
    localValue: any,
    remoteValue: any,
    isMergeable: boolean
  ): 'local' | 'remote' | 'merge' {
    if (isMergeable) {
      return 'merge';
    }

    // For timestamps, prefer the later one
    if (fieldName.includes('_at') || fieldName.includes('timestamp')) {
      const localTime = new Date(localValue).getTime();
      const remoteTime = new Date(remoteValue).getTime();
      return localTime > remoteTime ? 'local' : 'remote';
    }

    // For scores and ratings, prefer the higher one
    if (fieldName.includes('score') || fieldName.includes('rating')) {
      return localValue > remoteValue ? 'local' : 'remote';
    }

    // Default to remote (server wins)
    return 'remote';
  }

  /**
   * Get merge strategy for a field
   */
  private getMergeStrategy(
    fieldName: string,
    localValue: any,
    remoteValue: any
  ): string {
    if (typeof localValue === 'string' && typeof remoteValue === 'string') {
      return 'text_merge';
    }
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      return 'numeric_average';
    }
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return 'array_union';
    }
    if (typeof localValue === 'object' && typeof remoteValue === 'object') {
      return 'object_merge';
    }
    return 'manual';
  }

  /**
   * Determine the overall conflict type based on field conflicts
   */
  private determineConflictType(fieldConflicts: FieldConflict[]): ConflictType {
    if (fieldConflicts.some((fc) => fc.conflict_type === 'type_mismatch')) {
      return 'schema_conflict';
    }
    if (fieldConflicts.length > 1) {
      return 'field_conflict';
    }
    return 'update_conflict';
  }

  /**
   * Calculate conflict severity based on table and fields involved
   */
  private calculateConflictSeverity(
    tableName: string,
    fieldConflicts: FieldConflict[]
  ): ConflictSeverity {
    // Critical tables
    if (['users', 'content_items'].includes(tableName)) {
      return 'high';
    }

    // Check for critical fields
    const criticalFields = ['title', 'content', 'front_text', 'back_text'];
    const hasCriticalField = fieldConflicts.some((fc) =>
      criticalFields.some((cf) => fc.field_name.includes(cf))
    );

    if (hasCriticalField) {
      return 'medium';
    }

    // Check for type mismatches
    if (fieldConflicts.some((fc) => fc.conflict_type === 'type_mismatch')) {
      return 'high';
    }

    // Multiple field conflicts
    if (fieldConflicts.length > 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if conflict can be automatically resolved
   */
  private isAutoResolvable(
    tableName: string,
    fieldConflicts: FieldConflict[],
    severity: ConflictSeverity
  ): boolean {
    // Never auto-resolve critical or high severity conflicts
    if (severity === 'critical' || severity === 'high') {
      return false;
    }

    // Auto-resolve if all fields are mergeable
    if (fieldConflicts.every((fc) => fc.is_mergeable)) {
      return true;
    }

    // Auto-resolve simple timestamp conflicts
    if (
      fieldConflicts.length === 1 &&
      fieldConflicts[0].field_name.includes('_at')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Resolve a conflict using the specified strategy
   */
  async resolveConflict(
    request: ResolveConflictRequest
  ): Promise<ResolveConflictResponse> {
    const startTime = Date.now();

    try {
      // Get the conflict
      const { data: conflict, error } = await supabaseAdmin
        .from('sync_conflicts')
        .select('*')
        .eq('id', request.conflict_id)
        .single();

      if (error || !conflict) {
        throw new Error(`Conflict not found: ${request.conflict_id}`);
      }

      // Apply resolution strategy
      const resolvedData = await this.applyResolutionStrategy(
        conflict,
        request.resolution_strategy,
        request.field_resolutions
      );

      // Create resolution metadata
      const resolutionMetadata: ConflictResolutionMetadata = {
        resolved_by: 'user',
        resolution_strategy_used: request.resolution_strategy,
        user_id: conflict.user_id,
        resolution_time_ms: Date.now() - startTime,
        field_resolutions: request.field_resolutions,
      };

      // Update the conflict record
      const { error: updateError } = await supabaseAdmin
        .from('sync_conflicts')
        .update({
          resolved: true,
          resolved_data: resolvedData,
          resolution_metadata: resolutionMetadata,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', request.conflict_id);

      if (updateError) {
        throw updateError;
      }

      // Apply the resolved data to the actual table
      await this.applyResolvedData(
        conflict.table_name,
        conflict.record_id,
        resolvedData
      );

      // Save user preferences if requested
      if (request.save_as_preference) {
        await this.saveUserPreference(
          conflict.user_id,
          conflict.table_name,
          request.resolution_strategy
        );
      }

      return {
        success: true,
        resolved_data: resolvedData,
        resolution_metadata: resolutionMetadata,
      };
    } catch (error) {
      return {
        success: false,
        resolved_data: null,
        resolution_metadata: {
          resolved_by: 'user',
          resolution_strategy_used: request.resolution_strategy,
          resolution_time_ms: Date.now() - startTime,
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Apply the resolution strategy to generate resolved data
   */
  private async applyResolutionStrategy(
    conflict: SyncConflict,
    strategy: ResolutionStrategy,
    fieldResolutions?: FieldResolution[]
  ): Promise<any> {
    switch (strategy) {
      case 'last_write_wins':
        return this.applyLastWriteWins(conflict);

      case 'merge':
      case 'field_merge':
        return this.applyMergeStrategy(conflict, fieldResolutions);

      case 'user_choice':
        return this.applyUserChoice(conflict, fieldResolutions);

      case 'content_aware':
        return this.applyContentAwareStrategy(conflict);

      default:
        throw new Error(`Unsupported resolution strategy: ${strategy}`);
    }
  }

  /**
   * Apply last-write-wins strategy
   */
  private applyLastWriteWins(conflict: SyncConflict): any {
    const localTime = new Date(conflict.local_device_info.timestamp).getTime();
    const remoteTime = new Date(
      conflict.remote_device_info.timestamp
    ).getTime();

    return remoteTime > localTime ? conflict.remote_data : conflict.local_data;
  }

  /**
   * Apply merge strategy
   */
  private applyMergeStrategy(
    conflict: SyncConflict,
    fieldResolutions?: FieldResolution[]
  ): any {
    const result = { ...conflict.local_data };

    if (fieldResolutions) {
      // Use explicit field resolutions
      for (const resolution of fieldResolutions) {
        switch (resolution.chosen_value) {
          case 'local':
            result[resolution.field_name] =
              conflict.local_data[resolution.field_name];
            break;
          case 'remote':
            result[resolution.field_name] =
              conflict.remote_data[resolution.field_name];
            break;
          case 'merged':
            result[resolution.field_name] = this.mergeFieldValues(
              resolution.field_name,
              conflict.local_data[resolution.field_name],
              conflict.remote_data[resolution.field_name]
            );
            break;
          case 'custom':
            result[resolution.field_name] = resolution.custom_value;
            break;
        }
      }
    } else {
      // Auto-merge based on field types
      for (const field of Object.keys(conflict.remote_data)) {
        if (['id', 'created_at', 'user_id'].includes(field)) {
          continue;
        }

        const localValue = conflict.local_data[field];
        const remoteValue = conflict.remote_data[field];

        if (this.isFieldMergeable(field, localValue, remoteValue)) {
          result[field] = this.mergeFieldValues(field, localValue, remoteValue);
        } else {
          // Default to remote value
          result[field] = remoteValue;
        }
      }
    }

    return result;
  }

  /**
   * Merge two field values based on their type and content
   */
  private mergeFieldValues(
    fieldName: string,
    localValue: any,
    remoteValue: any
  ): any {
    // String merging
    if (typeof localValue === 'string' && typeof remoteValue === 'string') {
      if (
        fieldName.includes('note') ||
        fieldName.includes('description') ||
        fieldName.includes('content')
      ) {
        // Merge text content
        return `${localValue}\n\n--- MERGED ---\n\n${remoteValue}`;
      }
      // For other strings, prefer the longer one
      return localValue.length > remoteValue.length ? localValue : remoteValue;
    }

    // Numeric averaging
    if (typeof localValue === 'number' && typeof remoteValue === 'number') {
      if (fieldName.includes('score') || fieldName.includes('rating')) {
        return Math.max(localValue, remoteValue); // Take the higher score
      }
      return (localValue + remoteValue) / 2; // Average other numbers
    }

    // Array merging
    if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
      return [...new Set([...localValue, ...remoteValue])]; // Union of arrays
    }

    // Object merging
    if (
      typeof localValue === 'object' &&
      typeof remoteValue === 'object' &&
      localValue !== null &&
      remoteValue !== null
    ) {
      return { ...localValue, ...remoteValue };
    }

    // Default to remote value
    return remoteValue;
  }

  /**
   * Apply user choice strategy
   */
  private applyUserChoice(
    conflict: SyncConflict,
    fieldResolutions?: FieldResolution[]
  ): any {
    if (!fieldResolutions) {
      throw new Error('Field resolutions required for user choice strategy');
    }

    return this.applyMergeStrategy(conflict, fieldResolutions);
  }

  /**
   * Apply content-aware strategy
   */
  private applyContentAwareStrategy(conflict: SyncConflict): any {
    const result = { ...conflict.local_data };

    for (const field of Object.keys(conflict.remote_data)) {
      if (['id', 'created_at', 'user_id'].includes(field)) {
        continue;
      }

      const rule = this.contentAwareRules.find(
        (r) => r.table_name === conflict.table_name && r.field_name === field
      );

      if (rule) {
        switch (rule.default_strategy) {
          case 'last_write_wins':
            result[field] = this.applyLastWriteWins(conflict)[field];
            break;
          case 'merge':
            result[field] = this.mergeFieldValues(
              field,
              conflict.local_data[field],
              conflict.remote_data[field]
            );
            break;
          case 'user_choice':
            // For content-aware without user input, prefer local
            result[field] = conflict.local_data[field];
            break;
          default:
            result[field] = conflict.remote_data[field];
        }
      } else {
        // Default rule: prefer remote
        result[field] = conflict.remote_data[field];
      }
    }

    return result;
  }

  /**
   * Apply resolved data to the actual database table
   */
  private async applyResolvedData(
    tableName: string,
    recordId: string,
    resolvedData: any
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from(tableName)
      .update(resolvedData)
      .eq('id', recordId);

    if (error) {
      throw new Error(`Failed to apply resolved data: ${error.message}`);
    }
  }

  /**
   * Save user preference for future conflict resolution
   */
  private async saveUserPreference(
    userId: string,
    tableName: string,
    strategy: ResolutionStrategy
  ): Promise<void> {
    const { data: existing } = await supabaseAdmin
      .from('conflict_resolution_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing preferences
      const tablePreferences = {
        ...existing.table_preferences,
        [tableName]: strategy,
      };

      await supabaseAdmin
        .from('conflict_resolution_preferences')
        .update({
          table_preferences: tablePreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Create new preferences
      await supabaseAdmin.from('conflict_resolution_preferences').insert({
        user_id: userId,
        default_strategy: strategy,
        table_preferences: { [tableName]: strategy },
        field_preferences: {},
        auto_resolve_low_severity: true,
        notification_preferences: {
          notify_on_conflict: true,
          notify_on_auto_resolution: false,
          notification_methods: ['in_app'],
          batch_notifications: false,
          batch_interval_minutes: 60,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Preview conflict resolution without applying changes
   */
  async previewConflictResolution(
    request: ConflictPreviewRequest
  ): Promise<ConflictPreviewResponse> {
    try {
      const { data: conflict, error } = await supabaseAdmin
        .from('sync_conflicts')
        .select('*')
        .eq('id', request.conflict_id)
        .single();

      if (error || !conflict) {
        throw new Error(`Conflict not found: ${request.conflict_id}`);
      }

      const previewData = await this.applyResolutionStrategy(
        conflict,
        request.resolution_strategy,
        request.field_resolutions
      );

      const fieldConflicts = this.analyzeFieldConflicts(
        conflict.local_data,
        conflict.remote_data
      );
      const warnings = this.generateResolutionWarnings(
        conflict,
        request.resolution_strategy
      );
      const isSafe = this.isResolutionSafe(
        conflict,
        request.resolution_strategy
      );

      return {
        preview_data: previewData,
        field_conflicts: fieldConflicts,
        warnings,
        is_safe: isSafe,
      };
    } catch (error) {
      throw new Error(
        `Failed to preview conflict resolution: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate warnings for resolution strategy
   */
  private generateResolutionWarnings(
    conflict: SyncConflict,
    strategy: ResolutionStrategy
  ): string[] {
    const warnings: string[] = [];

    if (strategy === 'last_write_wins' && conflict.severity === 'high') {
      warnings.push(
        'Using last-write-wins on high severity conflict may cause data loss'
      );
    }

    if (strategy === 'merge' && conflict.conflicting_fields.includes('id')) {
      warnings.push('Merging ID fields is not recommended');
    }

    if (
      conflict.conflicting_fields.some(
        (field) => field.includes('password') || field.includes('token')
      )
    ) {
      warnings.push(
        'Conflict involves sensitive fields - manual review recommended'
      );
    }

    return warnings;
  }

  /**
   * Check if resolution strategy is safe for the conflict
   */
  private isResolutionSafe(
    conflict: SyncConflict,
    strategy: ResolutionStrategy
  ): boolean {
    // High severity conflicts should use user_choice
    if (conflict.severity === 'high' && strategy !== 'user_choice') {
      return false;
    }

    // Schema conflicts should not be auto-resolved
    if (
      conflict.conflict_type === 'schema_conflict' &&
      strategy !== 'user_choice'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Batch resolve multiple conflicts
   */
  async batchResolveConflicts(
    request: BatchResolveConflictsRequest
  ): Promise<BatchResolveConflictsResponse> {
    const results: Array<{
      conflict_id: string;
      success: boolean;
      error?: string;
    }> = [];
    let resolvedCount = 0;
    let failedCount = 0;

    for (const conflictId of request.conflict_ids) {
      try {
        const resolveRequest: ResolveConflictRequest = {
          conflict_id: conflictId,
          resolution_strategy: request.resolution_strategy,
          save_as_preference: request.save_as_preference,
        };

        const response = await this.resolveConflict(resolveRequest);

        if (response.success) {
          resolvedCount++;
          results.push({ conflict_id: conflictId, success: true });
        } else {
          failedCount++;
          results.push({
            conflict_id: conflictId,
            success: false,
            error: response.errors?.[0] || 'Unknown error',
          });
        }
      } catch (error) {
        failedCount++;
        results.push({
          conflict_id: conflictId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      resolved_count: resolvedCount,
      failed_count: failedCount,
      results,
    };
  }

  /**
   * Get user's conflict resolution preferences
   */
  async getUserPreferences(
    userId: string
  ): Promise<ConflictResolutionPreferences | null> {
    const { data, error } = await supabaseAdmin
      .from('conflict_resolution_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Auto-resolve conflicts based on user preferences and conflict characteristics
   */
  async autoResolveConflicts(userId: string): Promise<number> {
    const preferences = await this.getUserPreferences(userId);

    if (!preferences || !preferences.auto_resolve_low_severity) {
      return 0;
    }

    // Get unresolved conflicts for the user
    const { data: conflicts, error } = await supabaseAdmin
      .from('sync_conflicts')
      .select('*')
      .eq('user_id', userId)
      .eq('resolved', false)
      .eq('auto_resolvable', true)
      .in('severity', ['low']);

    if (error || !conflicts) {
      return 0;
    }

    let resolvedCount = 0;

    for (const conflict of conflicts) {
      try {
        const strategy =
          preferences.table_preferences[conflict.table_name] ||
          preferences.default_strategy;

        await this.resolveConflict({
          conflict_id: conflict.id,
          resolution_strategy: strategy,
        });

        resolvedCount++;
      } catch (error) {
        console.error(`Failed to auto-resolve conflict ${conflict.id}:`, error);
      }
    }

    return resolvedCount;
  }
}
