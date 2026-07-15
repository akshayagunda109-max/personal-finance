"""Classifies transaction descriptions into a fixed set of category buckets,
and derives a short human-readable name (e.g. "Swiggy" instead of
"UPI/P2M/603419415923/Swiggy /Swiggy/AIRTEL PAYMENTS BANK"), using the Gemini
API. Requests are batched (many transactions per call) to keep cost and
latency down.
"""
import json
from dataclasses import dataclass

import google.generativeai as genai
from fastapi import HTTPException
from google.api_core.exceptions import GoogleAPIError

from app.config import settings
from app.services.categories import CATEGORIES, UNCATEGORIZED

BATCH_SIZE = 40

_SYSTEM_PROMPT = (
    "You are a personal finance transaction categorizer. For each transaction "
    "description you are given two jobs:\n"
    "1. Classify it into exactly one of these categories: " + ", ".join(CATEGORIES) + ". "
    "Bank transfer/UPI descriptions between individuals with no merchant signal should be "
    "'Transfers'. Salary/refunds/interest credited should be 'Income'. Transactions to/from "
    "investing, trading, or brokerage platforms (e.g. Groww, Upstox, Zerodha, Kite, Angel One, "
    "Coin, Paytm Money) should be 'Investing / Trading'. If genuinely unclear, use 'Uncategorized'.\n"
    "2. Extract a short, human-readable display name (2-6 words) from the raw description - "
    "the merchant or person's name, stripped of UPI reference numbers, bank codes, and "
    "boilerplate (e.g. 'UPI/P2M/603419415923/Swiggy /Swiggy/AIRTEL PAYMENTS BANK' becomes "
    "'Swiggy'; 'UPI/P2A/464781486915/Geethika Sai Lakshmi /Paymen/State Bank Of India' becomes "
    "'Geethika Sai Lakshmi'). If nothing recognizable can be extracted, reuse the raw description "
    "verbatim.\n"
    "Respond with strict JSON only: a list of objects, each "
    '{"id": <int>, "category": <string from the list above>, "display_name": <string>}, '
    "one per input transaction, in the same order given, with the same ids."
)


@dataclass
class Classification:
    category: str
    display_name: str


def categorize_batch(transactions: list[tuple[int, str]]) -> dict[int, Classification]:
    """transactions: list of (id, description). Returns id -> Classification."""
    if not transactions:
        return {}

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_model, system_instruction=_SYSTEM_PROMPT)
    results: dict[int, Classification] = {}

    for start in range(0, len(transactions), BATCH_SIZE):
        batch = transactions[start:start + BATCH_SIZE]
        descriptions_by_id = dict(batch)
        user_payload = [{"id": txn_id, "description": desc} for txn_id, desc in batch]

        try:
            response = model.generate_content(
                json.dumps(user_payload),
                generation_config={"response_mime_type": "application/json"},
            )
        except GoogleAPIError as exc:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}") from exc

        try:
            parsed = json.loads(response.text)
        except (ValueError, AttributeError) as exc:
            raise HTTPException(
                status_code=502, detail=f"Gemini returned an unparseable response: {exc}"
            ) from exc

        # The model may wrap the list in an object (e.g. {"transactions": [...]})
        # depending on how it interprets "strict JSON" - handle both shapes.
        items = parsed if isinstance(parsed, list) else next(
            (v for v in parsed.values() if isinstance(v, list)), []
        )

        batch_ids = {txn_id for txn_id, _ in batch}
        for item in items:
            txn_id = item.get("id")
            category = item.get("category")
            display_name = item.get("display_name")
            if txn_id in batch_ids and category in CATEGORIES and display_name:
                results[txn_id] = Classification(category=category, display_name=display_name)

        # Anything the model dropped or mis-labelled falls back to Uncategorized,
        # keeping the raw description as the display name.
        for txn_id, description in batch:
            results.setdefault(
                txn_id, Classification(category=UNCATEGORIZED, display_name=descriptions_by_id[txn_id])
            )

    return results
