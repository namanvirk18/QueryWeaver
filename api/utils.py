"""Utility functions for the text2sql API."""

from typing import List

from litellm import completion

from api.config import Config


def generate_db_description(
    db_name: str,
    table_names: List[str],
    temperature: float = 0.5,
    max_tokens: int = 150,
) -> str:
    """
    Generates a short and concise description of a database.

    Args:
    - database_name (str): The name of the database.
    - table_names (list): A list of table names within the database.
    - temperature (float): Sampling temperature. Higher values mean more creativity (default: 0.5).
    - max_tokens (int): The maximum number of tokens to generate in the response (default: 150).

    Returns:
    - str: A description of the database.
    """
    if not isinstance(db_name, str):
        raise TypeError("database_name must be a string.")

    if not isinstance(table_names, list):
        raise TypeError("table_names must be a list of strings.")

    # Ensure all table names are strings
    if not all(isinstance(table, str) for table in table_names):
        raise ValueError("All items in table_names must be strings.")

    if not table_names:
        return f"{db_name} is a database with no tables."

    # Format the table names appropriately
    if len(table_names) == 1:
        tables_formatted = table_names[0]
    elif len(table_names) == 2:
        tables_formatted = " and ".join(table_names)
    else:
        tables_formatted = ", ".join(table_names[:-1]) + f", and {table_names[-1]}"

    prompt = (
        f"You are a helpful assistant. Generate a concise description of "
        f"the database named '{db_name}' which contains the following tables: "
        f"{tables_formatted}.\n\nDescription:"
    )

    response = completion(
        model=Config.COMPLETION_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        n=1,
        stop=None,
    )
    description = response.choices[0].message["content"]
    return description
