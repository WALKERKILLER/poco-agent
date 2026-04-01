import logging
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors.error_codes import ErrorCode
from app.core.errors.exceptions import AppException
from app.models.project import Project
from app.repositories.project_file_repository import ProjectFileRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.session_repository import SessionRepository
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.services.storage_service import S3StorageService

_GITHUB_HOSTS = {"github.com", "www.github.com"}
logger = logging.getLogger(__name__)


class ProjectService:
    def __init__(self, storage_service: S3StorageService | None = None) -> None:
        self.storage_service = storage_service

    @staticmethod
    def _normalize_optional_str(value: str | None) -> str | None:
        clean = (value or "").strip()
        return clean or None

    @staticmethod
    def _normalize_github_repo_url(value: str) -> str:
        """Normalize GitHub repo URL to a canonical https://github.com/owner/repo form."""
        parsed = urlparse(value)
        if parsed.scheme not in ("http", "https"):
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="Only http(s) GitHub URLs are supported",
            )
        host = (parsed.netloc or "").strip().lower()
        if host not in _GITHUB_HOSTS:
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="Only github.com URLs are supported",
            )

        path = parsed.path.strip("/")
        parts = [p for p in path.split("/") if p]
        if len(parts) < 2:
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="Invalid GitHub repository URL",
            )

        owner = parts[0].strip()
        repo = parts[1].strip()
        if repo.endswith(".git"):
            repo = repo[: -len(".git")]
        if not owner or not repo:
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="Invalid GitHub repository URL",
            )

        return f"https://github.com/{owner}/{repo}"

    @classmethod
    def _normalize_repo_settings(
        cls,
        *,
        repo_url: str | None,
        git_branch: str | None,
        git_token_env_key: str | None,
    ) -> tuple[str | None, str | None, str | None]:
        url = cls._normalize_optional_str(repo_url)
        if not url:
            return None, None, None

        normalized_url = cls._normalize_github_repo_url(url)
        branch = cls._normalize_optional_str(git_branch) or "main"
        token_key = cls._normalize_optional_str(git_token_env_key)
        return normalized_url, branch, token_key

    @classmethod
    def _normalize_runtime_settings(
        cls,
        *,
        default_model: str | None,
        mount_enabled: bool | None,
        mount_name: str | None,
        mount_path: str | None,
        mount_access_mode: str | None,
    ) -> tuple[str | None, bool, str | None, str | None, str | None]:
        normalized_model = cls._normalize_optional_str(default_model)
        normalized_mount_name = cls._normalize_optional_str(mount_name)
        normalized_mount_path = cls._normalize_optional_str(mount_path)
        normalized_mount_access_mode = cls._normalize_optional_str(mount_access_mode)
        return (
            normalized_model,
            bool(mount_enabled),
            normalized_mount_name,
            normalized_mount_path,
            normalized_mount_access_mode,
        )

    def list_projects(self, db: Session, user_id: str) -> list[ProjectResponse]:
        projects = ProjectRepository.list_by_user(db, user_id)
        return [ProjectResponse.model_validate(p) for p in projects]

    def get_project(
        self, db: Session, user_id: str, project_id: UUID
    ) -> ProjectResponse:
        project = ProjectRepository.get_by_id(db, project_id)
        if not project or project.user_id != user_id:
            raise AppException(
                error_code=ErrorCode.PROJECT_NOT_FOUND,
                message=f"Project not found: {project_id}",
            )
        return ProjectResponse.model_validate(project)

    def create_project(
        self, db: Session, user_id: str, request: ProjectCreateRequest
    ) -> ProjectResponse:
        description = self._normalize_optional_str(request.description)
        (
            default_model,
            mount_enabled,
            mount_name,
            mount_path,
            mount_access_mode,
        ) = self._normalize_runtime_settings(
            default_model=request.default_model,
            mount_enabled=request.mount_enabled,
            mount_name=request.mount_name,
            mount_path=request.mount_path,
            mount_access_mode=request.mount_access_mode,
        )
        repo_url, git_branch, git_token_env_key = self._normalize_repo_settings(
            repo_url=request.repo_url,
            git_branch=request.git_branch,
            git_token_env_key=request.git_token_env_key,
        )
        project = Project(
            user_id=user_id,
            name=request.name,
            description=description,
            default_model=default_model,
            mount_enabled=mount_enabled,
            mount_name=mount_name,
            mount_path=mount_path,
            mount_access_mode=mount_access_mode,
            repo_url=repo_url,
            git_branch=git_branch,
            git_token_env_key=git_token_env_key,
        )
        ProjectRepository.create(db, project)
        db.commit()
        db.refresh(project)
        return ProjectResponse.model_validate(project)

    def update_project(
        self,
        db: Session,
        user_id: str,
        project_id: UUID,
        request: ProjectUpdateRequest,
    ) -> ProjectResponse:
        project = ProjectRepository.get_by_id(db, project_id)
        if not project or project.user_id != user_id:
            raise AppException(
                error_code=ErrorCode.PROJECT_NOT_FOUND,
                message=f"Project not found: {project_id}",
            )

        update = request.model_dump(exclude_unset=True)
        if "name" in update and request.name is not None:
            project.name = request.name
        if "description" in update:
            project.description = self._normalize_optional_str(request.description)
        if "default_model" in update:
            project.default_model = self._normalize_optional_str(request.default_model)
        if "mount_enabled" in update:
            project.mount_enabled = bool(request.mount_enabled)
        if "mount_name" in update:
            project.mount_name = self._normalize_optional_str(request.mount_name)
        if "mount_path" in update:
            project.mount_path = self._normalize_optional_str(request.mount_path)
        if "mount_access_mode" in update:
            project.mount_access_mode = self._normalize_optional_str(
                request.mount_access_mode
            )

        if "repo_url" in update:
            repo_url, git_branch, git_token_env_key = self._normalize_repo_settings(
                repo_url=request.repo_url,
                git_branch=request.git_branch,
                git_token_env_key=request.git_token_env_key,
            )
            project.repo_url = repo_url
            project.git_branch = git_branch
            project.git_token_env_key = git_token_env_key
        else:
            # Only allow updating branch/token when the project already has a repo_url.
            if project.repo_url is None:
                if "git_branch" in update:
                    raise AppException(
                        error_code=ErrorCode.BAD_REQUEST,
                        message="git_branch cannot be set when repo_url is empty",
                    )
                if "git_token_env_key" in update:
                    raise AppException(
                        error_code=ErrorCode.BAD_REQUEST,
                        message="git_token_env_key cannot be set when repo_url is empty",
                    )

            if "git_branch" in update:
                project.git_branch = (
                    self._normalize_optional_str(request.git_branch) or "main"
                )

            if "git_token_env_key" in update:
                project.git_token_env_key = self._normalize_optional_str(
                    request.git_token_env_key
                )

        db.commit()
        db.refresh(project)
        return ProjectResponse.model_validate(project)

    def delete_project(self, db: Session, user_id: str, project_id: UUID) -> None:
        project = ProjectRepository.get_by_id(db, project_id)
        if not project or project.user_id != user_id:
            raise AppException(
                error_code=ErrorCode.PROJECT_NOT_FOUND,
                message=f"Project not found: {project_id}",
            )

        project_files = ProjectFileRepository.list_by_project(db, project_id)
        if project_files:
            storage_service = self.storage_service
            if storage_service is None:
                try:
                    storage_service = S3StorageService()
                except AppException as exc:
                    logger.warning(
                        "Skipping project file cleanup for project %s: %s",
                        project_id,
                        exc.message,
                    )
                    storage_service = None

            if storage_service is not None:
                for project_file in project_files:
                    try:
                        storage_service.delete_object(key=project_file.file_source)
                    except AppException as exc:
                        logger.warning(
                            "Failed to delete project file object %s for project %s: %s",
                            project_file.file_source,
                            project_id,
                            exc.message,
                        )

        project.is_deleted = True
        SessionRepository.clear_project_id(db, project_id)
        db.commit()
