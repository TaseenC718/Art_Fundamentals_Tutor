export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  image?: string; // Base64 string for user uploads
  timestamp: number;
}



export type AppMode = 'practice' | 'progress';

export interface CritiqueRequest {
  image: string; // Base64
  focusArea?: string; // Optional specific question about the art
}