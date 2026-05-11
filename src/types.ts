export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'sys';

export interface Message {
  id: string;
  type: MessageType;
  text?: string;
  data?: string;
  fileName?: string;
  fileSize?: number;
  sender: 'me' | 'peer' | 'sys';
  time: number;
}

export interface Contact {
  id: string;
  name: string;
  isOnline: boolean;
  unread: number;
  messages: Message[];
}
