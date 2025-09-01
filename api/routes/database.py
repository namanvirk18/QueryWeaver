"""Database connection routes for the text2sql API."""

import logging
import json
import time
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.auth.user_management import token_required
from api.loaders.postgres_loader import PostgresLoader
from api.loaders.mysql_loader import MySQLLoader

database_router = APIRouter()

# Use the same delimiter as in the JavaScript frontend for streaming chunks
MESSAGE_DELIMITER = "|||FALKORDB_MESSAGE_BOUNDARY|||"

class DatabaseConnectionRequest(BaseModel):
    """Database connection request model.

    Args:
        BaseModel (_type_): _description_
    """

    url: str
    type: Optional[str] = None

@database_router.post("/database", operation_id="connect_database")
@token_required
async def connect_database(request: Request, db_request: DatabaseConnectionRequest):
    """
    Accepts a JSON payload with a database URL and attempts to connect.
    Supports both PostgreSQL and MySQL databases.
    Streams progress steps as a sequence of JSON messages separated by MESSAGE_DELIMITER.
    """
    url = db_request.url
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")

    # Validate URL format
    if not isinstance(url, str) or len(url.strip()) == 0:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    async def generate():
        overall_start = time.perf_counter()
        steps_counter = 0
        try:
            # Step 1: Start
            steps_counter += 1
            yield json.dumps(
                {
                    "type": "reasoning_step",
                    "message": f"Step {steps_counter}: Starting database connection",
                }
            ) + MESSAGE_DELIMITER

            # Step 2: Determine type
            db_type = None
            if url.startswith("postgres://") or url.startswith("postgresql://"):
                db_type = "postgresql"
                loader = PostgresLoader
            elif url.startswith("mysql://"):
                db_type = "mysql"
                loader = MySQLLoader
            else:
                yield json.dumps(
                    {"type": "error", "message": "Invalid database URL format"}
                ) + MESSAGE_DELIMITER
                return

            steps_counter += 1
            yield json.dumps(
                {
                    "type": "reasoning_step",
                    "message": f"Step {steps_counter}: Detected database type: {db_type}. "
                                "Attempting to load schema...",
                }
            ) + MESSAGE_DELIMITER

            # Step 3: Attempt to load schema using the loader
            success, result = [False, ""]
            try:
                load_start = time.perf_counter()
                async for progress in loader.load(request.state.user_id, url):
                    success, result = progress
                    if success:
                        steps_counter += 1
                        yield json.dumps(
                            {
                                "type": "reasoning_step",
                                "message": f"Step {steps_counter}: {result}",
                            }
                        ) + MESSAGE_DELIMITER
                    else:
                        break

                load_elapsed = time.perf_counter() - load_start
                logging.info(
                    "Database load attempt finished in %.2f seconds", load_elapsed
                )

                if success:
                    yield json.dumps(
                        {
                            "type": "final_result",
                            "success": True,
                            "message": "Database connected and schema loaded successfully",
                        }
                    ) + MESSAGE_DELIMITER
                else:
                    # Don't stream the full internal result; give higher-level error
                    logging.error("Database loader failed: %s", str(result))
                    yield json.dumps(
                        {"type": "error", "message": "Failed to load database schema"}
                    ) + MESSAGE_DELIMITER
            except Exception as e:
                logging.exception("Error while loading database schema: %s", str(e))
                yield json.dumps(
                    {"type": "error", "message": "Error connecting to database"}
                ) + MESSAGE_DELIMITER

        except Exception as e:
            logging.exception("Unexpected error in connect_database stream: %s", str(e))
            yield json.dumps(
                {"type": "error", "message": "Internal server error"}
            ) + MESSAGE_DELIMITER
        finally:
            overall_elapsed = time.perf_counter() - overall_start
            logging.info(
                "connect_database processing completed - Total time: %.2f seconds",
                overall_elapsed,
            )

    return StreamingResponse(generate(), media_type="application/json")
