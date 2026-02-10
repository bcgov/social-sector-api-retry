import { maxFileSizeBytes } from './parameter-constants';

const maxFileSizeError = `Body exceeds max file size of ${maxFileSizeBytes} bytes`;

const bodyNotStringError = `body must be a string`;

const unauthorizedURLError = `Outbound URL is not supported.`;

const invalidMimeTypeError = `The provided MIME type is invalid.`;

const invalidJSONError = `Body must be valid JSON for the application/json content type.`;
const invalidURLEncodedError = `Body must be valid encoded URL for the application/x-www-form-urlencoded content type.`;
const invalidMultipartFormError = `Body must be valid JSON for the multipart/form-data content type.`;

const dbInsertError = `Failed to insert request into database.`;
const dbUpdateError = `Failed to update request in database.`;

const unsupportedChefsFormTypeError = `The submission is from an unsupported form.`;

export {
  maxFileSizeError,
  bodyNotStringError,
  unauthorizedURLError,
  invalidMimeTypeError,
  invalidJSONError,
  invalidURLEncodedError,
  invalidMultipartFormError,
  dbInsertError,
  dbUpdateError,
  unsupportedChefsFormTypeError,
};
