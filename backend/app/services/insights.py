"""Generates a natural-language summary of a category's transactions via Gemini -
which merchants/people show up, notable large transactions, timing patterns.
"""
import json

import google.generativeai as genai
from fastapi import HTTPException
from google.api_core.exceptions import GoogleAPIError

from app.config import settings

_SYSTEM_PROMPT = (
    "You are a personal finance assistant. Given a list of transactions in one "
    "spending category, write a short, specific summary (3-5 sentences) covering: "
    "which merchants or people appear most often, any notably large transactions, "
    "and any pattern in timing (e.g. recurring monthly, concentrated in one week). "
    "Reference actual amounts and names from the data - be concrete, not generic. "
    "Do not restate the raw list; synthesize it. Plain text, no markdown."
)


def generate_category_insight(category: str, transactions: list[dict]) -> str:
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_model, system_instruction=_SYSTEM_PROMPT)

    prompt = f"Category: {category}\nTransactions:\n{json.dumps(transactions)}"
    try:
        response = model.generate_content(prompt)
    except GoogleAPIError as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}") from exc

    return response.text.strip()
