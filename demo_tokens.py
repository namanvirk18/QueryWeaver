#!/usr/bin/env python3
"""
Demo script showing how the token authentication system works.

This script demonstrates:
1. Token generation and storage
2. Token validation
3. API authentication with tokens

Note: This is for demonstration purposes only.
In a real scenario, you would authenticate first via OAuth,
then generate tokens through the UI.
"""

import hashlib
import secrets
import time
from api.routes.tokens import _generate_secure_token, _hash_token


def demo_token_operations():
    """Demonstrate token operations"""
    print("🔐 QueryWeaver Token Management Demo")
    print("=" * 50)
    
    # 1. Generate a secure token
    print("\n1. Generating a secure token...")
    token = _generate_secure_token()
    print(f"   ✅ Generated token: {token}")
    print(f"   📏 Token length: {len(token)} characters")
    
    # 2. Hash the token (what gets stored in the database)
    print("\n2. Hashing token for secure storage...")
    token_hash = _hash_token(token)
    print(f"   🔒 Token hash: {token_hash}")
    print(f"   📝 Hash length: {len(token_hash)} characters")
    
    # 3. Show last 4 digits (what users see in the UI)
    last_4_digits = token[-4:]
    print(f"\n3. Token display in UI:")
    print(f"   👁️  Visible to user: ****{last_4_digits}")
    
    # 4. Simulate token storage structure
    print(f"\n4. Database storage structure:")
    token_data = {
        "token_id": secrets.token_urlsafe(16),
        "token_hash": token_hash,
        "created_at": int(time.time()),
        "last_4_digits": last_4_digits
    }
    print(f"   💾 Token data: {token_data}")
    
    # 5. Show how API authentication would work
    print(f"\n5. API Authentication example:")
    print(f"   📡 HTTP Header: Authorization: Bearer {token}")
    print(f"   🔍 Server validates by hashing received token")
    print(f"   ✅ Hash match = authenticated")
    
    # 6. Security features
    print(f"\n6. Security features:")
    print(f"   🛡️  Tokens are cryptographically secure")
    print(f"   🔐 Only hashed tokens stored in database")
    print(f"   👀 Users only see last 4 digits after generation")
    print(f"   🗑️  Users can delete tokens anytime")
    print(f"   📊 Multiple tokens per user supported")
    
    print(f"\n" + "=" * 50)
    print("Demo completed! 🎉")


if __name__ == "__main__":
    demo_token_operations()