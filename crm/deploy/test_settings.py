#!/usr/bin/env python3
"""Test settings loading from environment variables."""

import sys
sys.path.insert(0, '/opt/anqiao-crm/src')

from crm.config import Settings

try:
    settings = Settings()
    print(f"✅ Settings loaded successfully!")
    print(f"   Environment: {settings.crm_environment}")
    print(f"   Database host: {settings.database_host}")
    print(f"   Database name: {settings.database_name}")
except Exception as e:
    print(f"❌ Failed to load settings:")
    print(f"   {type(e).__name__}: {e}")
    sys.exit(1)
