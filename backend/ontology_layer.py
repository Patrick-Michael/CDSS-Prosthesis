# ontology_layer.py
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
from rules_engine import ENGINE_VERSION, RULESET_VERSION

DB_PATH = Path(__file__).parent / "data" / "ontology.db"

def get_ontology() -> Dict[str, Any]:
    """Build ontology dictionary from SQLite database (mirrors old hardcoded structure)."""

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # --- meta ---
    cur.execute("SELECT version, locale, updated_at FROM meta LIMIT 1")
    meta_row = cur.fetchone()
    meta = {
        "version": meta_row["version"],
        "locale": meta_row["locale"],
        "updated_at": meta_row["updated_at"],
        "engine_version": ENGINE_VERSION,
        "ruleset_version": RULESET_VERSION,
    }

    # --- labels ---
    labels = {}

    # arch
    cur.execute("SELECT key, label FROM arch_labels")
    labels["arch"] = {row["key"]: row["label"] for row in cur.fetchall()}

    # span_type
    cur.execute("SELECT key, label FROM span_type_labels")
    labels["span_type"] = {row["key"]: row["label"] for row in cur.fetchall()}

    # families
    cur.execute("SELECT key, label, short, description FROM families")
    labels["families"] = {
        row["key"]: {
            "label": row["label"],
            "short": row["short"],
            "description": row["description"],
        }
        for row in cur.fetchall()
    }

    # kinds
    cur.execute("SELECT key, label, short, description FROM kinds")
    labels["kinds"] = {
        row["key"]: {
            "label": row["label"],
            "short" : row["short"],
            "description": row["description"],
            
        }
        for row in cur.fetchall()
    }

    # --- rules ---
    cur.execute("SELECT key, short, label, explanation, severity FROM rules")
    rules = {
        row["key"]: {
            "short": row["short"],
            "label": row["label"],
            "explanation": row["explanation"],
            "severity": row["severity"],
        }
        for row in cur.fetchall()
    }

    # --- plans ---
    cur.execute("SELECT key, label, description FROM plans")
    plans = {
        row["key"]: {"label": row["label"], "description": row["description"]}
        for row in cur.fetchall()
    }

    # --- ui ---
    ui = {}

    cur.execute("SELECT severity, token FROM ui_severity_tokens")
    ui["severityTokens"] = {row["severity"]: row["token"] for row in cur.fetchall()}

    cur.execute("SELECT key, value FROM ui_legend")
    ui["legend"] = {row["key"]: row["value"] for row in cur.fetchall()}

    # --- glossary ---
    cur.execute("SELECT key, text FROM glossary")
    glossary = {row["key"]: row["text"] for row in cur.fetchall()}

    # --- options ---
    cur.execute("SELECT key, nameTemplate FROM options")
    options = {row["key"]: {"nameTemplate": row["nameTemplate"]} for row in cur.fetchall()}


    conn.close()

    return {
        "meta": meta,
        "labels": labels,
        "rules": rules,
        "plans": plans,
        "ui": ui,
        "glossary": glossary,
        "options": options,
    }
