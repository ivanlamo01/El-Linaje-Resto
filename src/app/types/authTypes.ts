import type { User } from "firebase/auth";

export interface AuthContextType {
  login: boolean;
  handleLogout: () => void;
  user: User | null; 
}

export interface Usuario {
  id: string;
  isAdmin?: boolean;
  userId: string;
  nombre: string;
  email: string;
  tasks?: { id: string; description: string; deadline: string }[];
}
