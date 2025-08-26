"""
QueryWeaver Memory Manager

Clean, focused memory manager that coordinates user memories and uses LLM for summarization.
Each user gets their own memory graph via Graphiti and FalkorDB.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import Request
import json

# LLM imports for summarization
from litellm import completion

from api.extensions import db
from api.config import Config
from .graphiti_tool import GraphitiManager


class MemoryManager:
    """
    Clean memory manager per user that uses LLM for summarization.
    Delegates actual memory operations to graphiti_tool.py.
    """
    
    def __init__(self, user_id: str):
        """Initialize the memory manager for a specific user (sync part only)."""
        # Set the graphiti client with FalkorDB connection
        self.graphiti_manager = GraphitiManager(db)
        self.graphiti_client = None
        self.user_id = user_id
        self.current_database = None
        self.config = Config()
        
    @classmethod
    async def create(cls, user_id: str):
        """Create and initialize a memory manager for a specific user."""
        instance = cls(user_id)
        await instance._initialize_user_node()
        return instance
        
    async def _initialize_user_node(self):
        """Initialize user node for this memory manager's user."""
        try:
            # Get client for this user
            self.graphiti_client = self.graphiti_manager._get_user_graphiti_client(self.user_id)

            if self.graphiti_client:
                # Ensure user node exists
                await self.graphiti_manager._ensure_user_node(self.graphiti_client, self.user_id)
                print(f"Initialized memory manager for user {self.user_id}")
            else:
                print(f"Failed to get Graphiti client for user {self.user_id}")
                
        except Exception as e:
            print(f"Failed to initialize user node for {self.user_id}: {e}")
        
    async def switch_database(self, database_name: str) -> bool:
        """
        Switch to a different database context and ensure database node exists.
        
        Args:
            database_name: The database name to switch to
            
        Returns:
            bool: True if switch was successful
        """
        try:
            self.current_database = database_name

            # Ensure database node exists when switching to this database
            await self.graphiti_manager._ensure_database_node(self.graphiti_client, database_name, self.user_id)

        except Exception as e:
            print(f"Failed to switch to database {database_name}: {e}")
            return False
    
    async def summarize_conversation(self, conversation: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Use LLM to summarize the conversation and extract insights oriented to current database.
        
        Args:
            conversation: List of user/system exchanges
            
        Returns:
            Dict with 'database_summary' and 'personal_memory' keys
        """
        # Format conversation for summarization
        conv_text = ""
        for exchange in conversation:
            conv_text += f"User: {exchange.get('question', '')}\n"
            if exchange.get('sql'):
                conv_text += f"SQL: {exchange['sql']}\n"
            if exchange.get('answer'):
                conv_text += f"Assistant: {exchange['answer']}\n"
            conv_text += "\n"
        
        prompt = f"""
                Analyze this QueryWeaver conversation between user "{self.user_id}" and database "{self.current_database}".
                Your task is to extract two complementary types of memory:

                1. Database-Specific Summary: What the user accomplished and their preferences with this specific database.
                2. Personal Memory: General information about the user (name, preferences, personal details) that is not specific to this database.

                Conversation:
                {conv_text}

                Format your response as JSON:
                {{
                    "database_summary": "Summarize in natural language what the user was trying to accomplish with this database, highlighting the approaches, techniques, queries, or SQL patterns that worked well, noting errors or problematic patterns to avoid, listing the most important or effective queries executed, and sharing key learnings or insights about the database’s structure, data, and optimal usage patterns.",
                    "personal_memory": "Summarize any personal information about the user, including their name if mentioned, their general preferences and working style, their SQL or database expertise level, recurring query patterns or tendencies across all databases, and any other personal details that are not specific to a particular database, making sure not to include any database-specific memories."
                }}

                Instructions:
                - Only include fields that have actual information from the conversation.
                - Use empty strings for fields with no information.
                - Do not invent any information that is not present in the conversation.
                """

        
        try:
            response = completion(
                model=self.config.COMPLETION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            
            # Parse JSON response
            content = response.choices[0].message.content
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            
            result = json.loads(content)
            return {
                "database_summary": result.get("database_summary", ""),
                "personal_memory": result.get("personal_memory", "")
            }
            
        except Exception as e:
            print(f"Error in LLM summarization: {e}")
            return {
                "database_summary": "",
                "personal_memory": ""
            }
    
    async def save_user_conversation(self, conversation: List[Dict[str, Any]]) -> bool:
        """
        Save a conversation for this user with LLM-generated summary and insights.
        
        Args:
            conversation: List of exchanges
            
        Returns:
            bool: True if saved successfully
        """
        
        # Use LLM to analyze and summarize the conversation with current database context
        analysis = await self.summarize_conversation(conversation)
        
        # Extract summaries
        database_summary = analysis.get("database_summary", "")
        personal_memory = analysis.get("personal_memory", "")
        
        # Save to Graphiti with pre-configured client
        return await self.graphiti_manager.save_summarized_conversation(
            self.graphiti_client,
            self.user_id, 
            self.current_database,
            database_summary,
            personal_memory
        )

# Factory function to create user-specific memory managers
async def create_memory_manager(user_id: str) -> MemoryManager:
    """Get a memory manager instance for a specific user."""
    return await MemoryManager.create(user_id)
