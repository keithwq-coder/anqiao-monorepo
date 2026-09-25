import sqlalchemy as sa

from crm.persistence import Base


EXPECTED_TABLES = {
    "audit_events",
    "contacts",
    "erasure_records",
    "follow_up_activities",
    "follow_up_activity_revisions",
    "import_batches",
    "import_row_results",
    "institution_owner_history",
    "institutions",
    "operation_records",
    "opportunity_candidates",
    "role_grants",
    "server_sessions",
    "user_identities",
}


def unique_column_sets(table_name: str) -> set[tuple[str, ...]]:
    table = Base.metadata.tables[table_name]
    return {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, sa.UniqueConstraint)
    }


def test_metadata_contains_only_the_s2_tables() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_all_postgresql_identifiers_fit_the_server_limit() -> None:
    named_items = [
        item
        for table in Base.metadata.tables.values()
        for item in (*table.constraints, *table.indexes)
        if item.name is not None
    ]

    assert named_items
    assert all(len(item.name.encode("utf-8")) <= 63 for item in named_items)


def test_submission_idempotency_is_enforced_by_unique_constraints() -> None:
    assert ("created_by_user_id", "idempotency_key") in unique_column_sets("institutions")
    assert ("created_by_user_id", "idempotency_key") in unique_column_sets("contacts")
    assert ("recorded_by_user_id", "idempotency_key") in unique_column_sets(
        "follow_up_activities"
    )


def test_activity_history_index_has_the_approved_deterministic_order() -> None:
    history_index = next(
        index
        for index in Base.metadata.tables["follow_up_activities"].indexes
        if index.name == "ix_follow_up_activities_history"
    )

    assert [str(expression) for expression in history_index.expressions] == [
        "follow_up_activities.institution_id",
        "occurred_at DESC",
        "recorded_at DESC",
        "id DESC",
    ]


def test_foreign_keys_restrict_implicit_deletion() -> None:
    foreign_keys = [
        constraint
        for table in Base.metadata.tables.values()
        for constraint in table.foreign_key_constraints
    ]

    assert foreign_keys
    assert all(constraint.ondelete == "RESTRICT" for constraint in foreign_keys)


def test_server_sessions_store_hashes_instead_of_raw_tokens() -> None:
    columns = Base.metadata.tables["server_sessions"].columns

    assert "session_token_hash" in columns
    assert "csrf_token_hash" in columns
    assert "session_token" not in columns
    assert "csrf_token" not in columns


def test_user_identities_has_optional_phone_column() -> None:
    columns = Base.metadata.tables["user_identities"].columns

    assert "phone" in columns
    assert columns["phone"].nullable is True


def test_role_grants_check_constraint_rejects_agent_role() -> None:
    table = Base.metadata.tables["role_grants"]
    role_checks = [
        str(constraint.sqltext)
        for constraint in table.constraints
        if isinstance(constraint, sa.CheckConstraint) and "role IN" in str(constraint.sqltext)
    ]

    assert role_checks
    assert all("agent" not in text for text in role_checks)
