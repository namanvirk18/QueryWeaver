"""Authentication routes for the text2sql API."""

import hashlib
import hmac
import logging
import os
import re
import time
from pathlib import Path
from urllib.parse import urljoin

import httpx
from authlib.common.errors import AuthlibBaseError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from starlette.config import Config
from pydantic import BaseModel

from api.auth.user_management import validate_and_cache_user, ensure_user_in_organizations
from api.extensions import db

# Router
auth_router = APIRouter()
TEMPLATES_DIR = str((Path(__file__).resolve().parents[1] / "../app/templates").resolve())
templates = Jinja2Templates(directory=TEMPLATES_DIR)

GOOGLE_AUTH = bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))
GITHUB_AUTH = bool(os.getenv("GITHUB_CLIENT_ID") and os.getenv("GITHUB_CLIENT_SECRET"))
EMAIL_AUTH = bool(os.getenv("EMAIL_AUTH_ENABLED", "").lower() in ["true", "1", "yes", "on"])

# ---- Authentication Configuration Helpers ----
def _is_email_auth_enabled() -> bool:
    """Check if email authentication is enabled via environment variable."""
    return EMAIL_AUTH

def _is_google_auth_enabled() -> bool:
    """Check if Google OAuth is enabled via environment variables."""
    return GOOGLE_AUTH

def _is_github_auth_enabled() -> bool:
    """Check if GitHub OAuth is enabled via environment variables."""
    return GITHUB_AUTH

def _get_auth_config() -> dict:
    """Get authentication configuration for templates."""
    return {
        "email_auth_enabled": _is_email_auth_enabled(),
        "google_auth_enabled": _is_google_auth_enabled(),
        "github_auth_enabled": _is_github_auth_enabled(),
    }

# Data models for email authentication
class EmailLoginRequest(BaseModel):
    """_summary_

    Args:
        BaseModel (_type_): _description_
    """
    email: str
    password: str

class EmailSignupRequest(BaseModel):
    """_summary_

    Args:
        BaseModel (_type_): _description_
    """
    firstName: str
    lastName: str
    email: str
    password: str

# ---- Password utilities ----
def _hash_password(password: str) -> str:
    """Hash a password using PBKDF2 with a random salt."""
    salt = os.urandom(32)
    password_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return (salt + password_hash).hex()

def _verify_password(password: str, stored_password_hex: str) -> bool:
    """Verify a password against its hash using constant-time comparison."""
    try:
        stored_password = bytes.fromhex(stored_password_hex)
        salt = stored_password[:32]
        stored_hash = stored_password[32:]

        password_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)

        return hmac.compare_digest(password_hash, stored_hash)
    except (ValueError, TypeError):
        return False

def _sanitize_for_log(value: str) -> str:
    """Sanitize user input for logging by removing newlines and carriage returns."""
    if not isinstance(value, str):
        return str(value)
    return value.replace('\r\n', '').replace('\n', '').replace('\r', '')

def _validate_email(email: str) -> bool:
    """Basic email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def _create_email_user(first_name: str, last_name: str, email: str, password_hash: str):
    """Create a new email user in the database."""
    try:
        organizations_graph = db.select_graph("Organizations")

        # Sanitize inputs for logging
        safe_email = _sanitize_for_log(email)
        safe_first_name = _sanitize_for_log(first_name)
        safe_last_name = _sanitize_for_log(last_name)
        name = f"{safe_first_name} {safe_last_name}"

        # Check if user already exists
        check_query = """
        MATCH (i:Identity {provider: 'email', email: $email})
        RETURN i
        """
        result = organizations_graph.query(check_query, {"email": email})

        if result.result_set:
            return False, "User already exists"

        # Create new email identity and user
        create_query = """
        CREATE (i:Identity {
            provider_user_id: $email,
            provider: 'email',
            email: $email,
            password_hash: $password_hash,
            created_at: timestamp()
        })
        CREATE (u:User {
            name: $name,
            email: $email,
            picture: '',
            created_at: timestamp()
        })
        CREATE (i)-[:BELONGS_TO]->(u)
        RETURN i, u
        """

        result = organizations_graph.query(create_query, {
            "email": email,
            "password_hash": password_hash,
            "name": name
        })

        if result.result_set:
            identity = result.result_set[0][0]
            user = result.result_set[0][1]
            logging.info("NEW EMAIL USER CREATED: email=%s, name=%s", safe_email, name)
            return True, {"identity": identity, "user": user}
        else:
            logging.error("Failed to create email user: %s", safe_email)
            return False, "Failed to create user"

    except Exception as e:
        logging.error("Error creating email user: %s", e)
        return False, "Internal error"

def _authenticate_email_user(email: str, password: str):
    """Authenticate an email user."""
    try:
        organizations_graph = db.select_graph("Organizations")

        # Find user by email
        query = """
        MATCH (i:Identity {provider: 'email', email: $email})-[:BELONGS_TO]->(u:User)
        RETURN i, u
        """

        result = organizations_graph.query(query, {"email": email})

        if not result.result_set:
            return False, "Invalid email or password"

        identity = result.result_set[0][0]
        user = result.result_set[0][1]

        # Verify password - access Node properties correctly
        stored_password_hash = identity.properties.get('password_hash')
        if not stored_password_hash or not _verify_password(password, stored_password_hash):
            return False, "Invalid email or password"

        # Update last login
        update_query = """
        MATCH (i:Identity {provider: 'email', email: $email})
        SET i.last_login = timestamp()
        """
        organizations_graph.query(update_query, {"email": email})

        logging.info("EMAIL USER AUTHENTICATED: email=%r", _sanitize_for_log(email))
        return True, {"identity": identity, "user": user}

    except Exception as e:
        logging.error("Error authenticating email user: %s", e)
        return False, "Internal error"

# ---- Email Authentication Routes ----
@auth_router.post("/email-signup")
async def email_signup(request: Request, signup_data: EmailSignupRequest) -> JSONResponse:
    """Handle email/password user registration."""
    try:
        # Check if email authentication is enabled
        if os.getenv("EMAIL_AUTH_ENABLED", "").lower() not in ["true", "1", "yes", "on"]:
            return JSONResponse(
                {"success": False, "error": "Email authentication is not enabled"},
                status_code=status.HTTP_403_FORBIDDEN
            )

        # Validate required fields
        if not all([signup_data.firstName, signup_data.lastName, 
                    signup_data.email, signup_data.password]):
            return JSONResponse(
                {"success": False, "error": "All fields are required"},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        first_name = signup_data.firstName.strip()
        last_name = signup_data.lastName.strip()
        email = signup_data.email.strip().lower()
        password = signup_data.password

        # Validate email format
        if not _validate_email(email):
            return JSONResponse(
                {"success": False, "error": "Invalid email format"},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Validate password strength
        if len(password) < 8:
            return JSONResponse(
                {"success": False, "error": "Password must be at least 8 characters long"},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Hash password
        password_hash = _hash_password(password)

        # Create user
        success, result = _create_email_user(first_name, last_name, email, password_hash)

        if not success:
            return JSONResponse(
                {"success": False, "error": result}, 
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Create organization association
        ensure_user_in_organizations(email, email, f"{first_name} {last_name}", "email")

        logging.info("User registration successful: %s", _sanitize_for_log(email))
        return JSONResponse({"success": True, "message": "User created successfully"})

    except Exception as e:
        logging.error("Signup error: %s", e)
        return JSONResponse(
            {"success": False, "error": "Registration failed"}, 
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@auth_router.post("/email-login")
async def email_login(request: Request, login_data: EmailLoginRequest) -> JSONResponse:
    """Handle email/password user login."""
    try:
        # Check if email authentication is enabled
        if os.getenv("EMAIL_AUTH_ENABLED", "").lower() not in ["true", "1", "yes", "on"]:
            return JSONResponse(
                {"success": False, "error": "Email authentication is not enabled"},
                status_code=status.HTTP_403_FORBIDDEN
            )

        # Validate required fields
        if not login_data.email or not login_data.password:
            return JSONResponse(
                {"success": False, "error": "Email and password are required"},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        email = login_data.email.strip().lower()
        password = login_data.password

        # Validate email format
        if not _validate_email(email):
            return JSONResponse(
                {"success": False, "error": "Invalid email format"},
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # Authenticate user
        success, result = _authenticate_email_user(email, password)

        if not success:
            return JSONResponse(
                {"success": False, "error": result}, 
                status_code=status.HTTP_401_UNAUTHORIZED
            )

        # Set session data - result is a dict when success is True
        if isinstance(result, dict):
            user_node = result.get("user")
            identity_node = result.get("identity")

            # Access node properties correctly
            user_props = user_node.properties if user_node and hasattr(user_node, 'properties') else {}
            identity_props = identity_node.properties if identity_node and hasattr(identity_node, 'properties') else {}

            request.session["user_info"] = {
                "id": identity_props.get("provider_user_id", email),
                "name": user_props.get("name", ""),
                "email": user_props.get("email", email),
                "picture": user_props.get("picture", ""),
                "provider": "email",
            }
            request.session["email_authenticated"] = True
            request.session["token_validated_at"] = time.time()

            return JSONResponse({"success": True, "message": "Login successful"})
        else:
            return JSONResponse(
                {"success": False, "error": "Authentication failed"},
                status_code=status.HTTP_401_UNAUTHORIZED
            )

    except Exception as e:
        logging.error("Login error: %s", e)
        return JSONResponse(
            {"success": False, "error": "Login failed"}, 
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ---- Helpers ----
def _get_provider_client(request: Request, provider: str):
    """Get an OAuth provider client from app.state.oauth"""
    oauth = getattr(request.app.state, "oauth", None)
    if not oauth:
        raise HTTPException(status_code=500, detail="OAuth not configured")

    client = getattr(oauth, provider, None)
    if not client:
        raise HTTPException(status_code=500, detail=f"OAuth provider {provider} not configured")
    return client

def _clear_auth_session(session: dict):
    """Remove only auth-related keys from session instead of clearing everything."""
    for key in [
        "user_info",
        "google_token",
        "github_token",
        "token_validated_at",
        "oauth_google_auth",
    ]:
        session.pop(key, None)

@auth_router.get("/chat", name="auth.chat", response_class=HTMLResponse)
async def chat(request: Request) -> HTMLResponse:
    """Explicit chat route (renders main chat UI)."""
    user_info, is_authenticated = await validate_and_cache_user(request)
    auth_config = _get_auth_config()
    return templates.TemplateResponse(
        "chat.j2",
        {
            "request": request,
            "is_authenticated": is_authenticated,
            "user_info": user_info,
            **auth_config,
        },
    )

def _build_callback_url(request: Request, path: str) -> str:
    """Build absolute callback URL, honoring OAUTH_BASE_URL if provided."""
    base_override = os.getenv("OAUTH_BASE_URL")
    base = base_override if base_override else str(request.base_url)
    if not base.endswith("/"):
        base += "/"
    return urljoin(base, path.lstrip("/"))

# ---- Routes ----
@auth_router.get("/", response_class=HTMLResponse)
async def home(request: Request) -> HTMLResponse:
    """Home route - render chat if authenticated, else landing page."""
    user_info, is_authenticated_flag = await validate_and_cache_user(request)
    auth_config = _get_auth_config()

    if not is_authenticated_flag:
        _clear_auth_session(request.session)

    if not is_authenticated_flag:
        return templates.TemplateResponse(
            "landing.j2", 
            {
                "request": request, 
                "is_authenticated": False, 
                "user_info": None,
                **auth_config,
            }
        )

    return templates.TemplateResponse(
        "chat.j2",
        {
            "request": request,
            "is_authenticated": is_authenticated_flag,
            "user_info": user_info,
            **auth_config,
        },
    )


@auth_router.get("/login/google", name="google.login", response_class=RedirectResponse)
async def login_google(request: Request) -> RedirectResponse:
    """Handle Google OAuth login redirect."""
    # Check if Google auth is enabled
    if not _is_google_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google authentication is not configured"
        )

    google = _get_provider_client(request, "google")
    redirect_uri = _build_callback_url(request, "login/google/authorized")

    # Helpful hint if localhost vs 127.0.0.1 mismatch is likely
    if not os.getenv("OAUTH_BASE_URL") and "127.0.0.1" in str(request.base_url):
        logging.warning(
            "OAUTH_BASE_URL not set and base URL is 127.0.0.1; "
            "if your Google OAuth app uses 'http://localhost:5000', "
            "set OAUTH_BASE_URL=http://localhost:5000 to avoid redirect_uri mismatch."
        )

    return await google.authorize_redirect(request, redirect_uri)


@auth_router.get("/login/google/authorized", response_class=RedirectResponse)
async def google_authorized(request: Request) -> RedirectResponse:
    """Handle Google OAuth2 authorization callback."""
    # Check if Google auth is enabled
    if not _is_google_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google authentication is not configured"
        )
    try:
        google = _get_provider_client(request, "google")
        token = await google.authorize_access_token(request)

        # Always fetch userinfo explicitly
        resp = await google.get("https://www.googleapis.com/oauth2/v2/userinfo", token=token)
        if resp.status_code != 200:
            logging.error("Failed to fetch Google user info: %s", resp.text)
            _clear_auth_session(request.session)
            return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

        user_info = resp.json()
        if not user_info.get("email"):
            logging.error("Invalid Google user data received")
            _clear_auth_session(request.session)
            return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

        # Normalize
        request.session["user_info"] = {
            "id": str(user_info.get("id") or user_info.get("sub")),
            "name": user_info.get("name", ""),
            "email": user_info.get("email"),
            "picture": user_info.get("picture", ""),
            "provider": "google",
        }
        request.session["google_token"] = token
        request.session["token_validated_at"] = time.time()

        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

    except AuthlibBaseError as e:
        logging.error("Google OAuth error: %s", e)
        _clear_auth_session(request.session)
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


@auth_router.get("/login/google/callback", response_class=RedirectResponse)
async def google_callback_compat(request: Request) -> RedirectResponse:
    qs = f"?{request.url.query}" if request.url.query else ""
    redirect = f"/login/google/authorized{qs}"
    return RedirectResponse(url=redirect, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@auth_router.get("/login/github",  name="github.login", response_class=RedirectResponse)
async def login_github(request: Request) -> RedirectResponse:
    """Handle GitHub OAuth login redirect."""
    # Check if GitHub auth is enabled
    if not _is_github_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="GitHub authentication is not configured"
        )

    github = _get_provider_client(request, "github")
    redirect_uri = _build_callback_url(request, "login/github/authorized")

    # Helpful hint if localhost vs 127.0.0.1 mismatch is likely
    if not os.getenv("OAUTH_BASE_URL") and "127.0.0.1" in str(request.base_url):
        logging.warning(
            "OAUTH_BASE_URL not set and base URL is 127.0.0.1; "
            "if your GitHub OAuth app uses 'http://localhost:5000', "
            "set OAUTH_BASE_URL=http://localhost:5000 to avoid redirect_uri mismatch."
        )

    return await github.authorize_redirect(request, redirect_uri)


@auth_router.get("/login/github/authorized", response_class=RedirectResponse)
async def github_authorized(request: Request) -> RedirectResponse:
    """Handle GitHub OAuth authorization callback."""
    # Check if GitHub auth is enabled
    if not _is_github_auth_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="GitHub authentication is not configured"
        )
    try:
        github = _get_provider_client(request, "github")
        token = await github.authorize_access_token(request)

        # Fetch GitHub user info
        resp = await github.get("https://api.github.com/user", token=token)
        if resp.status_code != 200:
            logging.error("Failed to fetch GitHub user info: %s", resp.text)
            _clear_auth_session(request.session)
            return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

        user_info = resp.json()

        # Get user email if not public
        email = user_info.get("email")
        if not email:
            # Try to get primary email from emails endpoint
            email_resp = await github.get("https://api.github.com/user/emails", token=token)
            if email_resp.status_code == 200:
                emails = email_resp.json()
                for email_obj in emails:
                    if email_obj.get("primary"):
                        email = email_obj.get("email")
                        break

        if not user_info.get("id") or not email:
            logging.error("Invalid GitHub user data received")
            _clear_auth_session(request.session)
            return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

        # Normalize user info structure
        request.session["user_info"] = {
            "id": str(user_info.get("id")),
            "name": user_info.get("name") or user_info.get("login", ""),
            "email": email,
            "picture": user_info.get("avatar_url", ""),
            "provider": "github",
        }
        request.session["github_token"] = token
        request.session["token_validated_at"] = time.time()

        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

    except AuthlibBaseError as e:
        logging.error("GitHub OAuth error: %s", e)
        _clear_auth_session(request.session)
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


@auth_router.get("/login/github/callback", response_class=RedirectResponse)
async def github_callback_compat(request: Request) -> RedirectResponse:
    qs = f"?{request.url.query}" if request.url.query else ""
    redirect = f"/login/github/authorized{qs}"
    return RedirectResponse(url=redirect, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@auth_router.get("/logout", response_class=RedirectResponse)
async def logout(request: Request) -> RedirectResponse:
    """Handle user logout and revoke tokens for Google (actively) and GitHub (locally)."""
    google_token = request.session.get("google_token")
    github_token = request.session.get("github_token")

    # ---- Revoke Google tokens ----
    if google_token:
        tokens_to_revoke = []
        if access_token := google_token.get("access_token"):
            tokens_to_revoke.append(access_token)
        if refresh_token := google_token.get("refresh_token"):
            tokens_to_revoke.append(refresh_token)

        if tokens_to_revoke:
            try:
                async with httpx.AsyncClient() as client:
                    for token in tokens_to_revoke:
                        resp = await client.post(
                            "https://oauth2.googleapis.com/revoke",
                            params={"token": token},
                            headers={"content-type": "application/x-www-form-urlencoded"},
                        )
                        if resp.status_code != 200:
                            logging.warning(
                                "Google token revoke failed (%s): %s",
                                resp.status_code,
                                resp.text,
                            )
                        else:
                            logging.info("Successfully revoked Google token")
            except Exception as e:
                logging.error("Error revoking Google tokens: %s", e)

    # ---- Handle GitHub tokens ----
    if github_token:
        logging.info("GitHub token found, clearing from session (no remote revoke available).")
        # GitHub logout is local only unless we call the App management API

    # ---- Clear session auth keys ----
    for key in ["user_info", "google_token", "github_token", "token_validated_at"]:
        request.session.pop(key, None)

    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)

# ---- Hook for app factory ----
def init_auth(app):
    """Initialize OAuth and sessions for the app."""
    config = Config(".env")
    oauth = OAuth(config)

    # Only register Google OAuth if credentials are available
    if _is_google_auth_enabled():
        oauth.register(
            name="google",
            client_id=os.getenv("GOOGLE_CLIENT_ID"),
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
        logging.info("Google OAuth initialized successfully")
    else:
        logging.info("Google OAuth not configured - skipping registration")

    # Only register GitHub OAuth if credentials are available
    if _is_github_auth_enabled():
        oauth.register(
            name="github",
            client_id=os.getenv("GITHUB_CLIENT_ID"),
            client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
            access_token_url="https://github.com/login/oauth/access_token",
            authorize_url="https://github.com/login/oauth/authorize",
            api_base_url="https://api.github.com/",
            client_kwargs={"scope": "user:email"},
        )
        logging.info("GitHub OAuth initialized successfully")
    else:
        logging.info("GitHub OAuth not configured - skipping registration")

    app.state.oauth = oauth
