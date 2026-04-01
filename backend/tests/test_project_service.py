from datetime import UTC, datetime
import unittest
import uuid
from unittest.mock import MagicMock, patch

from app.models.project import Project
from app.schemas.project import ProjectCreateRequest, ProjectUpdateRequest
from app.services.project_service import ProjectService


class ProjectServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ProjectService()
        self.db = MagicMock()
        self.user_id = "user-1"
        self.now = datetime.now(UTC)

    @patch("app.services.project_service.ProjectRepository.create")
    def test_create_project_persists_runtime_settings(
        self,
        create: MagicMock,
    ) -> None:
        created_project: Project | None = None

        def capture_create(_db: MagicMock, project: Project) -> Project:
            nonlocal created_project
            created_project = project
            project.id = uuid.uuid4()
            project.created_at = self.now
            project.updated_at = self.now
            return project

        create.side_effect = capture_create
        self.db.refresh.side_effect = lambda _: None

        result = self.service.create_project(
            self.db,
            self.user_id,
            ProjectCreateRequest(
                name="Demo",
                description="  Project description  ",
                default_model="  claude-sonnet-4-20250514  ",
                mount_enabled=True,
                mount_name="  Demo workspace  ",
                mount_path="  /workspace/demo  ",
                mount_access_mode="rw",
            ),
        )

        self.assertIsNotNone(created_project)
        assert created_project is not None
        self.assertEqual(created_project.description, "Project description")
        self.assertEqual(created_project.default_model, "claude-sonnet-4-20250514")
        self.assertTrue(created_project.mount_enabled)
        self.assertEqual(created_project.mount_name, "Demo workspace")
        self.assertEqual(created_project.mount_path, "/workspace/demo")
        self.assertEqual(created_project.mount_access_mode, "rw")
        self.db.commit.assert_called_once()
        self.assertEqual(result.default_model, "claude-sonnet-4-20250514")
        self.assertTrue(result.mount_enabled)
        self.assertEqual(result.mount_name, "Demo workspace")
        self.assertEqual(result.mount_path, "/workspace/demo")
        self.assertEqual(result.mount_access_mode, "rw")

    @patch("app.services.project_service.ProjectRepository.get_by_id")
    def test_update_project_updates_runtime_settings_independently(
        self,
        get_by_id: MagicMock,
    ) -> None:
        project = Project(
            id=uuid.uuid4(),
            user_id=self.user_id,
            name="Demo",
            description=None,
            default_model=None,
            mount_enabled=False,
            mount_name=None,
            mount_path=None,
            mount_access_mode=None,
            repo_url=None,
            git_branch=None,
            git_token_env_key=None,
            is_deleted=False,
            created_at=self.now,
            updated_at=self.now,
        )
        get_by_id.return_value = project
        self.db.refresh.side_effect = lambda _: None

        result = self.service.update_project(
            self.db,
            self.user_id,
            project.id,
            ProjectUpdateRequest(
                default_model="  claude-opus-4-1  ",
                mount_enabled=True,
                mount_name="  Next workspace  ",
                mount_path="  /workspace/next  ",
                mount_access_mode="ro",
            ),
        )

        self.assertEqual(project.default_model, "claude-opus-4-1")
        self.assertTrue(project.mount_enabled)
        self.assertEqual(project.mount_name, "Next workspace")
        self.assertEqual(project.mount_path, "/workspace/next")
        self.assertEqual(project.mount_access_mode, "ro")
        self.db.commit.assert_called_once()
        self.assertEqual(result.default_model, "claude-opus-4-1")
        self.assertTrue(result.mount_enabled)
        self.assertEqual(result.mount_name, "Next workspace")
        self.assertEqual(result.mount_path, "/workspace/next")
        self.assertEqual(result.mount_access_mode, "ro")


if __name__ == "__main__":
    unittest.main()
