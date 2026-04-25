// Client-side JavaScript for Lav Mart

// Generate unique user ID for session
const userId = localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('userId', userId);

// Current order details
let currentOrder = null;

// Cart storage key
const CART_KEY = `cart_${userId}`;

// Get cart from localStorage
function getCart() {
  const cartData = localStorage.getItem(CART_KEY);
  if (cartData) {
    return JSON.parse(cartData);
  }
  return { items: [], total: 0 };
}

// Save cart to localStorage
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// Display user ID
document.addEventListener('DOMContentLoaded', () => {
  const userDisplay = document.getElementById('userDisplay');
  if (userDisplay) {
    userDisplay.textContent = `User: ${userId.substring(0, 15)}...`;
  }
  
  // Add payment method change listener
  const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
  paymentMethods.forEach(method => {
    method.addEventListener('change', (e) => {
      updatePaymentButtonVisibility(e.target.value);
    });
  });
});

// Update button visibility based on payment method
function updatePaymentButtonVisibility(method) {
  const razorpayBtn = document.getElementById('razorpayBtn');
  const upiBtn = document.getElementById('upiBtn');
  
  if (method === 'razorpay') {
    razorpayBtn.style.display = 'block';
    upiBtn.style.display = 'none';
  } else {
    razorpayBtn.style.display = 'none';
    upiBtn.style.display = 'block';
  }
}

// Function to add item to cart
function addToCart(name, price) {
  try {
    const cart = getCart();
    cart.items.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name, price });
    cart.total += price;
    saveCart(cart);
    loadCart();
    showNotification(`✅ ${name} added to cart!`);
  } catch (error) {
    console.error('Error adding to cart:', error);
    // alert('Error adding item to cart');
  }
}

// Show notification
function showNotification(message) {
  // Remove existing notification
  const existing = document.getElementById('cart-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'cart-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    font-weight: bold;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Function to load and display cart
function loadCart() {
  try {
    const cart = getCart();
    updateCartDisplay(cart.items, cart.total);
  } catch (error) {
    console.error('Error loading cart:', error);
  }
}

// Function to remove item from cart
function removeFromCart(itemId) {
  try {
    const cart = getCart();
    const item = cart.items.find(i => i.id === itemId);
    if (item) {
      cart.total -= item.price;
      cart.items = cart.items.filter(i => i.id !== itemId);
      saveCart(cart);
      loadCart();
    }
  } catch (error) {
    console.error('Error removing item:', error);
  }
}

// Function to update cart display
function updateCartDisplay(items, total) {
  const cartList = document.getElementById('cart');
  const totalSpan = document.getElementById('total');

  cartList.innerHTML = '';
  
  if (items.length === 0) {
    cartList.innerHTML = '<li style="color: #999;">Cart is empty</li>';
  } else {
    items.forEach(item => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.padding = '8px 0';
      li.style.borderBottom = '1px solid #eee';
      
      const itemText = document.createElement('span');
      itemText.textContent = `${item.name} - ₹${item.price}`;
      
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕ Remove';
      removeBtn.style.background = '#ff4444';
      removeBtn.style.color = 'white';
      removeBtn.style.border = 'none';
      removeBtn.style.padding = '4px 8px';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.borderRadius = '3px';
      removeBtn.onclick = () => removeFromCart(item.id);
      
      li.appendChild(itemText);
      li.appendChild(removeBtn);
      cartList.appendChild(li);
    });
  }

  totalSpan.textContent = total;
  
  // Show/hide payment form button
  const payButton = document.getElementById('payButton');
  if (items.length === 0) {
    payButton.style.display = 'none';
  } else {
    payButton.style.display = 'block';
  }
}

// Show payment form
function showPaymentForm() {
  const paymentForm = document.getElementById('paymentForm');
  const payButton = document.getElementById('payButton');
  
  paymentForm.style.display = 'block';
  payButton.style.display = 'none';
  updatePaymentButtonVisibility('razorpay');
}

// Generate UPI QR Code
async function generateUPIQR() {
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const totalSpan = document.getElementById('total');
  const amount = parseInt(totalSpan.textContent);

  if (!email || !phone) {
    alert('Please enter email and phone number');
    return;
  }

  try {
    // Create a temporary order ID for QR
    const orderId = 'upi_' + Date.now();
    
    const response = await fetch('/api/qr/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        orderId,
        email
      })
    });

    const data = await response.json();

    if (data.error) {
      alert('Error generating QR code: ' + data.error);
      return;
    }

    // Store current order details
    currentOrder = {
      orderId: data.orderId,
      amount: data.amount,
      email,
      phone
    };

    // Display QR code
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrImage = document.getElementById('qrCodeImage');
    const qrMessage = document.getElementById('qrMessage');
    const paymentForm = document.getElementById('paymentForm');

    qrImage.src = data.qrCode;
    qrMessage.textContent = data.message;
    
    paymentForm.style.display = 'none';
    qrContainer.style.display = 'block';
  } catch (error) {
    console.error('Error generating QR code:', error);
    alert('Error generating QR code');
  }
}

// Confirm UPI Payment
async function confirmUPIPayment() {
  if (!currentOrder) {
    alert('Order not found');
    return;
  }

  try {
    const response = await fetch('/api/payments/verify-upi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId: currentOrder.orderId,
        transactionId: 'manual_' + Date.now(),
        upiId: 'merchant@upi',
        userId,
        amount: currentOrder.amount,
        email: currentOrder.email,
        phone: currentOrder.phone
      })
    });

    const data = await response.json();

    if (data.success) {
      alert('✅ UPI Payment Successful!\nTransaction ID: ' + data.transactionId);
      // Clear cart from localStorage
      localStorage.removeItem(CART_KEY);
      loadCart();
      backToPayment();
      document.getElementById('paymentForm').style.display = 'none';
      document.getElementById('payButton').style.display = 'block';
    } else {
      alert('❌ Payment verification failed: ' + data.message);
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    alert('Error verifying payment');
  }
}

// Back to payment form
function backToPayment() {
  const paymentForm = document.getElementById('paymentForm');
  const qrContainer = document.getElementById('qrCodeContainer');
  
  qrContainer.style.display = 'none';
  paymentForm.style.display = 'block';
  document.getElementById('email').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('razorpayBtn').style.display = 'block';
  document.getElementById('upiBtn').style.display = 'none';
}

// Process payment with Razorpay
async function processRazorpayPayment() {
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const totalSpan = document.getElementById('total');
  const amount = parseInt(totalSpan.textContent);

  if (!email || !phone) {
    alert('Please enter email and phone number');
    return;
  }

  try {
    // Create order on backend
    const orderResponse = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        amount,
        email,
        phone
      })
    });

    const orderData = await orderResponse.json();
    
    if (orderData.error) {
      alert('Error creating order: ' + orderData.error);
      return;
    }

    // Razorpay payment options
    const options = {
      key: orderData.key,
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      name: 'Lav Mart',
      description: 'Namkeen & Snacks',
      order_id: orderData.orderId,
      prefill: {
        name: 'Customer',
        email: email,
        contact: phone
      },
      handler: function(response) {
        verifyRazorpayPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      },
      modal: {
        ondismiss: function() {
          alert('Payment cancelled');
        }
      }
    };

    // Open Razorpay checkout
    const razorpay = new Razorpay(options);
    razorpay.open();
  } catch (error) {
    console.error('Error processing payment:', error);
    alert('Error processing payment');
  }
}

// Verify Razorpay payment signature
async function verifyRazorpayPayment(orderId, paymentId, signature) {
  try {
    const response = await fetch('/api/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId,
        paymentId,
        signature
      })
    });

    const data = await response.json();
    
    if (data.success) {
      alert('✅ Payment Successful! Order ID: ' + orderId);
      // Clear form and reload cart
      document.getElementById('email').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('paymentForm').style.display = 'none';
      document.getElementById('payButton').style.display = 'block';
      // Clear cart from localStorage
      localStorage.removeItem(CART_KEY);
      loadCart();
    } else {
      alert('❌ Payment verification failed: ' + data.message);
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    alert('Error verifying payment');
  }
}

// Load cart on page load
window.addEventListener('load', () => {
  loadCart();
});
