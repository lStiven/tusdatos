from fastapi.testclient import TestClient


def test_openapi_follows_project_conventions(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    operations = [op for path in spec["paths"].values() for op in path.values()]

    used_tags = {tag for operation in operations for tag in operation["tags"]}
    described_tags = {tag["name"] for tag in spec["tags"] if tag.get("description")}
    assert used_tags == described_tags
    assert "HTTPValidationError" not in spec["components"]["schemas"]
