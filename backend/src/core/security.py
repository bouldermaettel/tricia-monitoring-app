import hashlib
import hmac
import secrets

_ITERATIONS = 390000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), _ITERATIONS)
    return f'pbkdf2_sha256${_ITERATIONS}${salt}${dk.hex()}'


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_str, salt, expected_hash = password_hash.split('$', 3)
        if algorithm != 'pbkdf2_sha256':
            return False
        iterations = int(iterations_str)
    except ValueError:
        return False

    actual = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations).hex()
    return hmac.compare_digest(actual, expected_hash)
