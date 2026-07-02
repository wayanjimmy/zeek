import { z } from 'zod';

/**
 * Canonical planner data schema (version 1).
 *
 * All persisted *planner dates* are local calendar strings `YYYY-MM-DD`.
 * `created_at` / `updated_at` are ISO-8601 metadata timestamps (not calendar
 * dates) and are not subject to the YYYY-MM-DD restriction.
 *
 * Field names are snake_case to stay close to the legacy Laravel data and to
 * simplify migration. Do not change field names without bumping schema_version
 * and adding a migration in storage.js.
 */

export const SCHEMA_VERSION = 1;

/** Matches YYYY-MM-DD only. Rejects partial or timestamp strings. */
export const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a local YYYY-MM-DD calendar string');

export const SubtaskV1 = z.object({
    id: z.string().min(1),
    task_id: z.string().min(1),
    title: z.string().max(255),
    completed: z.boolean(),
    position: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const TaskV1 = z.object({
    id: z.string().min(1),
    title: z.string().max(255),
    notes: z.string().nullable(),
    date: dateString.nullable(),
    due_date: dateString.nullable(),
    completed: z.boolean(),
    color: z.string().max(32).nullable(),
    position: z.number().int(),
    // null for dated tasks; 0/1/2 for Someday placement.
    someday_column: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable(),
    recurrence_type: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']),
    recurrence_interval: z.number().int().min(1),
    // 0 = Sunday … 6 = Saturday (matches Carbon dayOfWeek + JS Date.getDay()).
    recurrence_weekdays: z.array(z.number().int().min(0).max(6)).nullable(),
    recurrence_ends_at: dateString.nullable(),
    recurrence_parent_id: z.string().nullable(),
    recurrence_last_generated_at: dateString.nullable(),
    subtasks: z.array(SubtaskV1),
    created_at: z.string(),
    updated_at: z.string(),
});

export const RecurrenceExceptionV1 = z.object({
    parent_task_id: z.string().min(1),
    date: dateString,
    reason: z.literal('deleted'),
    created_at: z.string(),
});

export const MarkdownExportOptionsV1 = z.object({
    include_subtasks: z.boolean(),
    include_someday: z.boolean(),
    include_notes: z.boolean(),
});

export const PlannerDataV1 = z.object({
    schema_version: z.literal(SCHEMA_VERSION),
    created_at: z.string(),
    updated_at: z.string(),
    settings: z.object({
        current_week_start: dateString.nullable(),
        markdown_export: MarkdownExportOptionsV1,
    }),
    tasks: z.array(TaskV1),
    recurrence_exceptions: z.array(RecurrenceExceptionV1),
});

/**
 * Versioned backup envelope. The restore/import path accepts this envelope,
 * a raw PlannerDataV1, or (later) a legacy Laravel export shape.
 */
export const ZeekBackupV1 = z.object({
    kind: z.literal('zeek.planner.backup'),
    backup_version: z.literal(1),
    exported_at: z.string(),
    app_version: z.string().nullable(),
    source: z
        .object({
            type: z.enum(['client', 'legacy-laravel']),
            user_id: z.string().nullable().optional(),
            guest_id: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    data: PlannerDataV1,
});

// ---------------------------------------------------------------------------
// Input schemas for store actions / agent API. These are intentionally more
// permissive than the canonical schema: the store fills in ids, timestamps,
// defaults and derived fields, then validates the resulting document.
// ---------------------------------------------------------------------------

const optionalString = z.string().nullable().optional();

export const CreateTaskInput = z.object({
    title: z.string().trim().min(1).max(255),
    notes: optionalString,
    date: dateString.nullable().optional(),
    due_date: dateString.nullable().optional(),
    color: z.string().max(32).nullable().optional(),
    position: z.number().int().optional(),
    someday_column: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable().optional(),
    recurrence_type: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    recurrence_interval: z.number().int().min(1).optional(),
    recurrence_weekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
    recurrence_ends_at: dateString.nullable().optional(),
});

export const UpdateTaskInput = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    notes: optionalString,
    date: dateString.nullable().optional(),
    due_date: dateString.nullable().optional(),
    completed: z.boolean().optional(),
    color: z.string().max(32).nullable().optional(),
    position: z.number().int().optional(),
    someday_column: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable().optional(),
    recurrence_type: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    recurrence_interval: z.number().int().min(1).optional(),
    recurrence_weekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
    recurrence_ends_at: dateString.nullable().optional(),
});

export const MoveTaskInput = z.object({
    date: dateString.nullable().optional(),
    someday_column: z.union([z.literal(0), z.literal(1), z.literal(2)]).nullable().optional(),
    position: z.number().int().optional(),
});

export const CreateSubtaskInput = z.object({
    title: z.string().trim().min(1).max(255),
    completed: z.boolean().optional(),
    position: z.number().int().optional(),
});

export const UpdateSubtaskInput = z.object({
    title: z.string().trim().min(1).max(255).optional(),
    completed: z.boolean().optional(),
    position: z.number().int().optional(),
});

export const MarkdownExportOptionsInput = MarkdownExportOptionsV1.partial();

/** A YYYY-MM-DD string or null. Used by list() date filters. */
export const dateFilter = dateString.nullable();
