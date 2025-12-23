export interface Application {
  id: string;
  name: string;
  publisher: string;
  githubRepoName: string;
  logoBase64?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationFormData {
  name: string;
  publisher: string;
  githubRepoName: string;
}

export interface ApplicationsResponse {
  applications: Application[];
}
