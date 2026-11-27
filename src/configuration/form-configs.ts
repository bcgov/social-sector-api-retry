import { Logger } from '@nestjs/common';

export interface FormConfig {
  formId: string;
  events: Array<string>;
  upstreamUrl: string;
  requiresApprovalForIngestion: boolean;
  apiKey: string;
  httpMethod: string;
  workspace?: string;
}

export const natsSubmissionSubjectPrefix = 'PUBLIC.forms.submission';

const logger = new Logger('FormConfigs');

/**
 * Parses the CHEFS_FORM_CONFIGS environment variable into a map of form
 * configurations keyed by formId. If a formId appears more than once, every
 * entry with that formId is skipped (and an error logged), while the
 * remaining forms continue to load.
 * @param rawFormConfigs the raw CHEFS_FORM_CONFIGS value
 * @returns the loaded form configurations, keyed by formId
 */
export function parseFormConfigs(
  rawFormConfigs: string | undefined,
): Record<string, FormConfig> {
  if (rawFormConfigs === undefined || rawFormConfigs.trim() === '') {
    return {};
  }
  let entries: unknown;
  try {
    entries = JSON.parse(rawFormConfigs);
  } catch (error) {
    logger.error('CHEFS_FORM_CONFIGS is not valid JSON, no forms loaded');
    logger.error(error);
    return {};
  }
  if (!Array.isArray(entries)) {
    logger.error('CHEFS_FORM_CONFIGS must be a JSON array, no forms loaded');
    return {};
  }

  const formIdCounts = new Map<string, number>();
  for (const entry of entries as Array<FormConfig>) {
    formIdCounts.set(entry.formId, (formIdCounts.get(entry.formId) ?? 0) + 1);
  }
  for (const [formId, count] of formIdCounts) {
    if (count > 1) {
      logger.error(
        `Duplicate formId '${formId}' found ${count} times in CHEFS_FORM_CONFIGS, skipping this form`,
      );
    }
  }

  const formConfigs: Record<string, FormConfig> = {};
  for (const entry of entries as Array<FormConfig>) {
    if (formIdCounts.get(entry.formId) > 1) {
      continue;
    }
    formConfigs[entry.formId] = entry;
  }
  return formConfigs;
}

/**
 * Builds the NATS filter subjects from the loaded form configurations, one
 * subject per configured event per form, in the format:
 * PUBLIC.forms.submission.<event>.<formId>
 * @param formConfigs the loaded form configurations, keyed by formId
 * @returns the filter subjects, or undefined if there are none
 */
export function getFilterSubjects(
  formConfigs: Record<string, FormConfig>,
): Array<string> | undefined {
  const filterSubjects = Object.values(formConfigs).flatMap((formConfig) =>
    (formConfig.events ?? []).map(
      (event) => `${natsSubmissionSubjectPrefix}.${event}.${formConfig.formId}`,
    ),
  );
  return filterSubjects.length > 0 ? filterSubjects : undefined;
}
