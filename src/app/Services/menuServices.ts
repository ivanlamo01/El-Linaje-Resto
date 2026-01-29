import { db } from "../config/firebase";
import { collection, getDocs } from "firebase/firestore";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
}

export const getMenu = async (): Promise<MenuItem[]> => {
  // Placeholder implementation
  return [];
};
