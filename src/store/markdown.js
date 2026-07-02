import { weekToMarkdown } from '@/utils/weekToMarkdown';

/**
 * Render the visible week (plus optionally Someday) as Markdown, using the
 * persisted export options from `settings.markdown_export`. Markdown is a
 * human-readable export only — it is not a restore format.
 */
export function exportMarkdown(weekStartStr, data) {
    const options = data.settings.markdown_export;
    return weekToMarkdown(weekStartStr, data.tasks, options);
}
