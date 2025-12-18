export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
  githubToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: 'ADMIN' | 'USER';
  githubToken?: string;
}

export interface UsersResponse {
  users: User[];
}
