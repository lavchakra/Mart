function showPanel(panelId) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    
    document.getElementById(panelId).classList.add('active');
    event.target.classList.add('active');
    
    if (panelId === 'products') loadProducts();
    if (panelId === 'orders') loadOrders();
    if (panelId === 'users') loadUsers();
}

async function loadDashboard() {
    try {
        const [ordersRes, usersRes] = await Promise.all([
            fetch('/api/admin/orders'),
            fetch('/api/admin/users')
        ]);
        const orders = await ordersRes.json();
        const users = await usersRes.json();
        
        document.getElementById('dashOrders').textContent = orders.length;
        document.getElementById('dashUsers').textContent = users.length;
        
        const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
        document.getElementById('dashRevenue').textContent = '₹' + totalRevenue;
    } catch (e) {
        console.error('Failed to load dashboard', e);
    }
}

async function loadProducts() {
    try {
        const res = await fetch('/api/admin/products');
        const products = await res.json();
        const tbody = document.getElementById('productsTableBody');
        tbody.innerHTML = '';
        
        products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.badge ? `<span style="background:${p.badgeColor||'red'}; color:white; padding:2px 5px; font-size:10px; border-radius:3px; margin-right:5px;">${p.badge}</span>` : ''}${p.name}</td>
                <td>₹${p.price} ${p.originalPrice ? `<span style="text-decoration:line-through; color:#888; font-size:12px;">₹${p.originalPrice}</span>` : ''}</td>
                <td>
                    <button class="action-btn" style="background:#ffc107; color:#333; border:none; border-radius:3px; cursor:pointer;" onclick="editProduct('${p.id}')">Edit</button>
                    <button class="action-btn" style="background:#dc3545; color:white; border:none; border-radius:3px; cursor:pointer;" onclick="deleteProduct('${p.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Failed to load products', e);
    }
}

async function loadOrders() {
    try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        const tbody = document.getElementById('ordersTableBody');
        tbody.innerHTML = '';
        
        orders.forEach(o => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${o.orderId}</td>
                <td>${o.email || o.userId}</td>
                <td>₹${o.amount}</td>
                <td><span style="background:${o.status === 'completed' ? '#28a745' : '#ffc107'}; color:${o.status === 'completed' ? 'white' : '#333'}; padding:3px 8px; border-radius:10px; font-size:12px;">${o.status}</span></td>
                <td>${new Date(o.createdAt).toLocaleString()}</td>
                <td><button class="action-btn" style="background:#17a2b8; color:white; border:none; border-radius:3px; cursor:pointer;" onclick="alert('Items: ${o.items.map(i=>i.name).join(', ')}')">View Items</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Failed to load orders', e);
    }
}

async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.name || 'N/A'}</td>
                <td>${u.email}</td>
                <td>${u.addresses ? u.addresses.length : 0}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Failed to load users', e);
    }
}

// Product Modal Logic
let editProductId = null;

function showAddProductModal() {
    editProductId = null;
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productModal').style.display = 'flex';
}

async function editProduct(id) {
    try {
        const res = await fetch('/api/admin/products');
        const products = await res.json();
        const product = products.find(p => p.id === id);
        
        if (product) {
            editProductId = id;
            document.getElementById('prodId').value = id;
            document.getElementById('prodName').value = product.name;
            document.getElementById('prodPrice').value = product.price;
            document.getElementById('prodOriginalPrice').value = product.originalPrice || '';
            document.getElementById('prodBadge').value = product.badge || '';
            document.getElementById('prodImage').value = product.image || '';
            updateImagePreview(product.image || '');
            
            document.getElementById('productModalTitle').textContent = 'Edit Product';
            document.getElementById('productModal').style.display = 'flex';
        }
    } catch (e) {
        console.error('Failed to load product for editing', e);
    }
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

async function saveProduct(e) {
    e.preventDefault();
    
    const id = document.getElementById('prodId').value;
    const name = document.getElementById('prodName').value;
    const price = document.getElementById('prodPrice').value;
    const originalPrice = document.getElementById('prodOriginalPrice').value;
    const badge = document.getElementById('prodBadge').value;
    const image = document.getElementById('prodImage').value;
    
    try {
        await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, price, originalPrice, badge, image })
        });
        
        closeProductModal();
        loadProducts(); // Refresh list
    } catch (err) {
        console.error('Failed to save product', err);
        alert('Failed to save product');
    }
}

async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await fetch('/api/admin/products/' + id, { method: 'DELETE' });
            loadProducts();
        } catch (e) {
            console.error('Failed to delete', e);
        }
    }
}

function updateImagePreview(url) {
    const preview = document.getElementById('imagePreview');
    if (url) {
        preview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        preview.innerHTML = `<span style="color:#999; font-size:12px;">No Preview Available</span>`;
    }
}

// Load initial data
window.onload = loadDashboard;
