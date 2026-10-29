import inspect

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.main import app
from app.shared.exceptions import AppError


def test_openapi_follows_project_conventions(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    operations = [op for path in spec["paths"].values() for op in path.values()]

    used_tags = {tag for operation in operations for tag in operation["tags"]}
    described_tags = {tag["name"] for tag in spec["tags"] if tag.get("description")}
    assert used_tags == described_tags
    assert "HTTPValidationError" not in spec["components"]["schemas"]


def test_business_errors_are_documented_by_code(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    undocumented = [
        f"{method.upper()} {path} {status}"
        for path, item in spec["paths"].items()
        for method, operation in item.items()
        for status, response in operation["responses"].items()
        if status in {"401", "403", "404", "409"}
        and "examples" not in response.get("content", {}).get("application/json", {})
    ]

    assert undocumented == []


def subclasses(cls: type[AppError]) -> list[type[AppError]]:
    return [
        sub for child in cls.__subclasses__() for sub in (child, *subclasses(child))
    ]


def test_every_error_class_explains_itself() -> None:
    undocumented = [
        error.__qualname__
        for error in subclasses(AppError)
        if not error.__module__.startswith("tests.")
        and not vars(error).get("description")
    ]

    assert undocumented == []


def test_no_endpoint_hides_its_docstring_behind_description() -> None:
    both = [
        route.path
        for route in app.routes
        if isinstance(route, APIRoute)
        and route.endpoint.__doc__
        and route.description != inspect.cleandoc(route.endpoint.__doc__)
    ]

    assert both == []
