export interface StudentRequest {
  id: string;
  studentIdentity: string;
  studentName: string;
  studentLanguage: string; // Language code of student (e.g., 'en', 'es', 'fr')
  type: 'voice' | 'text';
  question?: string; // For text requests (translated for teacher preview)
  originalQuestion?: string; // Original untranslated question from student
  timestamp: number;
  status: 'pending' | 'approved' | 'answered' | 'declined' | 'displayed';
}

export interface RequestMessage {
  type: 'STUDENT_REQUEST' | 'REQUEST_UPDATE' | 'REQUEST_DISPLAY' | 'REQUEST_DISPLAY_MULTILINGUAL';
  payload: any;
}

export interface StudentRequestMessage extends RequestMessage {
  type: 'STUDENT_REQUEST';
  payload: StudentRequest;
}

export interface RequestUpdateMessage extends RequestMessage {
  type: 'REQUEST_UPDATE';
  payload: {
    requestId: string;
    status: 'approved' | 'declined' | 'answered' | 'displayed';
    action?: 'display' | 'hide';
  };
}

export interface RequestDisplayMessage extends RequestMessage {
  type: 'REQUEST_DISPLAY';
  payload: {
    requestId: string;
    question: string;
    studentName: string;
    display: boolean;
  };
}

export interface RequestDisplayMultilingualMessage extends RequestMessage {
  type: 'REQUEST_DISPLAY_MULTILINGUAL';
  payload: {
    requestId: string;
    originalQuestion: string;
    originalLanguage: string;
    translations: { [languageCode: string]: string }; // Map of language code to translated text
    studentName: string;
    display: boolean;
  };
}
