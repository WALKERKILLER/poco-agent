import type { ModelSelection } from "@/features/chat/lib/model-catalog";
import type { LocalMountConfig } from "@/features/chat/types/api/session";
import type { LocalMountDraftRow } from "@/features/task-composer/types/local-filesystem";

function toProjectMountDraftRows(
  mounts: LocalMountConfig[] | null | undefined,
): LocalMountDraftRow[] {
  if (!mounts?.length) {
    return [];
  }

  return mounts.map((mount, index) => ({
    client_id: `mount-${index + 1}`,
    id: mount.id,
    name: mount.name,
    host_path: mount.host_path,
    access_mode: mount.access_mode ?? "ro",
  }));
}

interface RenameProjectDialogStateInput {
  projectName: string;
  projectDescription?: string | null;
  projectDefaultModel?: string | null;
  projectLocalMounts?: LocalMountConfig[] | null;
}

interface RenameProjectDialogState {
  name: string;
  description: string;
  modelSelection: ModelSelection | null;
  filesystemMode: "sandbox" | "local_mount";
  mountRows: LocalMountDraftRow[];
}

export function createRenameProjectDialogState({
  projectName,
  projectDescription,
  projectDefaultModel,
  projectLocalMounts,
}: RenameProjectDialogStateInput): RenameProjectDialogState {
  const modelId = (projectDefaultModel || "").trim();

  return {
    name: projectName,
    description: projectDescription ?? "",
    modelSelection: modelId
      ? {
          modelId,
          providerId: null,
        }
      : null,
    filesystemMode:
      (projectLocalMounts?.length ?? 0) > 0 ? "local_mount" : "sandbox",
    mountRows: toProjectMountDraftRows(projectLocalMounts),
  };
}
