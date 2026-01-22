import base64
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.config import settings

def get_fernet():
    # Derive a proper key from the encryption key
    key = settings.encryption_key.encode()
    # Pad or hash to get 32 bytes for Fernet
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b'prompt-management-salt',
        iterations=100000,
    )
    derived_key = base64.urlsafe_b64encode(kdf.derive(key))
    return Fernet(derived_key)

def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage"""
    fernet = get_fernet()
    encrypted = fernet.encrypt(api_key.encode())
    return base64.urlsafe_b64encode(encrypted).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from storage"""
    fernet = get_fernet()
    decrypted = fernet.decrypt(base64.urlsafe_b64decode(encrypted_key.encode()))
    return decrypted.decode()

def generate_api_key() -> str:
    """Generate a new API key"""
    return f"pm_{secrets.token_urlsafe(32)}"

def mask_api_key(api_key: str) -> str:
    """Mask an API key for display"""
    if len(api_key) <= 8:
        return api_key[:2] + "...." + api_key[-2:]
    return api_key[:4] + "...." + api_key[-4:]
