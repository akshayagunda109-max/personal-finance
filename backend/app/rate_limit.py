"""Shared rate limiter.

Lives in its own module so routers can attach per-endpoint limits without
importing main.py (which imports the routers - a circular import).

The default in-memory backend is per-process: with more than one worker or
container each keeps its own counters, so the effective limit scales with the
replica count. That's acceptable for the current single-instance deploy; point
`storage_uri` at Redis if the app is ever scaled horizontally.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
