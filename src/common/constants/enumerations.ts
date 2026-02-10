enum UpstreamType {
  Siebel = 'siebel',
  FormSubmission = 'formSubmission',
}

enum HttpMethod {
  Post = 'POST',
  Patch = 'PATCH',
  Put = 'PUT',
}

enum MessageClass {
  Submission = 'submission',
  Schema = 'schema',
}

enum MessageType {
  Created = 'created',
  Deleted = 'deleted',
  Modified = 'modified',
}

enum FormType {
  Memo = 'memo',
  Invalid = 'invalid',
}

export { UpstreamType, HttpMethod, MessageClass, MessageType, FormType };
