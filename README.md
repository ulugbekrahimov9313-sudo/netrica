# Netrica.com — Frontend demo (HTML/CSS/JS)

Bu repo **TZ asosida** statik prototip sifatida tayyorlangan (backend/DB yo‘q). Ma’lumotlar demo sifatida `localStorage`da saqlanadi.

## Ishga tushirish

### 1) Backend bilan (tavsiya)

Bu rejimda xabarlar `server-data/messages.json` ga yoziladi va admin ham hammasini ko‘ra oladi.

```bash
python server.py
```

So‘ng brauzerda oching:

- http://localhost:5173/index.html

### 2) Faqat statik (backend yo‘q)

Eng to‘g‘ri usul — lokal server bilan:

```bash
python -m http.server 5173
```

So‘ng brauzerda oching:

- http://localhost:5173/index.html

Agar Python bo‘lmasa, `index.html`ni to‘g‘ridan-to‘g‘ri ochsa ham bo‘ladi (faqat i18n JSON `fetch` bo‘limi cheklanishi mumkin, fallback ishlaydi).

## Demo loginlar

- User: `user@demo.com` / `demo`
- Admin: `admin@netrica.com` / `admin`
