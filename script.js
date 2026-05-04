// Client-side JavaScript for Lav Mart

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let anonymousUserId = localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('userId', anonymousUserId);

const getCartUserId = () => currentUser ? currentUser.email : anonymousUserId;

// Current order details
let currentOrder = null;

// Cart storage key
const getCartKey = () => `cart_${getCartUserId()}`;

async function tryJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchCartFromServer() {
  const response = await fetch(`/api/cart/${encodeURIComponent(getCartUserId())}`);
  if (!response.ok) throw new Error('Failed to fetch cart');
  const data = await tryJson(response);
  if (!data) throw new Error('Invalid cart response');
  return data;
}

async function addItemToServerCart(name, price) {
  const response = await fetch(`/api/cart/${encodeURIComponent(getCartUserId())}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, price })
  });
  const data = await tryJson(response);
  if (!response.ok) throw new Error(data?.error || 'Failed to add item');
  return data?.cart || { items: [], total: 0 };
}

async function removeItemFromServerCart(itemId) {
  const response = await fetch(`/api/cart/${encodeURIComponent(getCartUserId())}/${encodeURIComponent(itemId)}`, {
    method: 'DELETE'
  });
  const data = await tryJson(response);
  if (!response.ok) throw new Error(data?.error || 'Failed to remove item');
  return data?.cart || { items: [], total: 0 };
}

async function clearServerCart() {
  try {
    await fetch(`/api/cart/${encodeURIComponent(getCartUserId())}`, { method: 'DELETE' });
  } catch {
    // ignore
  }
}

// Get cart from localStorage
function getCart() {
  const cartData = localStorage.getItem(getCartKey());
  if (cartData) {
    return JSON.parse(cartData);
  }
  return { items: [], total: 0 };
}

// Save cart to localStorage
function saveCart(cart) {
  localStorage.setItem(getCartKey(), JSON.stringify(cart));
}

// Display user ID and auth state
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  attachProductClickEvents();
  initScrollReveal();
  
  // Add payment method change listener
  const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
  paymentMethods.forEach(method => {
    method.addEventListener('change', (e) => {
      updatePaymentButtonVisibility(e.target.value);
    });
  });
});

// Scroll Reveal Initialization
function initScrollReveal() {
  const revealElements = document.querySelectorAll('[data-reveal]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1
  });
  
  revealElements.forEach(el => observer.observe(el));
}

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
  (async () => {
    try {
      const cart = await addItemToServerCart(name, price);
      saveCart(cart);
      updateCartDisplay(cart.items, cart.total);
      showNotification(`✅ ${name} added to cart!`);
    } catch (error) {
      console.error('Server cart add failed, falling back to local cart:', error);
      const cart = getCart();
      cart.items.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name, price });
      cart.total += price;
      saveCart(cart);
      updateCartDisplay(cart.items, cart.total);
      showNotification(`✅ ${name} added to cart!`);
    }
  })();
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
  (async () => {
    try {
      const cart = await fetchCartFromServer();
      saveCart(cart);
      updateCartDisplay(cart.items, cart.total);
    } catch (error) {
      console.error('Server cart load failed, using local cart:', error);
      const cart = getCart();
      updateCartDisplay(cart.items, cart.total);
    }
  })();
}

// Function to remove item from cart
function removeFromCart(itemId) {
  (async () => {
    try {
      const cart = await removeItemFromServerCart(itemId);
      saveCart(cart);
      updateCartDisplay(cart.items, cart.total);
    } catch (error) {
      console.error('Server cart remove failed, falling back to local cart:', error);
      const cart = getCart();
      const item = cart.items.find(i => i.id === itemId);
      if (item) {
        cart.total -= item.price;
        cart.items = cart.items.filter(i => i.id !== itemId);
        saveCart(cart);
        updateCartDisplay(cart.items, cart.total);
      }
    }
  })();
}

// --- Coupon Logic ---
let appliedCoupon = null;

function applyCoupon() {
  const codeInput = document.getElementById('couponCode').value.toUpperCase().trim();
  const msg = document.getElementById('couponMessage');
  const removeBtn = document.getElementById('removeCouponBtn');
  
  if (appliedCoupon) {
    msg.textContent = 'A coupon is already applied!';
    msg.style.color = 'red';
    return;
  }
  
  if (codeInput === 'LAV10') {
    appliedCoupon = { code: 'LAV10', type: 'percent', value: 10 };
    msg.textContent = '✅ LAV10 applied! 10% off.';
    msg.style.color = 'green';
    removeBtn.style.display = 'inline-block';
  } else if (codeInput === 'FESTIVAL50') {
    appliedCoupon = { code: 'FESTIVAL50', type: 'flat', value: 50 };
    msg.textContent = '✅ FESTIVAL50 applied! ₹50 off.';
    msg.style.color = 'green';
    removeBtn.style.display = 'inline-block';
  } else {
    msg.textContent = '❌ Invalid coupon code.';
    msg.style.color = 'red';
    return;
  }
  
  loadCart(); // Refresh cart to update totals
}

function removeCoupon() {
  appliedCoupon = null;
  document.getElementById('couponCode').value = '';
  document.getElementById('couponMessage').textContent = '';
  document.getElementById('removeCouponBtn').style.display = 'none';
  loadCart();
}

// Function to update cart display
function updateCartDisplay(items, total) {
  const cartList = document.getElementById('cart');
  const totalHeader = document.getElementById('totalHeader');
  const finalAmountInput = document.getElementById('finalAmount');

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

  let finalTotal = total;
  let discountHtml = '';

  if (appliedCoupon && total > 0) {
    let discountAmount = 0;
    if (appliedCoupon.type === 'percent') {
      discountAmount = (total * appliedCoupon.value) / 100;
    } else if (appliedCoupon.type === 'flat') {
      discountAmount = appliedCoupon.value;
    }
    
    if (discountAmount > total) discountAmount = total; // No negative totals
    finalTotal = total - discountAmount;
    discountHtml = `<div style="color: green; font-size: 14px; margin-top: 5px;">Discount (${appliedCoupon.code}): -₹${Math.round(discountAmount)}</div>`;
  }

  finalAmountInput.value = Math.round(finalTotal);

  if (appliedCoupon && total > 0) {
    totalHeader.innerHTML = `Total: ₹${Math.round(finalTotal)} <span style="font-size: 14px; color: #888; text-decoration: line-through; font-weight: normal;">(was ₹${total})</span>${discountHtml}`;
  } else {
    totalHeader.innerHTML = `Total: ₹${total}`;
  }
  
  // Show/hide payment form button and coupon section
  const payButton = document.getElementById('payButton');
  const couponSection = document.getElementById('couponSection');
  if (items.length === 0) {
    payButton.style.display = 'none';
    if(couponSection) couponSection.style.display = 'none';
  } else {
    payButton.style.display = 'block';
    if(couponSection) couponSection.style.display = 'flex';
  }
}

// Show payment form
function showPaymentForm() {
  const paymentForm = document.getElementById('paymentForm');
  const payButton = document.getElementById('payButton');
  
  paymentForm.style.display = 'block';
  payButton.style.display = 'none';
  updatePaymentButtonVisibility('razorpay');
  
  if (currentUser) {
    document.getElementById('email').value = currentUser.email;
    const addrSelect = document.getElementById('savedAddresses');
    if (currentUser.addresses && currentUser.addresses.length > 0) {
      document.getElementById('savedAddressesLabel').style.display = 'block';
      addrSelect.style.display = 'block';
      addrSelect.innerHTML = '<option value="">-- Or enter new address --</option>';
      currentUser.addresses.forEach(addr => {
        const opt = document.createElement('option');
        opt.value = addr;
        opt.textContent = addr;
        addrSelect.appendChild(opt);
      });
    } else {
      document.getElementById('savedAddressesLabel').style.display = 'none';
      addrSelect.style.display = 'none';
    }
  }
}

function fillAddress() {
  const select = document.getElementById('savedAddresses');
  if (select.value) {
    document.getElementById('address').value = select.value;
  }
}

async function saveAddressIfNew(address) {
  if (currentUser && address) {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUser.email)}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const data = await res.json();
      if (data.addresses) {
        currentUser.addresses = data.addresses;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    } catch (e) {
      console.error('Failed to save address', e);
    }
  }
}

async function generateUPIQR() {
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const address = document.getElementById('address').value;
  const amount = parseInt(document.getElementById('finalAmount').value);

  if (!email || !phone || !address) {
    alert('Please enter email, phone number, and address');
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
      phone,
      address
    };

    // Save address if logged in
    saveAddressIfNew(address);

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
        userId: getCartUserId(),
        amount: currentOrder.amount,
        email: currentOrder.email,
        phone: currentOrder.phone,
        address: currentOrder.address
      })
    });

    const data = await response.json();

    if (data.success) {
      alert('✅ UPI Payment Successful!\nTransaction ID: ' + data.transactionId);
      // Clear cart from localStorage
      localStorage.removeItem(getCartKey());
      clearServerCart();
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
  if (!currentUser) document.getElementById('email').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('address').value = '';
  document.getElementById('razorpayBtn').style.display = 'block';
  document.getElementById('upiBtn').style.display = 'none';
}

// Process payment with Razorpay
async function processRazorpayPayment() {
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const address = document.getElementById('address').value;
  const amount = parseInt(document.getElementById('finalAmount').value);

  if (!email || !phone || !address) {
    alert('Please enter email, phone number, and address');
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
        userId: getCartUserId(),
        amount,
        email,
        phone,
        address
      })
    });

    const orderData = await orderResponse.json();
    
    if (orderData.error) {
      alert('Error creating order: ' + orderData.error);
      return;
    }
    
    saveAddressIfNew(address);

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
      if (!currentUser) document.getElementById('email').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('address').value = '';
      document.getElementById('paymentForm').style.display = 'none';
      document.getElementById('payButton').style.display = 'block';
      // Clear cart from localStorage
      localStorage.removeItem(getCartKey());
      clearServerCart();
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
  if (document.getElementById('productsContainer')) {
    loadProductsFrontEnd();
  }
});

// Fetch and display products from Admin API
async function loadProductsFrontEnd() {
  const container = document.getElementById('productsContainer');
  if (!container) return;
  
  try {
    const res = await fetch('/api/admin/products');
    const products = await res.json();
    
    container.innerHTML = '';
    if (products.length === 0) {
      container.innerHTML = '<p style="grid-column: 1 / -1;">No products available right now.</p>';
      loadReviewSummaries();
      return;
    }
    
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      
      let badgeHtml = '';
      if (p.badge) {
        const badgeBg = p.badgeBg || p.badgeColor || '#dc3545';
        badgeHtml = `<div class="badge" style="background: ${badgeBg}; color: white;">${p.badge}</div>`;
      }
      
      let priceHtml = `<span class="price">₹${p.price}</span>`;
      if (p.originalPrice) {
        priceHtml = `<span class="original-price">₹${p.originalPrice}</span> <span class="price">₹${p.price}</span>`;
      }
      
      let imageUrl = p.image || 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80';
      
      const btnName = p.badge ? `${p.name} (${p.badge.replace(/[^\w\s]/gi, '').trim()})` : p.name;
      
      card.innerHTML = `
        ${badgeHtml}
        <div class="product-img-wrapper">
          <img src="${imageUrl}" alt="${p.name}" class="product-img">
        </div>
        <h3>${p.name}</h3>
        <div class="price-box">
          ${priceHtml}
        </div>
        <button onclick="addToCart('${btnName}', ${p.price})" class="add-btn">Add to Cart</button>
      `;
      card.setAttribute('data-reveal', '');
      
      container.appendChild(card);
    });
    
    // Now that product H3s exist, we can inject reviews
    loadReviewSummaries();
    attachProductClickEvents();
    initScrollReveal(); // Re-init for new elements
  } catch (e) {
    console.error('Failed to load products', e);
    container.innerHTML = '<p style="grid-column: 1 / -1; color: red;">Error loading products. Please try again later.</p>';
  }
}

// --- Auth & User Account Logic ---

let isSignUp = false;

function updateUserUI() {
  const userDisplay = document.getElementById('userDisplay');
  const loginBtn = document.getElementById('loginBtn');
  const ordersBtn = document.getElementById('ordersBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  const landingPage = document.getElementById('landingPage');
  const storeContent = document.getElementById('storeContent');
  
  if (currentUser) {
    userDisplay.textContent = `Welcome, ${currentUser.name || currentUser.email.split('@')[0]}!`;
    loginBtn.style.display = 'none';
    ordersBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'inline-block';
    
    if (landingPage) landingPage.style.display = 'none';
    if (storeContent) storeContent.style.display = 'block';
  } else {
    userDisplay.textContent = '';
    loginBtn.style.display = 'inline-block';
    ordersBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    
    if (landingPage) landingPage.style.display = 'flex';
    if (storeContent) storeContent.style.display = 'none';
  }
}

function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function toggleAuthMode() {
  isSignUp = !isSignUp;
  document.getElementById('authTitle').textContent = isSignUp ? 'Sign Up' : 'Login';
  document.getElementById('authSubmitBtn').textContent = isSignUp ? 'Sign Up' : 'Login';
  document.getElementById('authToggleText').textContent = isSignUp ? 'Already have an account?' : "Don't have an account?";
  document.getElementById('authToggleLink').textContent = isSignUp ? 'Login' : 'Sign Up';
  document.getElementById('authName').style.display = isSignUp ? 'block' : 'none';
  if (isSignUp) {
    document.getElementById('authName').setAttribute('required', 'true');
  } else {
    document.getElementById('authName').removeAttribute('required');
  }
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value;
  
  const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
  const body = isSignUp ? { email, password, name } : { email, password };
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ ${data.message}`);
      currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      closeAuthModal();
      updateUserUI();
      // Reload cart to get user's persistent cart
      loadCart();
    } else {
      alert(`❌ Error: ${data.error}`);
    }
  } catch (error) {
    console.error('Auth error', error);
    alert('Authentication failed. Please try again.');
  }
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  updateUserUI();
  // Reload cart for guest session
  loadCart();
}

async function showOrdersModal() {
  if (!currentUser) return;
  const modal = document.getElementById('ordersModal');
  const list = document.getElementById('ordersList');
  modal.style.display = 'flex';
  list.innerHTML = '<p>Loading...</p>';
  
  try {
    const res = await fetch(`/api/orders/user/${encodeURIComponent(currentUser.email)}`);
    const orders = await res.json();
    
    if (orders.length === 0) {
      list.innerHTML = '<p>No orders found.</p>';
      return;
    }
    
    list.innerHTML = orders.reverse().map(o => {
      const orderDate = new Date(o.createdAt);
      const now = new Date();
      const diffMins = Math.floor((now - orderDate) / 60000);
      
      let trackStatus = 'Preparing 🍳';
      let trackPercent = 25;
      let trackColor = '#ffc107'; // Yellow
      if (diffMins >= 15) {
        trackStatus = 'Delivered 🎉';
        trackPercent = 100;
        trackColor = '#28a745'; // Green
      } else if (diffMins >= 5) {
        trackStatus = 'Out for Delivery 🛵';
        trackPercent = 65;
        trackColor = '#007bff'; // Blue
      }
      
      return `
      <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px; background: #fff;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
          <strong>Order ID: <span style="color:#555; font-weight:normal;">${o.orderId}</span></strong>
          <span style="color: #888; font-size: 12px;">${orderDate.toLocaleString()}</span>
        </div>
        <strong>Amount:</strong> ₹${o.amount}<br>
        <strong>Items:</strong> ${o.items.map(i => i.name).join(', ')}<br>
        
        <div style="margin-top:15px; padding-top:15px; border-top:1px dashed #eee;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
            <span>Tracking Status:</span>
            <span style="font-weight:bold; color:${trackColor}">${trackStatus}</span>
          </div>
          <div style="width:100%; background:#e9ecef; border-radius:10px; height:8px; overflow:hidden;">
            <div style="width:${trackPercent}%; background:${trackColor}; height:100%; transition:width 0.5s;"></div>
          </div>
        </div>
      </div>
      `;
    }).join('');
    
  } catch (e) {
    console.error('Failed to load orders', e);
    list.innerHTML = '<p>Failed to load orders.</p>';
  }
}

function closeOrdersModal() {
  document.getElementById('ordersModal').style.display = 'none';
}

// --- Reviews Logic ---

let currentReviewProduct = null;

async function loadReviewSummaries() {
  try {
    const res = await fetch('/api/reviews-summary');
    const summaries = await res.json();
    
    document.querySelectorAll('.card').forEach(card => {
      const productName = card.querySelector('h3').textContent;
      const summary = summaries[productName];
      
      const reviewDiv = document.createElement('div');
      reviewDiv.style.margin = '10px 0';
      reviewDiv.style.fontSize = '14px';
      reviewDiv.style.color = '#333';
      
      if (summary) {
        reviewDiv.innerHTML = `<span style="font-weight:bold; color:#ff7a18;">⭐ ${summary.average}</span> <span style="font-size:12px;">(${summary.count} reviews)</span> <br> <a href="javascript:void(0)" onclick="openReviewsModal('${productName}')" style="color: blue; font-size: 12px; text-decoration: underline; margin-top:5px; display:inline-block;">View/Add Reviews</a>`;
      } else {
        reviewDiv.innerHTML = `<span style="color: #777;">No reviews yet</span> <br> <a href="javascript:void(0)" onclick="openReviewsModal('${productName}')" style="color: blue; font-size: 12px; text-decoration: underline; margin-top:5px; display:inline-block;">Be the first to review</a>`;
      }
      
      // Remove old review div if it exists (for re-rendering)
      const oldReviewDiv = card.querySelector('.review-summary-div');
      if (oldReviewDiv) oldReviewDiv.remove();
      
      reviewDiv.className = 'review-summary-div';
      card.insertBefore(reviewDiv, card.querySelector('button'));
    });
  } catch (e) {
    console.error('Failed to load reviews summary', e);
  }
}

async function openReviewsModal(productName) {
  currentReviewProduct = productName;
  document.getElementById('reviewsTitle').textContent = `Reviews for ${productName}`;
  const list = document.getElementById('reviewsList');
  list.innerHTML = '<p>Loading reviews...</p>';
  document.getElementById('reviewsModal').style.display = 'flex';
  
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(productName)}`);
    const reviews = await res.json();
    
    if (reviews.length === 0) {
      list.innerHTML = '<p style="color:#777; font-size:14px;">No reviews yet. Be the first!</p>';
    } else {
      list.innerHTML = reviews.reverse().map(r => `
        <div style="background:#f9f9f9; padding:10px; border-radius:5px; margin-bottom:10px; font-size:14px;">
          <div style="font-weight:bold; margin-bottom:5px;">
            ${r.user} <span style="margin-left:10px;">${'⭐'.repeat(r.rating)}</span>
          </div>
          <div>${r.comment}</div>
          <div style="color:#999; font-size:11px; margin-top:5px;">${new Date(r.date).toLocaleDateString()}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Error fetching reviews', e);
    list.innerHTML = '<p style="color:red;">Error loading reviews.</p>';
  }
}

function closeReviewsModal() {
  document.getElementById('reviewsModal').style.display = 'none';
  document.getElementById('reviewForm').reset();
}

async function submitReview(e) {
  e.preventDefault();
  if (!currentReviewProduct) return;
  
  const rating = document.getElementById('reviewRating').value;
  const comment = document.getElementById('reviewComment').value;
  const user = currentUser ? (currentUser.name || currentUser.email.split('@')[0]) : 'Anonymous';
  
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(currentReviewProduct)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, rating, comment })
    });
    
    if (res.ok) {
      alert('✅ Review added successfully!');
      openReviewsModal(currentReviewProduct);
      document.getElementById('reviewForm').reset();
      loadReviewSummaries(); // update the stars on the homepage cards
    } else {
      const data = await res.json();
      alert(`❌ Error: ${data.error}`);
    }
  } catch (err) {
    console.error('Error submitting review', err);
    alert('Failed to submit review');
  }
}

// --- Support & Chat Logic ---

function showSupportModal() {
  document.getElementById('supportModal').style.display = 'flex';
}

function closeSupportModal() {
  document.getElementById('supportModal').style.display = 'none';
}

function submitContactForm(e) {
  e.preventDefault();
  alert('Thank you for reaching out! We will get back to you soon.');
  document.getElementById('contactName').value = '';
  document.getElementById('contactEmail').value = '';
  document.getElementById('contactMessage').value = '';
  closeSupportModal();
}

function toggleChat() {
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.style.display = (chatWindow.style.display === 'none' || chatWindow.style.display === '') ? 'flex' : 'none';
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;
  
  const messagesDiv = document.getElementById('chatMessages');
  
  // User message
  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'background:#007bff; color:white; padding:10px; border-radius:10px; max-width:80%; align-self:flex-end; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.1); margin-left:auto; word-break:break-word;';
  userMsg.textContent = message;
  messagesDiv.appendChild(userMsg);
  
  input.value = '';
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  // Bot reply simulation
  setTimeout(() => {
    const botMsg = document.createElement('div');
    botMsg.style.cssText = 'background:#e3f2fd; color:#333; padding:10px; border-radius:10px; max-width:80%; align-self:flex-start; font-size:14px; box-shadow:0 1px 2px rgba(0,0,0,0.05); word-break:break-word;';
    botMsg.textContent = "Thanks for your message! Our support agents are currently busy, but we'll get back to you shortly.";
    messagesDiv.appendChild(botMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 1000);
}

// Add enter key support for chat
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if(chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
});

// --- Product Details Modal Logic ---
let selectedProductDetails = null;
let selectedProductQty = 1;

function openProductDetails(name, price, img) {
    selectedProductDetails = { name, price, img };
    selectedProductQty = 1;
    
    document.getElementById('pdName').textContent = name;
    document.getElementById('pdPrice').textContent = '₹' + price;
    document.getElementById('pdImage').src = img;
    document.getElementById('pdQty').textContent = selectedProductQty;
    
    document.getElementById('productDetailsModal').style.display = 'flex';
}

function closeProductDetails() {
    document.getElementById('productDetailsModal').style.display = 'none';
}

function updatePdQty(change) {
    selectedProductQty += change;
    if (selectedProductQty < 1) selectedProductQty = 1;
    document.getElementById('pdQty').textContent = selectedProductQty;
}

function confirmPdAddToCart() {
    if (!selectedProductDetails) return;
    
    // Add multiple items based on quantity
    for(let i = 0; i < selectedProductQty; i++) {
        addToCart(selectedProductDetails.name, selectedProductDetails.price);
    }
    
    closeProductDetails();
    alert(`Added ${selectedProductQty}x ${selectedProductDetails.name} to cart!`);
}

function attachProductClickEvents() {
    document.querySelectorAll('.card').forEach(card => {
        if(card.dataset.hasClick) return;
        card.dataset.hasClick = "true";
        
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            if(e.target.tagName.toLowerCase() === 'button') return;
            
            const nameEl = card.querySelector('h3');
            const imgEl = card.querySelector('img');
            const priceEl = card.querySelectorAll('span')[1] || card.querySelector('p');
            
            const name = nameEl ? nameEl.textContent : 'Item';
            const img = imgEl ? imgEl.src : 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80';
            
            let price = 0;
            if (priceEl && priceEl.textContent) {
                price = parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) || 0;
            }
            
            openProductDetails(name, price, img);
        };
    });
}
