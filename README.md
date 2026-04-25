# Mart (Lav Mart)

Simple snack shop demo with a Node/Express backend:

- Serves `index.html`, `style.css`, `script.js`
- UPI QR generation endpoint
- Razorpay order creation + signature verification (requires env vars)

## Run

```bash
npm install
PORT=3001 npm start
```

Open `http://localhost:3001/`.

## Environment

Copy `.env.example` to `.env` and fill:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
