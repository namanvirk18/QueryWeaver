"""
QueryWeaver Memory System

Per-user memory architecture with LLM summarization and Graphiti integration:
- Each user gets their own MemoryManager instance stored in session
- LLM-powered conversation summarization before saving to Graphiti
- Graph-oriented memory storage with user and database nodes

Usage:
    from api.memory import MemoryManager, create_memory_manager
    
    # Create user-specific memory manager
    memory_manager = await create_memory_manager(user_id)
    
    # Switch database context
    await memory_manager.switch_database(graph_id)
    
    # Summarize and save conversation
    await memory_manager.summarize_conversation(conversation, graph_id)
"""

from .memory_manager import MemoryManager, create_memory_manager
from .graphiti_tool import GraphitiManager

__all__ = ["MemoryManager", "create_memory_manager", "GraphitiManager"]