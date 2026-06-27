"""Lógica pura del fallback por visión (Fase B, F2-12).

SIN red ni SDKs: arma el prompt, decide cuándo conviene el fallback, parsea y
valida la respuesta JSON del modelo, y la mergea con el resultado de la Fase A.
El cliente HTTP del modelo (el borde con IO) vive en `app/llm.py`; acá está lo
caro de reescribir el día que se cambie de proveedor, y se testea sin red.

Principio rector (F2-12): "mejor NO cargar un dato que cargarlo mal". Ante la
duda, dejamos el campo vacío en vez de inventar; el front cae a carga manual.
"""

from __future__ import annotations

import json
import re
from datetime import date

from app.schemas import ReceiptExtraction

# Campos del contrato que el modelo debe devolver (mismo shape que ReceiptExtraction).
_FIELDS = (
    "amount",
    "currency",
    "date",
    "merchant",
    "origin_holder",
    "origin_bank",
    "dest_holder",
    "dest_bank",
)

# Prompt en español: pide SOLO JSON, sin inventar. La fecha en ISO; el monto numérico.
LLM_PROMPT = """\
Sos un extractor de datos de comprobantes de pago/transferencia (bancos y \
billeteras de Argentina). Mirá la imagen y devolvé EXCLUSIVAMENTE un JSON con \
estos campos (sin texto extra, sin markdown):

{
  "amount": número del importe de la operación (no el saldo, no un CBU/CVU, no un \
nº de operación, no el año de una fecha) o null,
  "currency": código ISO-4217 de 3 letras (ej. "ARS", "USD") o null,
  "date": fecha de la operación en formato "YYYY-MM-DD" o null,
  "merchant": comercio/descripción si es una compra, o null,
  "origin_holder": titular que envía (solo transferencias) o null,
  "origin_bank": banco/billetera de origen (solo transferencias) o null,
  "dest_holder": titular que recibe (solo transferencias) o null,
  "dest_bank": banco/billetera de destino (solo transferencias) o null,
  "confidence": tu confianza global de 0 a 1 (number)
}

Reglas:
- Si un dato no aparece claro, poné null. NO inventes ni adivines.
- Es preferible null antes que un valor dudoso.
- "amount" es solo el importe transferido/pagado, como número (sin símbolo ni \
separadores de miles).
"""


def build_prompt() -> str:
    """Texto de instrucción para el modelo de visión."""
    return LLM_PROMPT


def should_use_llm_fallback(result: ReceiptExtraction, max_confidence: float) -> bool:
    """¿Conviene pedir el fallback por visión tras la Fase A?

    Sí cuando la Fase A no logró un monto confiable: sin `amount`, o con
    confianza <= umbral. Si la Fase A ya extrajo bien, no gastamos una llamada.
    """
    if result.amount is None:
        return True
    return result.confidence <= max_confidence


def _strip_code_fences(raw: str) -> str:
    """Quita ```json ... ``` o ``` ... ``` que algunos modelos agregan."""
    text = raw.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL | re.IGNORECASE)
    return fence.group(1).strip() if fence else text


def _clean_str(value: object) -> str | None:
    """Normaliza un valor de texto: descarta vacíos y 'null'/'none' textuales."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"null", "none", "n/a", "-"}:
        return None
    return cleaned


def _clean_amount(value: object) -> float | None:
    """Acepta number o string numérico; descarta lo no convertible (principio rector)."""
    if isinstance(value, bool):  # bool es subclase de int en Python
        return None
    if isinstance(value, (int, float)):
        amount = float(value)
        return amount if amount > 0 else None
    if isinstance(value, str):
        token = value.strip().replace(" ", "")
        if not token:
            return None
        # "1.234,56" → "1234.56"; "1,234.56" → "1234.56"; "1234,56" → "1234.56"
        if "," in token and "." in token:
            token = (
                token.replace(".", "").replace(",", ".")
                if token.rfind(",") > token.rfind(".")
                else token.replace(",", "")
            )
        elif "," in token:
            token = token.replace(",", ".")
        elif "." in token:
            # es-AR: el punto suele ser separador de miles. Varios puntos, o uno
            # seguido de exactamente 3 dígitos (ej. "35.000"), → miles; si no, decimal.
            if token.count(".") > 1 or re.search(r"\.\d{3}$", token):
                token = token.replace(".", "")
        token = re.sub(r"[^0-9.]", "", token)
        try:
            amount = float(token)
        except ValueError:
            return None
        return amount if amount > 0 else None
    return None


def _clean_currency(value: object) -> str | None:
    cur = _clean_str(value)
    if cur is None:
        return None
    cur = cur.upper()
    return cur if re.fullmatch(r"[A-Z]{3}", cur) else None


def _clean_date(value: object) -> str | None:
    """Solo acepta ISO YYYY-MM-DD válido; cualquier otra cosa → None."""
    raw = _clean_str(value)
    if raw is None:
        return None
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if not m:
        return None
    try:
        date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return raw


def _clean_confidence(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return max(0.0, min(1.0, float(value)))
    return None


def parse_llm_json(raw_text: str) -> dict:
    """Parsea y SANEA la respuesta del modelo a un dict con los campos del contrato.

    Devuelve solo lo que pasa validación (principio rector). Si el texto no es
    JSON, devuelve {}.
    """
    try:
        data = json.loads(_strip_code_fences(raw_text))
    except (json.JSONDecodeError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}

    out: dict = {
        "amount": _clean_amount(data.get("amount")),
        "currency": _clean_currency(data.get("currency")),
        "date": _clean_date(data.get("date")),
        "merchant": _clean_str(data.get("merchant")),
        "origin_holder": _clean_str(data.get("origin_holder")),
        "origin_bank": _clean_str(data.get("origin_bank")),
        "dest_holder": _clean_str(data.get("dest_holder")),
        "dest_bank": _clean_str(data.get("dest_bank")),
    }
    # La moneda sin monto no aporta (mismo criterio que la Fase A).
    if out["amount"] is None:
        out["currency"] = None
    conf = _clean_confidence(data.get("confidence"))
    if conf is not None:
        out["confidence"] = conf
    return out


def to_extraction(data: dict) -> ReceiptExtraction:
    """Construye un ReceiptExtraction a partir del dict saneado del modelo."""
    return ReceiptExtraction(
        amount=data.get("amount"),
        currency=data.get("currency"),
        date=data.get("date"),
        merchant=data.get("merchant"),
        confidence=round(float(data.get("confidence", 0.0)), 2),
        origin_holder=data.get("origin_holder"),
        origin_bank=data.get("origin_bank"),
        dest_holder=data.get("dest_holder"),
        dest_bank=data.get("dest_bank"),
    )


def merge(fase_a: ReceiptExtraction, llm: ReceiptExtraction) -> ReceiptExtraction:
    """Combina Fase A y el fallback: por campo, prioriza el valor presente.

    El fallback corre porque la Fase A quedó floja, así que sus campos pisan los
    vacíos de la Fase A; donde el fallback dejó null, se conserva lo de Fase A.
    La confianza resultante es la mayor de ambas.
    """
    merged: dict = {}
    for field in _FIELDS:
        llm_value = getattr(llm, field)
        merged[field] = llm_value if llm_value is not None else getattr(fase_a, field)
    if merged["amount"] is None:
        merged["currency"] = None
    return ReceiptExtraction(
        confidence=round(max(fase_a.confidence, llm.confidence), 2),
        **merged,
    )
