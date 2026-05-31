import re


def sanitize_filename(value):
    safe_value = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._-")
    return safe_value or "output"


def parse_aes_block_input(raw_value, label, encoding="windows-1252"):
    value = raw_value.strip()
    if re.fullmatch(r"[0-9A-Fa-f]{32}", value):
        block_bytes = bytes.fromhex(value)
        return block_bytes.decode(encoding, errors="replace"), block_bytes.hex()

    try:
        block_bytes = value.encode(encoding)
    except UnicodeEncodeError as exc:
        raise ValueError(f"{label} tidak bisa dikonversi dengan encoding {encoding}") from exc

    if len(block_bytes) != 16:
        raise ValueError(f"{label} harus tepat 16 byte: teks 16 karakter ASCII atau hex 32 digit")

    return value, block_bytes.hex()
