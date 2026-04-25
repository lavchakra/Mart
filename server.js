const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

// UPI details for QR (merchant details)
const UPI_ID = process.env.UPI_ID || 'merchant@upi';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'Lav Mart';

// In-memory storage
let carts = {}; // Store carts by session/user ID
let orders = {}; // Store orders

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
  
  res.json({ message: 'Item removed from cart', cart });
});

// API: Clear cart
app.delete('/api/cart/:userId', (req, res) => {
  const { userId } = req.params;
  carts[userId] = { items: [], total: 0 };
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
        createdAt: new Date()
      };

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
        createdAt: new Date()
      };
    } else {
      orders[orderId].status = 'completed';
      orders[orderId].paymentMethod = 'upi';
      orders[orderId].transactionId = transactionId;
      if (upiId) orders[orderId].upiId = upiId;
    }

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

app.listen(PORT, () => {
  console.log(`🛒 Lav Mart Server running at http://localhost:${PORT}`);
  console.log(`\n💳 Payment Methods:`);
  console.log(`  1️⃣  Razorpay: Key ${RAZORPAY_KEY_ID}`);
  console.log(`  2️⃣  UPI QR Code: Scan to pay`);
  console.log(`\n🧪 Test Razorpay Card: 4111 1111 1111 1111 | Any future date | Any CVV`);
});
