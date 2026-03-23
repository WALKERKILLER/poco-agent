import logging
import re
from pathlib import Path, PureWindowsPath
from typing import Any, Protocol

from app.core.errors.error_codes import ErrorCode
from app.core.errors.exceptions import AppException
from app.core.settings import Settings, get_settings
from app.schemas.filesystem import (
    LocalMountConfig,
    MountFingerprintMaterial,
    MountProviderType,
    MountResolutionResult,
    ResolvedLocalMount,
    build_mount_fingerprint,
)

logger = logging.getLogger(__name__)

_MOUNT_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")
_FORBIDDEN_ROOTS = {
    "/",
    "/bin",
    "/dev",
    "/etc",
    "/Library",
    "/private",
    "/proc",
    "/sbin",
    "/sys",
    "/System",
    "/tmp",
    "/usr",
    "/var",
}
_CLOUD_HELPER_MESSAGES = {
    "not_running": (
        "Cloud local mounts require the local helper to be running before execution."
    ),
    "permission_denied": (
        "Cloud local mounts are blocked because the local helper does not have "
        "permission to expose the selected directories."
    ),
    "bridge_unreachable": (
        "Cloud local mounts are unavailable because the bridge host cannot reach "
        "the local helper."
    ),
}


class MountProvider(Protocol):
    """Provider abstraction for deployment-specific local mount resolution."""

    provider_type: MountProviderType

    def resolve(
        self,
        mounts: list[LocalMountConfig],
        session_id: str | None = None,
    ) -> list[ResolvedLocalMount]:
        """Resolve user-visible local mounts into host/container bind targets."""


class DirectBindMountProvider:
    """Local deployment provider backed by Docker bind mounts."""

    provider_type: MountProviderType = "direct_bind"

    def resolve(
        self,
        mounts: list[LocalMountConfig],
        session_id: str | None = None,
    ) -> list[ResolvedLocalMount]:
        seen_ids: set[str] = set()
        seen_paths: set[str] = set()
        resolved: list[ResolvedLocalMount] = []
        for mount in mounts:
            mount_id = _normalize_mount_id(mount.id)
            if mount_id in seen_ids:
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=f"Duplicate local mount id: {mount_id}",
                )
            seen_ids.add(mount_id)

            normalized_path = _normalize_existing_directory_path(mount.host_path)
            if normalized_path in seen_paths:
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=f"Duplicate local mount path: {normalized_path}",
                )
            seen_paths.add(normalized_path)
            resolved.append(
                ResolvedLocalMount(
                    id=mount_id,
                    name=mount.name.strip(),
                    source_path=normalized_path,
                    container_path=f"/mnt/local/{mount_id}",
                    access_mode=mount.access_mode,
                    provider_type=self.provider_type,
                )
            )

        return resolved


class BridgeLiveMountProvider:
    """Cloud deployment provider placeholder for bridge-mounted user folders."""

    provider_type: MountProviderType = "bridge_live_mount"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def resolve(
        self,
        mounts: list[LocalMountConfig],
        session_id: str | None = None,
    ) -> list[ResolvedLocalMount]:
        if not mounts:
            return []

        if not session_id:
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="Cloud local mounts require a session id for bridge planning",
            )

        helper_status = self._resolve_helper_status()
        if helper_status != "available":
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message=self._helper_status_message(helper_status),
            )

        bridge_root = Path(self.settings.local_mount_bridge_root).resolve(strict=False)
        seen_ids: set[str] = set()
        seen_paths: set[str] = set()
        resolved: list[ResolvedLocalMount] = []
        for mount in mounts:
            mount_id = _normalize_mount_id(mount.id)
            if mount_id in seen_ids:
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=f"Duplicate local mount id: {mount_id}",
                )
            seen_ids.add(mount_id)

            normalized_host_path = _normalize_cloud_host_path(mount.host_path)
            normalized_host_path_key = normalized_host_path.casefold()
            if normalized_host_path_key in seen_paths:
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=f"Duplicate local mount path: {normalized_host_path}",
                )
            seen_paths.add(normalized_host_path_key)

            source_path = (bridge_root / session_id / mount_id).resolve(strict=False)
            source_path_text = str(source_path)
            if not source_path.exists():
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=(
                        "Cloud local mount bridge is ready but the host mount point "
                        f"is missing: {source_path_text}. Start the local helper and "
                        "bridge mount agent, then retry."
                    ),
                )
            if not source_path.is_dir():
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=(
                        "Cloud local mount bridge produced a non-directory mount "
                        f"point: {source_path_text}"
                    ),
                )
            resolved.append(
                ResolvedLocalMount(
                    id=mount_id,
                    name=mount.name.strip(),
                    source_path=source_path_text,
                    container_path=f"/mnt/local/{mount_id}",
                    access_mode=mount.access_mode,
                    provider_type=self.provider_type,
                )
            )

        logger.info(
            "mount_bridge_plan",
            extra={
                "session_id": session_id,
                "bridge_root": str(bridge_root),
                "mount_count": len(resolved),
            },
        )
        return resolved

    def _resolve_helper_status(self) -> str:
        configured_status = self.settings.local_mount_helper_status
        if configured_status is not None:
            return configured_status
        return "bridge_unreachable"

    def _helper_status_message(self, helper_status: str) -> str:
        custom_message = (self.settings.local_mount_helper_message or "").strip()
        if custom_message:
            return custom_message
        return _CLOUD_HELPER_MESSAGES.get(
            helper_status,
            "Cloud local mounts are not available right now.",
        )


class LocalMountService:
    """Resolve local mount config into runtime metadata for the manager."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._providers: dict[str, MountProvider] = {
            "local": DirectBindMountProvider(),
            "cloud": BridgeLiveMountProvider(self.settings),
        }

    def resolve(
        self,
        config: dict[str, Any] | None,
        session_id: str | None = None,
    ) -> MountResolutionResult:
        normalized_config = dict(config or {})
        filesystem_mode = self._normalize_filesystem_mode(
            normalized_config.get("filesystem_mode")
        )
        deployment_mode = self.settings.deployment_mode
        provider = self._providers[deployment_mode]

        mounts = self._parse_local_mounts(normalized_config.get("local_mounts"))
        if filesystem_mode != "local_mount":
            mounts = []

        if filesystem_mode == "local_mount" and not mounts:
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="filesystem_mode=local_mount requires at least one local mount",
            )

        resolved_mounts = provider.resolve(mounts, session_id=session_id)
        fingerprint = build_mount_fingerprint(
            [
                MountFingerprintMaterial(
                    deployment_mode=deployment_mode,
                    provider_type=provider.provider_type,
                    normalized_source_path=mount.source_path,
                    access_mode=mount.access_mode,
                    container_path=mount.container_path,
                )
                for mount in resolved_mounts
            ]
        )
        logger.info(
            "mount_resolve",
            extra={
                "deployment_mode": deployment_mode,
                "provider_type": provider.provider_type,
                "filesystem_mode": filesystem_mode,
                "mount_count": len(resolved_mounts),
            },
        )
        return MountResolutionResult(
            deployment_mode=deployment_mode,
            provider_type=provider.provider_type,
            resolved_mounts=resolved_mounts,
            mount_fingerprint=fingerprint,
        )

    def build_runtime_config(
        self,
        config: dict[str, Any] | None,
        session_id: str | None = None,
    ) -> tuple[dict[str, Any], MountResolutionResult]:
        normalized = dict(config or {})
        resolution = self.resolve(normalized, session_id=session_id)
        filesystem_mode = self._normalize_filesystem_mode(
            normalized.get("filesystem_mode")
        )
        normalized["filesystem_mode"] = filesystem_mode
        normalized["deployment_mode"] = resolution.deployment_mode
        normalized["mount_provider_type"] = resolution.provider_type
        normalized["mount_fingerprint"] = resolution.mount_fingerprint
        normalized["resolved_local_mounts"] = [
            mount.model_dump(mode="json") for mount in resolution.resolved_mounts
        ]
        return normalized, resolution

    @staticmethod
    def _normalize_filesystem_mode(value: Any) -> str:
        return "local_mount" if value == "local_mount" else "sandbox"

    @staticmethod
    def _parse_local_mounts(value: Any) -> list[LocalMountConfig]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise AppException(
                error_code=ErrorCode.BAD_REQUEST,
                message="local_mounts must be a list",
            )
        mounts: list[LocalMountConfig] = []
        for item in value:
            try:
                mounts.append(LocalMountConfig.model_validate(item))
            except Exception as exc:
                raise AppException(
                    error_code=ErrorCode.BAD_REQUEST,
                    message=f"Invalid local_mounts entry: {exc}",
                ) from exc
        return mounts


def _normalize_mount_id(value: str) -> str:
    mount_id = value.strip()
    if not _MOUNT_ID_PATTERN.fullmatch(mount_id):
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=(
                "local_mount id must match [A-Za-z0-9._-] and cannot contain "
                "path separators"
            ),
        )
    return mount_id


def _normalize_existing_directory_path(value: str) -> str:
    raw = value.strip()
    path = Path(raw)
    if not path.is_absolute():
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=f"Local mount path must be absolute: {raw}",
        )

    normalized = path.resolve(strict=False)
    normalized_text = str(normalized)
    if normalized_text in _FORBIDDEN_ROOTS:
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=f"Refusing to mount restricted directory: {normalized_text}",
        )
    if not normalized.exists():
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=f"Local mount path does not exist: {normalized_text}",
        )
    if not normalized.is_dir():
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=f"Local mount path must be a directory: {normalized_text}",
        )
    return normalized_text


def _normalize_cloud_host_path(value: str) -> str:
    raw = value.strip()
    looks_absolute = raw.startswith("/") or PureWindowsPath(raw).is_absolute()
    if not looks_absolute:
        raise AppException(
            error_code=ErrorCode.BAD_REQUEST,
            message=f"Cloud local mount path must be absolute: {raw}",
        )
    return raw
