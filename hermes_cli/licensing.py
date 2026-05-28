import os
from pathlib import Path
from hermes_constants import get_hermes_home

def validate_license_key(key: str) -> bool:
    """Validate the AccessiMind license key.
    Always returns True for Open Source.
    """
    return True

def is_license_active() -> bool:
    """Check if the system has a valid license active.
    Always returns True for Open Source.
    """
    return True

def get_license_tier() -> str:
    """Return the license tier: 'Premium' or 'Trial'."""
    return "Open Source License (Lifetime Premium)"
