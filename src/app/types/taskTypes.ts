export interface Task {
  id: string;
  description: string;
  deadline: string;
  userId: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  importance: 'low' | 'medium' | 'high';
  createdAt: any;
  createdBy: string;
  deadline?: any;
}
