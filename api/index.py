"""Main entry point for the text2sql API."""

from api.app_factory import create_app

app = create_app()

if __name__ == "__main__":
    import os
    import uvicorn
    
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    uvicorn.run(
        "api.index:app",
        host="127.0.0.1",
        port=5000,
        reload=debug_mode,
        log_level="info" if debug_mode else "warning"
    )
# This allows running the app with `uvicorn api.index:app` or directly with `python api/index.py`
# Ensure the environment variable FLASK_DEBUG is set to 'True' for debug mode
# or 'False' for production mode.
