import { maxFileSizeBytes } from './parameter-constants';

const maxFileSizeError = `Body exceeds max file size of ${maxFileSizeBytes} bytes`;

const unauthorizedURLError = `Outbound URL is not supported.`;

const invalidMimeTypeError = `The provided MIME type is invalid.`;

const invalidJSONError = `Body must be valid JSON for the application/json content type.`;
const invalidURLEncodedError = `Body must be valid encoded URL for the application/x-www-form-urlencoded content type.`;
const invalidMultipartFormError = `Body must be valid JSON for the multipart/form-data content type.`;

const invalidJWTError = `JWT is invalid or doesn't contain needed information.`;

const dbInsertError = `Failed to insert request into database.`;

export {
  maxFileSizeError,
  unauthorizedURLError,
  invalidMimeTypeError,
  invalidJSONError,
  invalidURLEncodedError,
  invalidMultipartFormError,
  invalidJWTError,
  dbInsertError,
};
