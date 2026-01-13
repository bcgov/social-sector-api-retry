const CONTENT_TYPE = 'application/json';
const urlMax = 32767; // max for a 16-bit signed integer, most urls are much shorter
const maxFileSizeBytes = 5242880; // 5MiB
const emailMax = 300;
const idirMax = 100;
const nameMax = 150;

export { CONTENT_TYPE, urlMax, maxFileSizeBytes, emailMax, idirMax, nameMax };
