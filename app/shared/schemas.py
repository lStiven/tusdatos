def reject_null(value: object) -> object:
    """Pydantic validator for optional PATCH fields that may be omitted but not cleared."""
    if value is None:
        raise ValueError("may be omitted, but not null")
    return value
