const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Serve only the frontend assets we expect (avoid exposing server files).
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));

// Razorpay Instance
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const razorpay =
  RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
    ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
    : null;

// UPI details for QR (merchant details)
const UPI_ID = process.env.UPI_ID || 'merchant@upi';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'Lav Mart';

// In-memory storage (persisted to disk for a simple backend).
let carts = {}; // Store carts by session/user ID
let orders = {}; // Store orders
let users = {}; // Store user accounts
let reviews = {}; // Store product reviews

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
let persistTimer = null;

function loadPersistedData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      carts = parsed.carts && typeof parsed.carts === 'object' ? parsed.carts : carts;
      orders = parsed.orders && typeof parsed.orders === 'object' ? parsed.orders : orders;
      users = parsed.users && typeof parsed.users === 'object' ? parsed.users : users;
      reviews = parsed.reviews && typeof parsed.reviews === 'object' ? parsed.reviews : reviews;
    }
  } catch (err) {
    console.error('Failed to load persisted data:', err);
  }
}

function persistNow() {
  try {
    const tmp = `${DATA_FILE}.tmp`;
    const payload = JSON.stringify({ carts, orders, users, reviews }, null, 2);
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error('Failed to persist data:', err);
  }
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow();
  }, 200);
}

loadPersistedData();

process.on('SIGINT', () => {
  persistNow();
  process.exit(0);
});
process.on('SIGTERM', () => {
  persistNow();
  process.exit(0);
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- Authentication & User API ---

// Helpers for secure authentication
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// API: Signup
app.post('/api/auth/signup', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (users[email]) return res.status(400).json({ error: 'User already exists' });
  
  const { salt, hash } = hashPassword(password);
  
  users[email] = { email, salt, hash, name, addresses: [] };
  schedulePersist();
  res.json({ message: 'Signup successful', user: { email, name, addresses: [] } });
});

// API: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  // Backward compatibility for existing plaintext passwords
  if (user.password && user.password === password) {
    const { salt, hash } = hashPassword(password);
    user.salt = salt;
    user.hash = hash;
    delete user.password;
    schedulePersist();
  } else if (user.salt && user.hash) {
    if (!verifyPassword(password, user.salt, user.hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } else {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  res.json({ message: 'Login successful', user: { email, name: user.name, addresses: user.addresses } });
});

// API: Add/Update address
app.post('/api/users/:email/addresses', (req, res) => {
  const { address } = req.body;
  const user = users[req.params.email];
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (address && !user.addresses.includes(address)) {
    user.addresses.push(address);
    schedulePersist();
  }
  res.json({ addresses: user.addresses });
});

// --- Reviews API ---

app.get('/api/reviews-summary', (req, res) => {
  const summary = {};
  for (const [product, prodReviews] of Object.entries(reviews)) {
    if (prodReviews.length > 0) {
      const total = prodReviews.reduce((sum, r) => sum + r.rating, 0);
      summary[product] = {
        average: (total / prodReviews.length).toFixed(1),
        count: prodReviews.length
      };
    }
  }
  res.json(summary);
});

app.get('/api/reviews/:productName', (req, res) => {
  const { productName } = req.params;
  res.json(reviews[productName] || []);
});

app.post('/api/reviews/:productName', (req, res) => {
  const { productName } = req.params;
  const { user, rating, comment } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Valid rating (1-5) is required' });
  }
  
  if (!reviews[productName]) reviews[productName] = [];
  
  reviews[productName].push({
    user: user || 'Anonymous',
    rating: Number(rating),
    comment: comment || '',
    date: new Date()
  });
  
  schedulePersist();
  res.json({ message: 'Review added successfully', reviews: reviews[productName] });
});

// --- Cart API ---

// Get or create cart for user
const getOrCreateCart = (userId) => {
  if (!carts[userId]) {
    carts[userId] = { items: [], total: 0 };
  }
  return carts[userId];
};

// API: Get cart
app.get('/api/cart/:userId', (req, res) => {
  const { userId } = req.params;
  const cart = getOrCreateCart(userId);
  res.json(cart);
});

// API: Add to cart
app.post('/api/cart/:userId/add', (req, res) => {
  const { userId } = req.params;
  const { name, price } = req.body;
  
  const cart = getOrCreateCart(userId);
  cart.items.push({ id: uuidv4(), name, price });
  cart.total += price;
  schedulePersist();
  
  res.json({ message: 'Item added to cart', cart });
});

// API: Remove item from cart
app.delete('/api/cart/:userId/:itemId', (req, res) => {
  const { userId, itemId } = req.params;
  const cart = getOrCreateCart(userId);
  
  const item = cart.items.find(i => i.id === itemId);
  if (item) {
    cart.total -= item.price;
    cart.items = cart.items.filter(i => i.id !== itemId);
  }
  schedulePersist();
  
  res.json({ message: 'Item removed from cart', cart });
});

// API: Clear cart
app.delete('/api/cart/:userId', (req, res) => {
  const { userId } = req.params;
  carts[userId] = { items: [], total: 0 };
  schedulePersist();
  res.json({ message: 'Cart cleared' });
});

// API: Generate QR Code for UPI Payment
app.post('/api/qr/generate', async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // UPI string format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tr=TRANSACTION_ID&tn=NOTE
    const upiString = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&tr=${orderId}&tn=Payment%20for%20Order%20${orderId}`;

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(upiString);

    res.json({
      orderId,
      amount,
      qrCode: qrCodeDataUrl,
      upiId: UPI_ID,
      message: `Scan this QR code to pay ₹${amount}. Transaction ID: ${orderId}`
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Error generating QR code' });
  }
});

// API: Create Razorpay order
app.post('/api/orders/create', (req, res) => {
  try {
    const { userId, amount, email, phone } = req.body;

    if (!razorpay) {
      return res.status(400).json({
        error: 'Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment.'
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1
    };

    razorpay.orders.create(options, (err, order) => {
      if (err) {
        console.error('Razorpay order creation failed:', err);
        const message =
          err?.error?.description ||
          err?.error?.reason ||
          err?.message ||
          'Razorpay order creation failed';
        return res.status(502).json({ error: message });
      }

      // Store order details
      orders[order.id] = {
        orderId: order.id,
        userId,
        amount,
        email,
        phone,
        items: getOrCreateCart(userId).items,
        status: 'pending',
        paymentMethod: 'razorpay',
        createdAt: new Date(),
        address: req.body.address || ''
      };
      schedulePersist();

      res.json({
        orderId: order.id,
        amount,
        currency: 'INR',
        key: RAZORPAY_KEY_ID
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Verify UPI Payment (manual verification)
app.post('/api/payments/verify-upi', (req, res) => {
  try {
    const { orderId, transactionId, upiId, userId, amount, email, phone } = req.body;

    if (!orderId || !transactionId) {
      return res.status(400).json({ success: false, message: 'Missing transaction details' });
    }

    // Create new order if not exists
    if (!orders[orderId]) {
      orders[orderId] = {
        orderId,
        userId: userId || 'upi_user',
        amount: typeof amount === 'number' ? amount : 0,
        email: email || '',
        phone: phone || '',
        items: [],
        status: 'completed',
        paymentMethod: 'upi',
        transactionId,
        upiId: upiId || UPI_ID,
        createdAt: new Date(),
        address: req.body.address || ''
      };
    } else {
      orders[orderId].status = 'completed';
      orders[orderId].paymentMethod = 'upi';
      orders[orderId].transactionId = transactionId;
      if (upiId) orders[orderId].upiId = upiId;
    }
    schedulePersist();

    res.json({
      success: true,
      message: 'UPI Payment verified successfully',
      orderId,
      transactionId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// API: Verify payment (Razorpay)
app.post('/api/payments/verify', (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!RAZORPAY_KEY_SECRET) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay is not configured. Set RAZORPAY_KEY_SECRET in your environment.'
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature === signature) {
      // Payment verified
      if (orders[orderId]) {
        orders[orderId].status = 'completed';
        orders[orderId].paymentId = paymentId;
        const userId = orders[orderId].userId;
        
        // Clear cart after successful payment
        carts[userId] = { items: [], total: 0 };
        schedulePersist();
        
        res.json({ 
          success: true, 
          message: 'Payment verified successfully',
          orderId
        });
      } else {
        res.status(400).json({ success: false, message: 'Order not found' });
      }
    } else {
      res.status(400).json({ success: false, message: 'Invalid signature' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// API: Get order details
app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders[orderId];
  
  if (order) {
    res.json(order);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// API: Get user orders
app.get('/api/orders/user/:userId', (req, res) => {
  const { userId } = req.params;
  const userOrders = Object.values(orders).filter(o => o.userId === userId);
  res.json(userOrders);
});

// --- Admin API ---
let products = [
  { id: "p1", name: "Aloo Bhujia (Sale)", price: 22, originalPrice: 30, badge: "🔥 SALE!", badgeColor: "#dc3545" },
  { id: "p2", name: "Bikaneri Bhujia", price: 35 },
  { id: "p3", name: "Ratlami Sev", price: 25 },
  { id: "p4", name: "Nylon Sev", price: 28 },
  { id: "p5", name: "Dry Fruit Mixture (Deal)", price: 55, originalPrice: 80, badge: "⏳ LIMITED TIME DEAL", badgeColor: "#333", badgeBg: "#ffc107", borderColor: "#ffc107" }
];

// In loadPersistedData, we could also load products if we saved them
// but for simplicity we'll just keep them in memory for this session

app.get('/api/admin/products', (req, res) => res.json(products));

app.post('/api/admin/products', (req, res) => {
  const { id, name, price, originalPrice, badge } = req.body;
  if (id) {
    // Edit
    const p = products.find(p => p.id === id);
    if (p) {
      p.name = name;
      p.price = Number(price);
      if (originalPrice) p.originalPrice = Number(originalPrice);
      if (badge) p.badge = badge;
    }
  } else {
    // Add
    products.push({
      id: 'p_' + Date.now(),
      name,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      badge: badge || undefined
    });
  }
  schedulePersist();
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', (req, res) => {
  products = products.filter(p => p.id !== req.params.id);
  schedulePersist();
  res.json({ success: true });
});

app.get('/api/admin/orders', (req, res) => {
  res.json(Object.values(orders).reverse());
});

app.get('/api/admin/users', (req, res) => {
  res.json(Object.values(users).map(u => ({ email: u.email, name: u.name, addresses: u.addresses })));
});

let sslOptions = null;
try {
  const keyPath = path.join(__dirname, 'key.pem');
  const certPath = path.join(__dirname, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    sslOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }
} catch (e) {
  console.log('Error reading SSL certs:', e.message);
}

const printServerInfo = (protocol) => {
  console.log(`🛒 Lav Mart Server running at ${protocol}://${HOST}:${PORT}`);
  console.log(`👨‍💻 Admin Panel at: ${protocol}://${HOST}:${PORT}/admin.html`);
  console.log(`\n💳 Payment Methods:`);
  console.log(`  1️⃣  Razorpay: Key ${RAZORPAY_KEY_ID}`);
  console.log(`  2️⃣  UPI QR Code: Scan to pay`);
  console.log(`\n🧪 Test Razorpay Card: 4111 1111 1111 1111 | Any future date | Any CVV`);
};

// Serve Admin Panel
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin.js', (req, res) => res.sendFile(path.join(__dirname, 'admin.js')));

if (sslOptions) {
  https.createServer(sslOptions, app).listen(PORT, HOST, () => {
    console.log(`🔒 SSL Certificates found. Running securely via HTTPS.`);
    printServerInfo('https');
  });
} else {
  app.listen(PORT, HOST, () => {
    console.log(`⚠️  Warning: Running without SSL. For HTTPS, place key.pem and cert.pem in the root directory.`);
    printServerInfo('http');
  });
}
