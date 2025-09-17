// Z-API Types and Interfaces

export interface ZapiConfig {
  instanceId: string;
  token: string;
  clientToken?: string; // Optional for additional security validation
  baseUrl: string;
}

export interface ZapiWebhookMessage {
  instanceId: string;
  phone: string;
  fromMe: boolean;
  momment: number;
  status: string;
  chatName: string;
  senderPhoto: string;
  senderName: string;
  participantPhone?: string;
  photo: string;
  broadcast: boolean;
  forwarded: boolean;
  text?: {
    message: string;
  };
  image?: {
    caption: string;
    imageUrl: string;
    thumbnailUrl: string;
    mimeType: string;
  };
  audio?: {
    audioUrl: string;
    mimeType: string;
  };
  video?: {
    caption: string;
    videoUrl: string;
    thumbnailUrl: string;
    mimeType: string;
  };
  document?: {
    documentUrl: string;
    mimeType: string;
    title: string;
    pageCount: number;
    fileName: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address: string;
    url: string;
  };
}

export interface ZapiSendTextRequest {
  phone: string;
  message: string;
}

export interface ZapiSendTextResponse {
  value: boolean;
  message?: string;
}

export interface ZapiInstanceInfo {
  instanceId: string;
  phone: string;
  status: 'open' | 'close' | 'connecting';
  qrcode?: string;
}

export interface ZapiContactInfo {
  phone: string;
  name: string;
  notify: string;
  picture: string;
  isBusiness: boolean;
}

// User session for WhatsApp integration
export interface WhatsAppUserSession {
  phone: string;
  userType?: 'student' | 'coordinator';
  cpf?: string;
  isAuthenticated: boolean;
  currentState: string;
  sessionData: Record<string, any>;
  lastActivity: Date;
}

// Integration with existing chat flow
export interface ZapiChatState {
  phone: string;
  currentState: string;
  data: Record<string, any>;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}