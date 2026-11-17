"""One tool-free advisory review. Only fixed diagnostics cross the Actions log boundary."""

from http.client import HTTPException, HTTPSConnection, IncompleteRead
import json
import os
import unicodedata
from pathlib import Path


MODEL = "claude-opus-5-5"
MAX_REQUEST_BYTES = 150_000
MAX_TOKENS = 32_768
MAX_RESPONSE_BYTES = 1024 * 1024
TEXT = {"type": "string"}
FINDING = {"type": "object", "additionalProperties": False,
           "required": ["path", "line", "side", "body"],
           "properties": {"path": TEXT, "line": {"type": "integer"},
                          "side": {"type": "string", "enum": ["LEFT", "RIGHT"]}, "body": TEXT}}
REVIEW_FIELDS = {"findings": {"type": "array", "items": FINDING}, "overflow": {"type": "boolean"}}
RESULT_FIELDS = {"review": REVIEW_FIELDS, "mention": {**REVIEW_FIELDS, "summary": TEXT}}
HTTP_ERRORS = {400: "invalid_request", 401: "authentication", 402: "billing", 403: "permission",
               404: "resource_unavailable", 413: "request_size", 429: "rate_or_spend_limit",
               500: "provider_error", 504: "provider_timeout", 529: "overloaded"}


class ReviewFailure(Exception):
    """Messages are fixed locally; never wrap external error text."""


def unique_fields(pairs):
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise ValueError("duplicate JSON field")
    return fields


def result_from(message, kind):
    stop = message.get("stop_reason")
    if stop != "end_turn":
        known_stops = {"max_tokens": "output_token_limit", "model_context_window_exceeded": "context_window_limit",
                       "refusal": "refused"}
        raise ReviewFailure(known_stops.get(stop, "unexpected_stop") if isinstance(stop, str) else "unexpected_stop")
    blocks = message.get("content")
    if (not isinstance(blocks, list) or any(not isinstance(b, dict) or b.get("type") not in
            ("thinking", "redacted_thinking", "text") for b in blocks)):
        raise ReviewFailure("unexpected_content")
    texts = [b.get("text") for b in blocks if b["type"] == "text"]
    if len(texts) != 1 or not isinstance(texts[0], str):
        raise ReviewFailure("missing_result")
    try:
        result = json.loads(texts[0], object_pairs_hook=unique_fields)
    except (ValueError, RecursionError):
        raise ReviewFailure("invalid_result_json") from None

    def bounded(value, limit):
        return (isinstance(value, str) and 0 < len(value) <= limit and value.strip()
                and all(c.isprintable() or unicodedata.category(c) == "Zs" or c in "\n\t\r" for c in value))

    if not isinstance(result, dict) or result.keys() != RESULT_FIELDS[kind].keys():
        raise ReviewFailure("invalid_result_fields")
    if type(result["overflow"]) is not bool:
        raise ReviewFailure("invalid_overflow")
    if kind == "mention" and not bounded(result["summary"], 4000):
        raise ReviewFailure("invalid_summary")
    if not isinstance(result["findings"], list) or len(result["findings"]) > 10:
        raise ReviewFailure("invalid_findings")
    for f in result["findings"]:
        if (not isinstance(f, dict) or set(f) != {"path", "line", "side", "body"}
                or not bounded(f["path"], 300) or not bounded(f["body"], 1000)
                or type(f["line"]) is not int or not 1 <= f["line"] <= 2**31 - 1
                or not isinstance(f["side"], str) or not f["side"].isascii()
                or f["side"].upper() not in ("LEFT", "RIGHT")):
            raise ReviewFailure("invalid_finding")
        f["side"] = f["side"].upper()
    return result


def request_body(system, data, kind):
    """Serialize the complete request identically for preflight and transport."""
    fields = RESULT_FIELDS[kind]
    schema = {"type": "object", "additionalProperties": False, "required": list(fields), "properties": fields}
    return json.dumps({"model": MODEL, "speed": "standard", "service_tier": "standard_only",
                       "max_tokens": MAX_TOKENS, "system": system,
                       "messages": [{"role": "user", "content": data}],
                       "output_config": {"effort": "high", "format": {"type": "json_schema", "schema": schema}}},
                      separators=(",", ":")).encode("ascii")


def review(system, data, key, kind):
    if not key or not key.isascii() or not key.isprintable() or key.strip() != key:
        raise ReviewFailure("credential_missing_or_invalid")
    body = request_body(system, data, kind)
    if len(body) > MAX_REQUEST_BYTES:
        raise ReviewFailure("input_budget")
    # HTTPSConnection does not follow redirects, consult proxy environment variables or retry.
    conn = HTTPSConnection("api.anthropic.com", timeout=960)
    try:
        conn.request("POST", "/v1/messages", body, {"x-api-key": key, "anthropic-version": "2023-06-01",
                                                   "content-type": "application/json"})
        response = conn.getresponse()
        if response.status != 200:
            category = HTTP_ERRORS.get(response.status, "http_unknown")
            raise ReviewFailure(f"{category} (HTTP {response.status})")
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ReviewFailure("response_size")
        if response.length:
            raise ReviewFailure("truncated_transport")
    except IncompleteRead:
        raise ReviewFailure("truncated_transport") from None
    except (OSError, HTTPException):
        raise ReviewFailure("transport") from None
    finally:
        conn.close()
    try:
        message = json.loads(raw, object_pairs_hook=unique_fields)
    except (ValueError, RecursionError):
        raise ReviewFailure("invalid_response_json") from None
    if (not isinstance(message, dict) or message.get("type") != "message"
            or message.get("role") != "assistant" or message.get("model") != MODEL):
        raise ReviewFailure("invalid_envelope")
    usage = message.get("usage")
    valid_usage = (isinstance(usage, dict) and usage.get("speed", "standard") == "standard"
                   and all(type(usage.get(k)) is int and 0 <= usage[k] <= 1_000_000
                           for k in ("input_tokens", "output_tokens")))
    # Keep token diagnostics even when the provider stops before producing a complete result.
    print(f"Usage: input_tokens={usage['input_tokens']} output_tokens={usage['output_tokens']}"
          if valid_usage else "Usage: unavailable")
    result = result_from(message, kind)
    if key in json.dumps(result, ensure_ascii=False):
        raise ReviewFailure("unsafe_result")
    if not valid_usage:
        raise ReviewFailure("invalid_usage")
    return result


def main():
    try:
        folder = Path(os.environ["RUNNER_TEMP"])
        system, data = json.loads((folder / "claude-input.json").read_text("utf-8"))
        result = review(system, data, os.environ.get("ANTHROPIC_API_KEY", ""), os.environ["KIND"])
        (folder / "claude-result.json").write_text(json.dumps(result), encoding="ascii")
    except ReviewFailure as error:
        detail = str(error)
    except Exception:
        detail = "local_client"
    else:
        return 0
    print(f"::error::Claude review failed: {detail}")
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
        print(f"failure={detail}", file=out)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
