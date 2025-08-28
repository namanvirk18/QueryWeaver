"""Follow-up agent for generating helpful questions when queries fail or are off-topic."""

from litellm import completion
from api.config import Config
from .utils import BaseAgent


FOLLOW_UP_GENERATION_PROMPT = """
You are a helpful database expert. A colleague asked a question, but their query can’t run correctly.

Context:
- Question: "{QUESTION}"
- Translatability: {IS_TRANSLATABLE}
- Missing info: {MISSING_INFO}
- Ambiguities: {AMBIGUITIES}
- Analysis: {EXPLANATION}

Your task:
- Write a **very short response (max 2 sentences, under 40 words total)**.
- Sentence 1: Acknowledge warmly and show willingness to help, without being technical.
- Sentence 2: Ask for the specific missing information in natural, conversational language.
- **If the query uses "I", "my", or "me" → always ask who they are (name, employee ID, or username).**
- Use warm, natural wording like “I need to know who you are” instead of “provide your ID.”
- Keep the tone friendly, encouraging, and solution-focused — like a helpful colleague, not a system.

Example responses (personal queries):
- "I'd love to help find your employees! What's your name or employee ID so I can look up who reports to you?"
- "Happy to help with your data! Who should I look up — what's your username or employee ID?"
- "I can definitely help! Could you tell me your name or ID so I know which records are yours?"
"""


class FollowUpAgent(BaseAgent):
    """Agent for generating helpful follow-up questions when queries fail or are off-topic."""

    def _format_schema(self, schema_data: list) -> str:
        """
        Format the schema data into a readable format for the prompt.

        Args:
            schema_data: Schema in the structure [table_name, table_description, foreign_keys, columns]

        Returns:
            Formatted schema as a string
        """
        if not schema_data:
            return "No relevant tables found"
            
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

    def generate_follow_up_question(
        self, 
        user_question: str,
        analysis_result: dict,
        found_tables: list = None
    ) -> str:
        """
        Generate helpful follow-up questions based on failed SQL translation.
        
        Args:
            user_question: The original user question
            analysis_result: Output from analysis agent 
            schema_info: Database schema information
            found_tables: Tables found by the find function
            
        Returns:
            str: Conversational follow-up response
        """
        
        # Extract key information from analysis result
        is_translatable = analysis_result.get("is_sql_translatable", False) if analysis_result else False
        missing_info = analysis_result.get("missing_information", []) if analysis_result else []
        ambiguities = analysis_result.get("ambiguities", []) if analysis_result else []
        explanation = analysis_result.get("explanation", "No detailed explanation available") if analysis_result else "No analysis result available"
        
        # Format found tables using the same formatting as analysis agent
        formatted_tables = self._format_schema(found_tables) if found_tables else "No relevant tables found"
        
        # Prepare the prompt
        prompt = FOLLOW_UP_GENERATION_PROMPT.format(
            QUESTION=user_question,
            IS_TRANSLATABLE=is_translatable,
            MISSING_INFO=missing_info,
            AMBIGUITIES=ambiguities,
            FOUND_TABLES=formatted_tables,
            EXPLANATION=explanation
        )
        
        try:
            completion_result = completion(
                model=Config.COMPLETION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=1.1
            )
            
            response = completion_result.choices[0].message.content.strip()
            return response
            
        except Exception as e:
            # Fallback response if LLM call fails
            return "I'm having trouble generating a follow-up question right now. Could you try rephrasing your question or providing more specific details about what you're looking for?"
