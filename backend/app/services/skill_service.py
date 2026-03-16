import mimetypes
import re
from pathlib import PurePosixPath
from typing import Any

from sqlalchemy.orm import Session

from app.core.errors.error_codes import ErrorCode
from app.core.errors.exceptions import AppException
from app.models.skill import Skill
from app.repositories.skill_repository import SkillRepository
from app.schemas.source import SourceInfo
from app.schemas.skill import (
    SkillCreateRequest,
    SkillResponse,
    SkillUpdateRequest,
)
from app.schemas.workspace import FileNode
from app.services.storage_service import S3StorageService
from app.services.source_utils import infer_capability_source
from app.utils.workspace import build_workspace_file_nodes
from app.utils.workspace_manifest import (
    build_nodes_from_file_entries,
    normalize_manifest_path,
)


_SKILL_NAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


def _validate_skill_name(name: str) -> str:
    value = (name or "").strip()
    if not value or value in {".", ".."} or not _SKILL_NAME_PATTERN.fullmatch(value):
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=f"Invalid skill name: {name}",
        )
    return value


class SkillService:
    def __init__(self, storage_service: S3StorageService | None = None) -> None:
        self.storage_service = storage_service

    def list_skills(self, db: Session, user_id: str) -> list[SkillResponse]:
        skills = SkillRepository.list_visible(db, user_id=user_id)
        return [self._to_response(s) for s in skills]

    def get_skill(self, db: Session, user_id: str, skill_id: int) -> SkillResponse:
        skill = self._get_visible_skill(db, user_id, skill_id)
        return self._to_response(skill)

    def list_skill_files(
        self,
        db: Session,
        user_id: str,
        skill_id: int,
    ) -> list[FileNode]:
        skill = self._get_visible_skill(db, user_id, skill_id)
        entry = skill.entry if isinstance(skill.entry, dict) else {}
        raw_key = entry.get("s3_key")
        if not isinstance(raw_key, str) or not raw_key.strip():
            return []

        s3_key = raw_key.strip()
        if self._is_prefix_entry(entry, s3_key):
            return self._build_file_nodes_from_prefix(s3_key)
        return self._build_file_nodes_from_object(s3_key)

    def create_skill(
        self, db: Session, user_id: str, request: SkillCreateRequest
    ) -> SkillResponse:
        name = _validate_skill_name(request.name)
        scope = (request.scope or "user").strip() or "user"

        if SkillRepository.get_by_name(db, name, user_id):
            raise AppException(
                error_code=ErrorCode.SKILL_ALREADY_EXISTS,
                message=f"Skill already exists: {name}",
            )

        skill = Skill(
            name=name,
            description=request.description.strip() or None
            if request.description is not None
            else None,
            scope=scope,
            owner_user_id=user_id,
            entry=request.entry or {},
            source={"kind": "manual"},
        )

        SkillRepository.create(db, skill)
        db.commit()
        db.refresh(skill)
        return self._to_response(skill)

    def update_skill(
        self,
        db: Session,
        user_id: str,
        skill_id: int,
        request: SkillUpdateRequest,
    ) -> SkillResponse:
        skill = SkillRepository.get_by_id(db, skill_id)
        if not skill:
            raise AppException(
                error_code=ErrorCode.SKILL_NOT_FOUND,
                message=f"Skill not found: {skill_id}",
            )
        if skill.scope == "system":
            raise AppException(
                error_code=ErrorCode.SKILL_MODIFY_FORBIDDEN,
                message="Cannot modify system skills",
            )
        if skill.owner_user_id != user_id:
            raise AppException(
                error_code=ErrorCode.FORBIDDEN,
                message="Skill does not belong to the user",
            )

        if (
            request.name is not None
            and request.name.strip()
            and request.name != skill.name
        ):
            new_name = _validate_skill_name(request.name)
            if SkillRepository.get_by_name(db, new_name, user_id):
                raise AppException(
                    error_code=ErrorCode.SKILL_ALREADY_EXISTS,
                    message=f"Skill already exists: {new_name}",
                )
            skill.name = new_name

        if request.scope is not None and request.scope.strip():
            skill.scope = request.scope.strip()
        if request.description is not None:
            skill.description = request.description.strip() or None
        if request.entry is not None:
            skill.entry = request.entry

        db.commit()
        db.refresh(skill)
        return self._to_response(skill)

    def delete_skill(self, db: Session, user_id: str, skill_id: int) -> None:
        skill = SkillRepository.get_by_id(db, skill_id)
        if not skill:
            raise AppException(
                error_code=ErrorCode.SKILL_NOT_FOUND,
                message=f"Skill not found: {skill_id}",
            )
        if skill.scope == "system":
            raise AppException(
                error_code=ErrorCode.SKILL_MODIFY_FORBIDDEN,
                message="Cannot delete system skills",
            )
        if skill.owner_user_id != user_id:
            raise AppException(
                error_code=ErrorCode.FORBIDDEN,
                message="Skill does not belong to the user",
            )

        SkillRepository.delete(db, skill)
        db.commit()

    @staticmethod
    def _get_visible_skill(db: Session, user_id: str, skill_id: int) -> Skill:
        skill = SkillRepository.get_by_id(db, skill_id)
        if not skill or (skill.scope != "system" and skill.owner_user_id != user_id):
            raise AppException(
                error_code=ErrorCode.SKILL_NOT_FOUND,
                message=f"Skill not found: {skill_id}",
            )
        return skill

    @staticmethod
    def _is_prefix_entry(entry: dict[str, Any], s3_key: str) -> bool:
        raw_is_prefix = entry.get("is_prefix")
        if isinstance(raw_is_prefix, bool):
            return raw_is_prefix
        if isinstance(raw_is_prefix, str):
            return raw_is_prefix.strip().lower() in {"1", "true", "yes", "on"}
        return s3_key.endswith("/")

    def _build_file_nodes_from_prefix(self, prefix: str) -> list[FileNode]:
        normalized_prefix = prefix.strip().rstrip("/")
        if not normalized_prefix:
            return []

        storage_service = self._storage_service()
        prefix_with_slash = f"{normalized_prefix}/"
        file_entries: list[dict[str, Any]] = []
        file_url_map: dict[str, str] = {}

        for object_key in storage_service.list_objects(prefix_with_slash):
            if object_key.endswith("/"):
                continue
            relative_path = object_key[len(prefix_with_slash) :].lstrip("/")
            normalized_path = normalize_manifest_path(relative_path)
            if not normalized_path:
                continue

            mime_type, _ = mimetypes.guess_type(relative_path)
            file_entries.append(
                {
                    "path": normalized_path,
                    "key": object_key,
                    "mimeType": mime_type,
                }
            )
            file_url_map[normalized_path] = storage_service.presign_get(
                object_key,
                response_content_disposition="inline",
                response_content_type=mime_type,
            )

        if not file_entries:
            return []

        raw_nodes = build_nodes_from_file_entries(file_entries)
        return build_workspace_file_nodes(
            raw_nodes,
            file_url_builder=lambda file_path: file_url_map.get(
                normalize_manifest_path(file_path) or file_path
            ),
        )

    def _build_file_nodes_from_object(self, key: str) -> list[FileNode]:
        storage_service = self._storage_service()
        if not storage_service.exists(key):
            return []

        filename = PurePosixPath(key).name
        normalized_path = normalize_manifest_path(filename)
        if not normalized_path:
            return []

        mime_type, _ = mimetypes.guess_type(filename)
        raw_nodes = build_nodes_from_file_entries(
            [
                {
                    "path": normalized_path,
                    "key": key,
                    "mimeType": mime_type,
                }
            ]
        )
        file_url_map = {
            normalized_path: storage_service.presign_get(
                key,
                response_content_disposition="inline",
                response_content_type=mime_type,
            )
        }
        return build_workspace_file_nodes(
            raw_nodes,
            file_url_builder=lambda file_path: file_url_map.get(
                normalize_manifest_path(file_path) or file_path
            ),
        )

    def _storage_service(self) -> S3StorageService:
        if self.storage_service is None:
            self.storage_service = S3StorageService()
        return self.storage_service

    @staticmethod
    def _to_response(skill: Skill) -> SkillResponse:
        source_dict = infer_capability_source(
            scope=skill.scope,
            source=getattr(skill, "source", None),
            entry=skill.entry,
        )
        return SkillResponse(
            id=skill.id,
            name=skill.name,
            description=skill.description,
            entry=skill.entry,
            source=SourceInfo.model_validate(source_dict),
            scope=skill.scope,
            owner_user_id=skill.owner_user_id,
            created_at=skill.created_at,
            updated_at=skill.updated_at,
        )
