#!/usr/bin/env python3
"""Test script to verify the refactored _format_schema produces identical output."""

# Test data
test_schema_data = [
    [
        "users",
        "User information table", 
        {"fk_dept": {"column": "dept_id", "referenced_table": "departments", "referenced_column": "id"}},
        [
            {"columnName": "id", "dataType": "int", "description": "User ID", "keyType": "PRI", "nullable": False},
            {"columnName": "name", "dataType": "varchar", "description": "User name", "keyType": None, "nullable": False},
            {"columnName": "dept_id", "dataType": "int", "description": "Department ID", "keyType": "FK", "nullable": True}
        ]
    ]
]

# Original method (simplified)
def original_format_schema(schema_data):
    formatted_schema = []
    
    for table_info in schema_data:
        table_name = table_info[0]
        table_description = table_info[1]
        foreign_keys = table_info[2]
        columns = table_info[3]

        # Format table header
        table_str = f"Table: {table_name} - {table_description}\n"

        # Format columns using the updated OrderedDict structure
        for column in columns:
            col_name = column.get("columnName", "")
            col_type = column.get("dataType", None)
            col_description = column.get("description", "")
            col_key = column.get("keyType", None)
            nullable = column.get("nullable", False)

            key_info = (
                ", PRIMARY KEY"
                if col_key == "PRI"
                else ", FOREIGN KEY" if col_key == "FK" else ""
            )
            column_str = (f"  - {col_name} ({col_type},{key_info},{col_key},"
                         f"{nullable}): {col_description}")
            table_str += column_str + "\n"

        # Format foreign keys
        if isinstance(foreign_keys, dict) and foreign_keys:
            table_str += "  Foreign Keys:\n"
            for fk_name, fk_info in foreign_keys.items():
                column = fk_info.get("column", "")
                ref_table = fk_info.get("referenced_table", "")
                ref_column = fk_info.get("referenced_column", "")
                table_str += (
                    f"  - {fk_name}: {column} references {ref_table}.{ref_column}\n"
                )

        formatted_schema.append(table_str)

    return "\n".join(formatted_schema)

# Test the current implementation
import sys
sys.path.append('/Users/naseemali/Documents/GitHub/QueryWeaver')
from api.agents.analysis_agent import AnalysisAgent

agent = AnalysisAgent([], [])  # Empty queries and result history
new_output = agent._format_schema(test_schema_data)
original_output = original_format_schema(test_schema_data)

print("=== ORIGINAL OUTPUT ===")
print(repr(original_output))
print("\n=== NEW OUTPUT ===")
print(repr(new_output))
print(f"\n=== OUTPUTS IDENTICAL: {original_output == new_output} ===")

if original_output != new_output:
    print("\n=== DIFFERENCES ===")
    orig_lines = original_output.split('\n')
    new_lines = new_output.split('\n')
    for i, (orig, new) in enumerate(zip(orig_lines, new_lines)):
        if orig != new:
            print(f"Line {i}: '{orig}' != '{new}'")
