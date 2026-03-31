import { apiClient, API_ENDPOINTS } from "@/services/api-client";
import type { ProjectFile } from "@/features/projects/types";

interface ProjectFileApiResponse {
  project_file_id: number;
  project_id: string;
  file_name: string;
  file_source: string;
  file_size?: number | null;
  file_content_type?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

function mapProjectFile(file: ProjectFileApiResponse): ProjectFile {
  return {
    id: file.project_file_id,
    projectId: file.project_id,
    fileName: file.file_name,
    fileSource: file.file_source,
    fileSize: file.file_size ?? null,
    fileContentType: file.file_content_type ?? null,
    sortOrder: file.sort_order,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
}

export const projectFilesService = {
  list: async (
    projectId: string,
    options?: { revalidate?: number },
  ): Promise<ProjectFile[]> => {
    const files = await apiClient.get<ProjectFileApiResponse[]>(
      API_ENDPOINTS.projectFiles(projectId),
      {
        next: { revalidate: options?.revalidate },
      },
    );
    return files.map(mapProjectFile);
  },

  add: async (
    projectId: string,
    payload: {
      file_name: string;
      file_source: string;
      file_size?: number | null;
      file_content_type?: string | null;
    },
  ): Promise<ProjectFile> => {
    const file = await apiClient.post<ProjectFileApiResponse>(
      API_ENDPOINTS.projectFiles(projectId),
      payload,
    );
    return mapProjectFile(file);
  },

  remove: async (projectId: string, fileId: number): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.projectFile(projectId, fileId));
  },
};
