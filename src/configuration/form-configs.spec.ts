import {
  getFilterSubjects,
  parseFormConfigs,
  natsSubmissionSubjectPrefix,
} from './form-configs';

describe('form-configs', () => {
  const formOne = {
    formId: 'formOne',
    events: ['created'],
    upstreamUrl: '/endpoint/one',
    requiresApprovalForIngestion: false,
    apiKey: 'apiKeyOne',
    httpMethod: 'PUT',
    workspace: 'workspaceOne',
  };
  const formTwo = {
    formId: 'formTwo',
    events: ['created', 'updated'],
    upstreamUrl: '/endpoint/two',
    requiresApprovalForIngestion: true,
    apiKey: 'apiKeyTwo',
    httpMethod: 'POST',
  };

  describe('parseFormConfigs', () => {
    it('loads form configs keyed by formId', () => {
      const result = parseFormConfigs(JSON.stringify([formOne, formTwo]));
      expect(result).toEqual({ formOne, formTwo });
    });

    it('skips duplicated formIds while loading the remaining forms', () => {
      const duplicate = { ...formOne, apiKey: 'otherApiKey' };
      const result = parseFormConfigs(
        JSON.stringify([formOne, formTwo, duplicate]),
      );
      expect(result).toEqual({ formTwo });
    });

    it('returns no forms when the variable is unset', () => {
      expect(parseFormConfigs(undefined)).toEqual({});
    });

    it('returns no forms on invalid JSON', () => {
      expect(parseFormConfigs('not json')).toEqual({});
    });

    it('returns no forms when the JSON is not an array', () => {
      expect(parseFormConfigs(JSON.stringify(formOne))).toEqual({});
    });
  });

  describe('getFilterSubjects', () => {
    it('builds one subject per configured event per form', () => {
      const result = getFilterSubjects({ formOne, formTwo });
      expect(result).toEqual([
        `${natsSubmissionSubjectPrefix}.created.formOne`,
        `${natsSubmissionSubjectPrefix}.created.formTwo`,
        `${natsSubmissionSubjectPrefix}.updated.formTwo`,
      ]);
    });

    it('returns undefined when no forms are configured', () => {
      expect(getFilterSubjects({})).toBeUndefined();
    });
  });
});
