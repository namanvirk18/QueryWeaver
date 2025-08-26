"""
Graphiti integration for QueryWeaver memory component.
Saves summarized conversations with user and database nodes.
"""

import os
from typing import Dict, Any, Optional
from datetime import datetime

# Import Azure OpenAI components
from openai import AsyncAzureOpenAI

# Import Graphiti components
from graphiti_core.driver.falkordb_driver import FalkorDriver
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.llm_client import LLMConfig, OpenAIClient
from graphiti_core.embedder import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.cross_encoder import OpenAIRerankerClient


class AzureOpenAIConfig:
    """Configuration for Azure OpenAI integration."""
    
    def __init__(self):
        # Set the model name as requested
        os.environ["MODEL_NAME"] = "gpt-4.1"
        
        self.api_key = os.getenv('AZURE_API_KEY')
        self.endpoint = os.getenv('AZURE_API_BASE') 
        self.api_version = os.getenv('AZURE_API_VERSION', '2024-02-01')
        self.model_choice = "gpt-4.1"  # Use the model name directly
        self.embedding_model = "text-embedding-ada-002"  # Use model name, not deployment
        self.small_model = os.getenv('AZURE_SMALL_MODEL', 'gpt-4o-mini')
        
        # Use model names directly instead of deployment names
        self.llm_deployment = self.model_choice
        self.small_model_deployment = self.small_model
        self.embedding_deployment = self.embedding_model
        
        # Embedding endpoint (can be same or different from main endpoint)
        self.embedding_endpoint = os.getenv('AZURE_EMBEDDING_ENDPOINT', self.endpoint)


def get_azure_openai_clients():
    """Configure and return Azure OpenAI clients for Graphiti."""
    config = AzureOpenAIConfig()
    
    # Validate required configuration
    if not config.endpoint:
        raise ValueError("AZURE_API_BASE environment variable is required")
    if not config.api_key:
        raise ValueError("AZURE_API_KEY environment variable is required")
    
    # Create separate Azure OpenAI clients for different services
    llm_client_azure = AsyncAzureOpenAI(
        api_key=config.api_key,
        api_version=config.api_version,
        azure_endpoint=config.endpoint,
    )

    embedding_client_azure = AsyncAzureOpenAI(
        api_key=config.api_key,
        api_version=config.api_version,
        azure_endpoint=config.embedding_endpoint,
    )

    return llm_client_azure, embedding_client_azure, config


def create_graphiti_client(falkor_driver: FalkorDriver) -> Graphiti:
    """Create a Graphiti client configured with Azure OpenAI."""
    # Get Azure OpenAI clients and config
    llm_client_azure, embedding_client_azure, config = get_azure_openai_clients()

    # Create LLM Config with Azure deployment names
    azure_llm_config = LLMConfig(
        small_model=config.small_model_deployment,
        model=config.llm_deployment,
    )

    # Initialize Graphiti with Azure OpenAI clients
    return Graphiti(
        graph_driver=falkor_driver,
        llm_client=OpenAIClient(config=azure_llm_config, client=llm_client_azure),
        embedder=OpenAIEmbedder(
            config=OpenAIEmbedderConfig(embedding_model=config.embedding_deployment),
            client=embedding_client_azure,
        ),
        cross_encoder=OpenAIRerankerClient(
            config=LLMConfig(
                model=azure_llm_config.small_model  # Use small model for reranking
            ),
            client=llm_client_azure,
        ),
    )


class GraphitiManager:
    """
    Graphiti manager for saving summarized conversations with user and database nodes.
    """
    
    def __init__(self, falkor_db):
        """Initialize Graphiti manager with FalkorDB."""
        self.falkor_db = falkor_db
    
    def _get_user_graphiti_client(self, user_id: str):
        """Get Graphiti client for specific user with dedicated database and Azure OpenAI."""
        try:
            # Create FalkorDB driver with user-specific database
            user_memory_db = f"{user_id}_memory"
            falkor_driver = FalkorDriver(falkor_db=self.falkor_db, database=user_memory_db)
            
            # Create Graphiti client with Azure OpenAI configuration
            user_graphiti_client = create_graphiti_client(falkor_driver)
            
            print(f"Created Azure OpenAI-configured Graphiti client for user {user_id} with database: {user_memory_db}")
            return user_graphiti_client
            
        except Exception as e:
            print(f"Failed to create Azure OpenAI-configured Graphiti client for {user_id}: {e}")
            return None

    async def save_summarized_conversation(self, graphiti_client, user_id: str, database_name: str, 
                                         database_summary: str, personal_memory: str) -> bool:
        """
        Save summarized conversation to Graphiti with user and database nodes.
        
        Args:
            graphiti_client: Pre-configured Graphiti client from memory manager
            user_id: User identifier
            database_name: Database/graph name
            database_summary: LLM-generated database-specific summary
            personal_memory: LLM-generated personal memory about the user
            
        Returns:
            bool: True if saved successfully
        """
            
        try:
            # Save database-specific summary
            if database_summary:
                await graphiti_client.add_episode(
                    name=f"Database_Summary_{user_id}_{database_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    episode_body=f"User: {user_id}\nDatabase: {database_name}\nConversation: {database_summary}",
                    source=EpisodeType.message,
                    reference_time=datetime.now(),
                    source_description=f"User: {user_id} conversation with the Database: {database_name}"
                )
            
            # Save personal memory
            if personal_memory:
                await graphiti_client.add_episode(
                    name=f"Personal_Memory_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    episode_body=f"User: {user_id}\nPersonal Memory: {personal_memory}",
                    source=EpisodeType.message,
                    reference_time=datetime.now(),
                    source_description=f"Personal memory for user {user_id}"
                )
            
            return True
            
        except Exception as e:
            print(f"Error saving summarized conversation for user {user_id}: {e}")
            return False
    
    async def _ensure_user_node(self, graphiti_client, user_id: str) -> Optional[str]:
        """Ensure user node exists in the memory graph."""
        try:
            await graphiti_client.add_episode(
                name=f'User_Node_{user_id}',
                episode_body=f'User {user_id} is using QueryWeaver',
                source=EpisodeType.text,
                reference_time=datetime.now(),
                source_description='User node creation'
            )
            return user_id
            
        except Exception as e:
            print(f"Error creating user node for {user_id}: {e}")
            return None

    async def _ensure_database_node(self, graphiti_client, database_name: str, user_id: str) -> Optional[str]:
        """Ensure database node exists in the memory graph."""
        try:
            await graphiti_client.add_episode(
                name=f'Database_Node_{database_name}',
                episode_body=f'User {user_id} has database {database_name} available for querying',
                source=EpisodeType.text,
                reference_time=datetime.now(),
                source_description='Database node creation'
            )
            return database_name
            
        except Exception as e:
            print(f"Error creating database node for {database_name}: {e}")
            return None

