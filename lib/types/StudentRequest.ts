export interface StudentRequest {
  id: string;
  studentIdentity: string;
  studentName: string;
  type: 'voice' | 'text';
  question?: string; // For text requests
  timestamp: number;
  status: 'pending' | 'approved' | 'answered' | 'declined' | 'displayed';
}

export interface RequestMessage {
  type: 'STUDENT_REQUEST' | 'REQUEST_UPDATE' | 'REQUEST_DISPLAY';
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