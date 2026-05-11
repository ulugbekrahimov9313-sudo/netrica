#!/usr/bin/env python
"""Netrica demo server.

- Serves static files from repo root
- Provides a tiny messages API:
  - GET  /api/health
  - GET  /api/messages   (admin sees all; others see only their own)
  - POST /api/messages   (stores message)

Auth is demo-only and comes from request headers:
  - X-User-Email
  - X-User-Role  ("admin" to access all messages)

Run:
  python server.py
Then open:
  http://localhost:5173/index.html
"""

from __future__ import annotations

import json
import mimetypes
import os
import posixpath
import re
import sys
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError
import email.parser
import io


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "server-data"
MESSAGES_FILE = DATA_DIR / "messages.json"
SUPPORT_CHATS_FILE = DATA_DIR / "support-chats.json"
UPLOADS_DIR = DATA_DIR / "tz-uploads"

CLAUDE_API_KEY = os.environ.get("CLAUDE_API_KEY")

NETRICA_SYSTEM_PROMPT = """Sen — Netrica AI yordamchisi. Sening ismingni "Netrica AI" deb ata.

MUHIM QOIDALAR:
1. Sen HECH QACHON o'zingni Claude, Sonnet, Opus, Anthropic, OpenAI, GPT yoki boshqa AI nomi bilan atama. Sen faqat "Netrica AI" san.
2. Agar kimdir sening haqiqiy ismingni yoki qaysi model ekanligini so'rasa — "Men Netrica AI yordamchisiman" deb javob ber.
3. Sen FAQAT Netrica kompaniyasi, uning mahsulotlari va netrica.com sayti imkoniyatlari haqida javob berasan.
4. Agar foydalanuvchi Netricaga aloqador bo'lmagan savol bersa:
   "Kechirasiz, men faqat Netrica mahsulotlari va sayti imkoniyatlari bo'yicha yordam bera olaman."
5. Har doim o'zbek tilida javob ber (agar foydalanuvchi rus yoki ingliz tilida yozsa, shu tilda javob ber).

NETRICA HAQIDA MA'LUMOT:
- Netrica — bu raqamli xizmatlar platformasi, 2025-yilda tashkil etilgan
- Platformada tayyor loyihalar va buyurtma asosida maxsus loyihalar mavjud
- Saytda: Bosh sahifa, Mahsulotlar, Biz haqimizda, Obunalar, Chat, Buyurtmalarim, Profilim
- TZ tizimi, admin panel, yordam chati mavjud

TAYYOR MAHSULOTLAR:
1. **TZ Generator (Texnik Topshiriq)** — narxi: $99
   - AI yordamida professional texnik topshiriq yaratish
   - Loyiha talablarini tahlil qilish
   - Tayyor TZ hujjatni yuklab olish
   - Qo'llanilishi: startaplar, IT kompaniyalar, freelanserlar

2. **Netrica AI Chat** — narxi: $29/oy (obuna)
   - AI bilan real-vaqt suhbat
   - Loyiha maslahat va tahlil
   - 24/7 yordam
   - Qo'llanilishi: biznes-maslahat, texnik savollarga javob, g'oyalarni muhokama qilish

3. **Buyurtma Tizimi (Order System)** — bepul (asosiy platforma funksiyasi)
   - Maxsus loyihalarni buyurtma qilish
   - Buyurtma holatini kuzatish
   - TZ yuklash va tahlil
   - Qo'llanilishi: kichik biznes, korxonalar, startaplar

4. **Inshoat Loyiha Tizimi** — narxi: $149
   - Qurilish loyihalari uchun maxsus platforma
   - Loyihalarni boshqarish va kuzatish
   - Hujjatlar va hisobotlar generatsiyasi
   - Qo'llanilishi: qurilish kompaniyalari, arxitektorlar, muhandislar

OBUNA REJALAR:
- Netrica AI Chat obunasi: $29/oy — AI chat, maslahatlar, TZ tahlili
- Foydalanuvchilar "Obunalar" sahifasida obuna sotib olishlari mumkin

QANDAY FOYDALANISH:
- Ro'yxatdan o'tish → Kirish → Mahsulotlar sahifasida ko'rish → To'lov → Foydalanish
- TZ buyurtma qilish: Chat orqali AI bilan suhbat → TZ tayyorlanadi → Yuklab olish
- Yordam kerak bo'lsa: sahifaning pastki qismidagi support widget orqali admin bilan aloqa

TZ YOZISH XIZMATI:
Agar foydalanuvchi TZ yozdirmoqchi bo'lsa (masalan: "TZ yozib ber", "loyiha uchun TZ kerak", "menga sayt kerak"):

1-QADAM: Kontekstda "[TZ_PAID]" belgisi bor-yo'qligini tekshir.
  - Agar "[TZ_PAID]" belgisi YO'Q bo'lsa — shunday javob ber:
    "[NEED_PAYMENT] TZ yozish xizmati pullik ($99). Davom etish uchun avval to'lovni amalga oshiring. Tizim sizni to'lov sahifasiga yo'naltiradi."
  - Agar "[TZ_PAID]" belgisi BOR bo'lsa — 2-qadamga o't.

2-QADAM: Loyiha haqida batafsil ma'lumot yig'ish. Foydalanuvchidan TARTIB BILAN so'ra:
  - Loyihaning nomi va qisqa tavsifi
  - Loyiha turi (veb-sayt, mobil ilova, bot, CRM va h.k.)
  - Maqsadli auditoriya (kimlar uchun?)
  - Foydalanuvchi rollari (admin, oddiy foydalanuvchi, moderator va h.k.)
  - Asosiy funksiyalar va imkoniyatlar
  - Dizayn talablari (rang sxemasi, uslub)
  - Integratsiyalar (to'lov, SMS, email, boshqa tizimlar)
  - Maxsus talablar
  MUHIM: Har bir savolni ALOHIDA ber, foydalanuvchi javob berguncha keyingi savolni BERMA. Yetarli ma'lumot yig'ilgach (kamida 4-5 javob), 3-qadamga o't.

3-QADAM: To'liq PROFESSIONAL texnik topshiriq yoz. Formatni qat'iy saqlа:

[TZ_START]
# TEXNIK TOPSHIRIQ (TZ)

## 1. Loyiha haqida umumiy ma'lumot
**Loyiha nomi:** ...
**Loyiha turi:** ...
**Maqsadli auditoriya:** ...
**Qisqa tavsif:** ...

## 2. Foydalanuvchi rollari
| Rol | Huquqlar |
|-----|----------|
| ... | ... |

## 3. Funksional talablar
### 3.1 Asosiy funksiyalar
- ...
### 3.2 Qo'shimcha funksiyalar
- ...

## 4. Nofunksional talablar
- Tezlik, xavfsizlik, masshtablanish...

## 5. Texnologiyalar steki
- Frontend: ...
- Backend: ...
- Database: ...
- Hosting: ...

## 6. Dizayn talablari
- Uslub, ranglar, responsivlik...

## 7. Integratsiyalar
- ...

## 8. Loyiha bosqichlari va muddat
| Bosqich | Tavsif | Muddat |
|---------|--------|--------|
| ... | ... | ... |

## 9. Taxminiy narx
| Bosqich | Narx |
|---------|------|
| ... | ... |
| **Jami** | **...** |

## 10. Qo'shimcha shartlar
- ...
[TZ_END]

TZ yozgandan keyin aynan shu gapni qo'sh: "TZ tayyor! Uni yuklab olish uchun pastdagi tugmani bosing. Buyurtma berish uchun 'buyurtma' deb yozing."

Javoblaringni aniq va professional qil. O'zingdan qo'shimcha foydali funksiyalar va yaxshilanishlar taklif qil."""

TZ_ANALYSIS_PROMPT = """Sen — Netrica AI loyiha tahlilchisi. Foydalanuvchi texnik topshiriq (TZ) faylini yukladi. Sening vazifang:

1. TZ mazmunini tahlil qil
2. Loyiha haqida qisqa xulosa ber
3. Quyidagi ma'lumotlarni aniqlab ber:
   - Loyiha nomi
   - Loyiha turi (veb-sayt, mobil ilova, bot, tizim va h.k.)
   - Asosiy funksiyalar ro'yxati
   - Taxminiy murakkablik darajasi (oson / o'rta / murakkab / juda murakkab)
   - Tavsiya etiladigan texnologiyalar
   - Taxminiy muddat
   - Taxminiy narx (so'm yoki dollar)

MUHIM: Javobni o'zbek tilida ber. Aniq va professional tarzda yoz.
Agar fayl mazmuni texnik topshiriqqa o'xshamasa, shuni ayt va foydalanuvchidan to'g'ri TZ yuklashni so'ra.

Sening ismingni "Netrica AI" deb ata. Hech qachon Claude, Anthropic dema."""


def _call_claude_api(user_message: str, history: list[dict] | None = None) -> str:
  """Call Claude API and return the assistant response text."""
  messages = []
  if history:
    for msg in history[-10:]:
      role = "assistant" if msg.get("from", "") == "ai" else "user"
      messages.append({"role": role, "content": msg.get("text", "")})
  messages.append({"role": "user", "content": user_message})

  payload = json.dumps({
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4096,
    "system": NETRICA_SYSTEM_PROMPT,
    "messages": messages,
  }).encode("utf-8")

  req = Request(
    "https://api.anthropic.com/v1/messages",
    data=payload,
    headers={
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    method="POST",
  )
  try:
    with urlopen(req, timeout=30) as resp:
      data = json.loads(resp.read().decode("utf-8"))
      for block in data.get("content", []):
        if block.get("type") == "text":
          return block["text"]
      return "Kechirasiz, javob olishda xatolik yuz berdi."
  except URLError as e:
    return "Kechirasiz, hozirda xizmat vaqtincha mavjud emas. Iltimos keyinroq urinib ko'ring."
  except Exception:
    return "Kechirasiz, javob olishda xatolik yuz berdi."


def _analyze_tz(file_text: str) -> str:
  """Send TZ file content to Claude for analysis."""
  payload = json.dumps({
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 2048,
    "system": TZ_ANALYSIS_PROMPT,
    "messages": [{"role": "user", "content": f"Quyidagi texnik topshiriq (TZ) faylini tahlil qil:\n\n{file_text[:15000]}"}],
  }).encode("utf-8")

  req = Request(
    "https://api.anthropic.com/v1/messages",
    data=payload,
    headers={
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    method="POST",
  )
  try:
    with urlopen(req, timeout=60) as resp:
      data = json.loads(resp.read().decode("utf-8"))
      for block in data.get("content", []):
        if block.get("type") == "text":
          return block["text"]
      return "Kechirasiz, tahlil qilishda xatolik yuz berdi."
  except Exception:
    return "Kechirasiz, hozirda xizmat vaqtincha mavjud emas. Iltimos keyinroq urinib ko'ring."


def _parse_multipart(handler) -> tuple[str, bytes]:
  """Parse multipart/form-data and return (filename, file_bytes)."""
  content_type = handler.headers.get("Content-Type", "")
  length = int(handler.headers.get("Content-Length") or 0)
  if length <= 0 or length > 10 * 1024 * 1024:  # 10MB limit
    return "", b""
  body = handler.rfile.read(length)

  boundary = ""
  for part in content_type.split(";"):
    part = part.strip()
    if part.startswith("boundary="):
      boundary = part[9:].strip('"')
      break
  if not boundary:
    return "", b""

  parts = body.split(f"--{boundary}".encode())
  for part in parts:
    if b"filename=" not in part:
      continue
    header_end = part.find(b"\r\n\r\n")
    if header_end < 0:
      continue
    header_text = part[:header_end].decode("utf-8", errors="replace")
    file_data = part[header_end + 4:]
    if file_data.endswith(b"\r\n"):
      file_data = file_data[:-2]

    filename = ""
    for line in header_text.split("\r\n"):
      if "filename=" in line:
        m = re.search(r'filename="([^"]*)"', line)
        if m:
          filename = m.group(1)
    return filename, file_data
  return "", b""


def _now_iso() -> str:
  return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _read_messages() -> list[dict]:
  try:
    raw = MESSAGES_FILE.read_text(encoding="utf-8")
    data = json.loads(raw)
    return data if isinstance(data, list) else []
  except FileNotFoundError:
    return []
  except Exception:
    return []


def _write_messages(messages: list[dict]) -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  tmp = MESSAGES_FILE.with_suffix(".json.tmp")
  tmp.write_text(json.dumps(messages, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
  os.replace(tmp, MESSAGES_FILE)


def _read_support_chats() -> list[dict]:
  try:
    raw = SUPPORT_CHATS_FILE.read_text(encoding="utf-8")
    data = json.loads(raw)
    return data if isinstance(data, list) else []
  except FileNotFoundError:
    return []
  except Exception:
    return []


def _write_support_chats(chats: list[dict]) -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  tmp = SUPPORT_CHATS_FILE.with_suffix(".json.tmp")
  tmp.write_text(json.dumps(chats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
  os.replace(tmp, SUPPORT_CHATS_FILE)


def _safe_join(root: Path, url_path: str) -> Path | None:
  # Prevent path traversal
  p = posixpath.normpath(url_path)
  p = p.lstrip("/")
  if p.startswith(".."):  # quick check
    return None
  # Reject weird segments
  if re.search(r"(^|/)\.\.(?:/|$)", p):
    return None
  final = (root / p).resolve()
  try:
    final.relative_to(root)
  except ValueError:
    return None
  return final


class Handler(BaseHTTPRequestHandler):
  server_version = "NetricaDemo/1.0"

  def _send_json(self, obj, status=HTTPStatus.OK):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Cache-Control", "no-store")
    self.send_header("Content-Length", str(len(data)))
    self.end_headers()
    self.wfile.write(data)

  def _send_text(self, text: str, status=HTTPStatus.OK, content_type="text/plain; charset=utf-8"):
    data = text.encode("utf-8")
    self.send_response(status)
    self.send_header("Content-Type", content_type)
    self.send_header("Cache-Control", "no-store")
    self.send_header("Content-Length", str(len(data)))
    self.end_headers()
    self.wfile.write(data)

  def _read_json_body(self) -> dict:
    length = int(self.headers.get("Content-Length") or 0)
    if length <= 0:
      return {}
    raw = self.rfile.read(length)
    try:
      data = json.loads(raw.decode("utf-8"))
      return data if isinstance(data, dict) else {}
    except Exception:
      return {}

  def _user_email(self) -> str:
    return (self.headers.get("X-User-Email") or "").strip().lower()

  def _user_role(self) -> str:
    return (self.headers.get("X-User-Role") or "").strip().lower()

  def do_GET(self):
    url = urlparse(self.path)
    path = url.path or "/"

    if path == "/api/health":
      return self._send_json({"ok": True, "time": _now_iso()})

    if path.startswith("/api/tz-download/"):
      fname = path.split("/api/tz-download/", 1)[1]
      fname = unquote(fname)
      safe = re.sub(r'[^\w.\-]', '_', fname)
      fpath = UPLOADS_DIR / safe
      if not fpath.exists() or not str(fpath.resolve()).startswith(str(UPLOADS_DIR.resolve())):
        return self._send_text("Not found", status=HTTPStatus.NOT_FOUND)
      data = fpath.read_bytes()
      ctype, _ = mimetypes.guess_type(safe)
      if not ctype:
        ctype = "application/octet-stream"
      self.send_response(HTTPStatus.OK)
      self.send_header("Content-Type", ctype)
      self.send_header("Content-Disposition", f'attachment; filename="{safe}"')
      self.send_header("Content-Length", str(len(data)))
      self.end_headers()
      self.wfile.write(data)
      return

    if path == "/api/messages":
      role = self._user_role()
      email = self._user_email()
      all_msgs = _read_messages()

      if role == "admin":
        return self._send_json({"items": all_msgs})

      if not email:
        return self._send_json({"items": []})

      mine = [m for m in all_msgs if (m.get("userEmail") or "").lower() == email]
      return self._send_json({"items": mine})

    if path == "/api/support-chats":
      role = self._user_role()
      email = self._user_email()
      all_chats = _read_support_chats()

      if role == "admin":
        return self._send_json({"items": all_chats})

      if not email:
        return self._send_json({"items": []})

      mine = [c for c in all_chats if (c.get("email") or "").lower() == email]
      return self._send_json({"items": mine})

    # Static file serving
    if path == "/":
      path = "/index.html"

    file_path = _safe_join(ROOT, unquote(path))
    if not file_path:
      return self._send_text("Not found", status=HTTPStatus.NOT_FOUND)

    if file_path.is_dir():
      index = file_path / "index.html"
      if index.exists():
        file_path = index
      else:
        return self._send_text("Not found", status=HTTPStatus.NOT_FOUND)

    if not file_path.exists():
      return self._send_text("Not found", status=HTTPStatus.NOT_FOUND)

    # Basic content-type
    ctype, _ = mimetypes.guess_type(str(file_path))
    if not ctype:
      ctype = "application/octet-stream"

    try:
      data = file_path.read_bytes()
    except Exception:
      return self._send_text("Server error", status=HTTPStatus.INTERNAL_SERVER_ERROR)

    self.send_response(HTTPStatus.OK)
    self.send_header("Content-Type", f"{ctype}")
    # Avoid caching during dev
    self.send_header("Cache-Control", "no-store")
    self.send_header("Content-Length", str(len(data)))
    self.end_headers()
    self.wfile.write(data)

  def do_POST(self):
    url = urlparse(self.path)
    path = url.path or "/"

    if path == "/api/support-chats":
      body = self._read_json_body()
      thread = body.get("thread")
      if not thread or not isinstance(thread, dict):
        return self._send_json({"ok": False, "error": "invalid"}, status=HTTPStatus.BAD_REQUEST)
      email = (thread.get("email") or "").strip().lower()
      if not email:
        return self._send_json({"ok": False, "error": "no_email"}, status=HTTPStatus.BAD_REQUEST)
      all_chats = _read_support_chats()
      existing = next((c for c in all_chats if (c.get("email") or "").lower() == email), None)
      if existing:
        existing["name"] = thread.get("name", existing.get("name", ""))
        existing["messages"] = thread.get("messages", existing.get("messages", []))
        existing["updatedAt"] = thread.get("updatedAt", existing.get("updatedAt", _now_iso()))
      else:
        all_chats.append(thread)
      _write_support_chats(all_chats)
      return self._send_json({"ok": True})

    if path == "/api/ai-chat":
      body = self._read_json_body()
      text = (body.get("text") or "").strip()
      if not text:
        return self._send_json({"ok": False, "error": "empty"}, status=HTTPStatus.BAD_REQUEST)
      history = body.get("history", [])
      reply = _call_claude_api(text, history)
      return self._send_json({"ok": True, "reply": reply})

    if path == "/api/upload-tz":
      filename, file_data = _parse_multipart(self)
      if not file_data:
        return self._send_json({"ok": False, "error": "no_file"}, status=HTTPStatus.BAD_REQUEST)

      ext = os.path.splitext(filename)[1].lower() if filename else ""
      allowed = {".txt", ".md", ".pdf", ".docx", ".doc", ".rtf"}
      if ext not in allowed:
        return self._send_json({"ok": False, "error": "unsupported_format"}, status=HTTPStatus.BAD_REQUEST)

      # Extract text from file
      file_text = ""
      if ext in (".txt", ".md", ".rtf"):
        file_text = file_data.decode("utf-8", errors="replace")
      elif ext == ".pdf":
        # Basic PDF text extraction
        try:
          raw = file_data.decode("latin-1")
          # Extract text between BT and ET markers (basic approach)
          texts = re.findall(r'\(([^)]+)\)', raw)
          file_text = " ".join(texts[:500])
          if len(file_text) < 50:
            file_text = re.sub(r'[^\x20-\x7e\u0400-\u04ff\u0000-\uffff]', ' ', file_data.decode("utf-8", errors="replace"))
        except Exception:
          file_text = file_data.decode("utf-8", errors="replace")
      elif ext in (".docx", ".doc"):
        # Basic docx text extraction (zip with xml)
        try:
          import zipfile
          with zipfile.ZipFile(io.BytesIO(file_data)) as zf:
            if "word/document.xml" in zf.namelist():
              xml = zf.read("word/document.xml").decode("utf-8", errors="replace")
              file_text = re.sub(r'<[^>]+>', '', xml)
        except Exception:
          file_text = file_data.decode("utf-8", errors="replace")

      if not file_text.strip():
        return self._send_json({"ok": False, "error": "empty_file"}, status=HTTPStatus.BAD_REQUEST)

      # Save file to disk
      UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
      safe_name = re.sub(r'[^\w.\-]', '_', filename or 'tz_file')
      ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
      saved_name = f"{ts}_{safe_name}"
      (UPLOADS_DIR / saved_name).write_bytes(file_data)

      analysis = _analyze_tz(file_text)
      return self._send_json({"ok": True, "filename": filename, "savedFile": saved_name, "analysis": analysis})

    if path != "/api/messages":
      return self._send_text("Not found", status=HTTPStatus.NOT_FOUND)

    body = self._read_json_body()
    text = (body.get("text") or "").strip()

    # Email can be passed in body or header, header wins.
    email = self._user_email() or (body.get("userEmail") or "")
    email = str(email).strip().lower()

    if not text:
      return self._send_json({"ok": False, "error": "empty"}, status=HTTPStatus.BAD_REQUEST)
    if not email:
      return self._send_json({"ok": False, "error": "no_email"}, status=HTTPStatus.BAD_REQUEST)

    messages = _read_messages()
    msg = {
      "id": f"msg_{os.urandom(6).hex()}",
      "userEmail": email,
      "text": text,
      "createdAt": _now_iso(),
    }
    messages.insert(0, msg)
    _write_messages(messages)
    return self._send_json({"ok": True, "item": msg})

  def log_message(self, fmt: str, *args) -> None:
    # Keep logs concise
    sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))


def main():
  port = int(os.environ.get("PORT") or "5173")
  host = os.environ.get("HOST") or "127.0.0.1"
  httpd = ThreadingHTTPServer((host, port), Handler)
  print(f"Netrica demo server: http://{host}:{port}/index.html")
  try:
    httpd.serve_forever()
  except KeyboardInterrupt:
    pass


if __name__ == "__main__":
  main()
