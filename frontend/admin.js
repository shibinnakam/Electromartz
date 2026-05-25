// --- Configuration (Same as app.js) ---
const AWS_CONFIG = {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_2Aw1sbuoH',
    clientId: '7pldaqon8t9d5nok2qhe0rt58n',
    apiUrl: 'https://d8xrjr2r9h.execute-api.ap-south-1.amazonaws.com/Prod/'
};

let products = [];
let categories = [];
let orders = [];
let currentBill = [];
let currentUser = null;

const poolData = {
    UserPoolId: AWS_CONFIG.userPoolId,
    ClientId: AWS_CONFIG.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

document.addEventListener('DOMContentLoaded', async () => {
    const isAuthorized = await checkAdminSession();
    if (isAuthorized) {
        initAdmin();
    } else {
        window.location.href = 'index.html';
    }
});

async function checkAdminSession() {
    if (localStorage.getItem('isAdminBypass') === 'true') return true;
    return new Promise((resolve) => {
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) return resolve(false);

        cognitoUser.getSession((err, session) => {
            if (err || !session.isValid()) return resolve(false);

            const groups = session.getIdToken().payload['cognito:groups'] || [];
            if (groups.includes('Admins')) {
                currentUser = cognitoUser;
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

function getToken() {
    if (localStorage.getItem('isAdminBypass') === 'true') return 'bypass-token';
    return new Promise((resolve, reject) => {
        if (!currentUser) return reject("No user logged in");
        currentUser.getSession((err, session) => {
            if (err) reject(err);
            else resolve(session.getIdToken().getJwtToken());
        });
    });
}

function initAdmin() {
    loadData();
    setupEventListeners();
}

async function loadData() {
    try {
        const token = await getToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        const [prodRes, catRes, ordRes] = await Promise.all([
            fetch(`${AWS_CONFIG.apiUrl}products`),
            fetch(`${AWS_CONFIG.apiUrl}categories`),
            fetch(`${AWS_CONFIG.apiUrl}orders`, { headers })
        ]);

        products = (await prodRes.json()).sort((a, b) => a.name.localeCompare(b.name));
        categories = await catRes.json();
        orders = await ordRes.json();

        renderDashboard();
    } catch (err) {
        console.error("Failed to load admin data", err);
    }
}

function renderDashboard() {
    // Stats
    document.getElementById('stat-products').innerText = products.length;
    document.getElementById('stat-categories').innerText = categories.length;

    // Recent Products Table
    const tableBody = document.getElementById('recent-products-table');
    tableBody.innerHTML = products.slice(-5).reverse().map(p => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:1rem">
                    <img src="${p.image}" style="width:40px; height:40px; border-radius:8px; object-fit:cover" onerror="this.src='https://placehold.co/40px'">
                    <span>${p.name}</span>
                </div>
            </td>
            <td>${p.category}</td>
            <td>₹${p.price}</td>
            <td><span class="admin-badge" style="background:#07c160; color:#fff">Live</span></td>
        </tr>
    `).join('') || '<tr><td colspan="4">No products found. Add your first flagships!</td></tr>';

    // Category Select in Form
    const catSelect = document.getElementById('p-category');
    catSelect.innerHTML = '<option value="">Select Category</option>' +
        categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');

    // --- NEW: Products Tab Logic ---
    // 1. Populate Filter Bar
    const filterBar = document.getElementById('product-filter-bar');
    if (filterBar) {
        filterBar.innerHTML = '<button class="filter-btn active" onclick="filterProducts(\'All\')">All Items</button>' +
            categories.map(cat => `<button class="filter-btn" onclick="filterProducts('${cat.name}')">${cat.name}</button>`).join('');
    }

    // 2. Render Initial Grid
    renderProductGrid('All');

    // 3. Render All Products Management List
    renderAllProducts();
    // --- END NEW ---



    // Category List Tags
    const catList = document.getElementById('category-list');
    catList.innerHTML = categories.map(cat => `
        <div class="category-item-managed" style="display:flex; align-items:center; gap:0.5rem; background:#f9fafb; padding:0.5rem 1rem; border-radius:8px; border:1px solid #eee">
            <span style="font-weight:600; color:var(--admin-text)">${cat.name}</span>
            <div style="display:flex; gap:0.5rem; margin-left: auto;">
                <button onclick="openEditCategoryModal('${cat.name}')" style="background:none; border:none; cursor:pointer; color:var(--admin-accent); font-size:1rem;" title="Edit">✎</button>
                <button onclick="deleteCategory('${cat.name}')" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:1.1rem;" title="Delete">🗑</button>
            </div>
        </div>
    `).join('') || '<p style="color:var(--admin-text-muted); font-size:0.9rem;">No categories yet.</p>';

    // Orders List
    const ordersList = document.getElementById('orders-list');
    const ordersArray = Array.isArray(orders) ? orders : [];
    ordersList.innerHTML = ordersArray.slice().reverse().map(o => `
        <tr>
            <td>#${o.orderId}</td>
            <td>${o.userId}</td>
            <td>₹${o.totalAmount}</td>
            <td><span class="admin-badge" style="background:${o.status === 'Pending' ? '#ffaa00' : '#07c160'}">${o.status}</span></td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="action-btn btn-edit" style="background:#F3F4F6; color:#111827" onclick="viewOrderItems('${o.orderId}')">View Items</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6">No orders yet.</td></tr>';
}

function setupEventListeners() {
    // Add Product
    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('p-name').value;
        const category = document.getElementById('p-category').value;
        const price = parseFloat(document.getElementById('p-price').value);

        // Validation
        if (price <= 0 || price > 1500) {
            alert("Price must be between 1 and 1500.");
            return;
        }

        // Duplicate Check (Name and Price)
        const isDuplicate = products.some(p =>
            p.name.trim().toLowerCase() === name.trim().toLowerCase() &&
            parseFloat(p.price) === price
        );

        if (isDuplicate) {
            alert(`A product named "${name}" with price ₹${price} already exists. Please use a different name or price.`);
            return;
        }

        const image = await getImageData(null, 'p-image-file');

        if (!image) {
            alert("Please provide a product image URL or upload a file.");
            return;
        }

        const data = {
            id: Date.now().toString(),
            name,
            category,
            price,
            image,
            createdAt: new Date().toISOString()
        };

        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert("Product added successfully!");
            e.target.reset();
            loadData();
            switchTab('overview');
        } else {
            alert("Failed to add product.");
        }
    });

    // Image utility with compression for DynamoDB limits (400KB)
    const getImageData = async (urlInputId, fileInputId) => {
        const fileInput = document.getElementById(fileInputId);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxSide = 800; // Resize to max 800px

                        if (width > height && width > maxSide) {
                            height *= maxSide / width;
                            width = maxSide;
                        } else if (height > maxSide) {
                            width *= maxSide / height;
                            height = maxSide;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Convert to compressed JPEG
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                        resolve(dataUrl);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(fileInput.files[0]);
            });
        }
        if (urlInputId) {
            const urlInput = document.getElementById(urlInputId);
            return urlInput ? urlInput.value : '';
        }
        return '';
    };

    // Add Category
    document.getElementById('add-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('c-name').value;
        if (!/^[A-Za-z\s]+$/.test(name)) {
            alert("Invalid category name. Only letters and spaces are allowed.");
            return;
        }

        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}categories`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name })
        });

        if (res.ok) {
            alert("Category created!");
            e.target.reset();
            loadData();
        } else {
            const err = await res.json();
            alert(err.message || "Error creating category");
        }
    });

    // Edit Product
    document.getElementById('edit-product-form')?.addEventListener('submit', handleEditProduct);

    // Edit Category
    document.getElementById('edit-category-form')?.addEventListener('submit', handleEditCategory);
    // Paid Checkbox logic
    document.getElementById('paid-checkbox')?.addEventListener('change', (e) => {
        const btn = document.getElementById('checkout-btn');
        if (e.target.checked) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
}

window.usbPrinter = new USBPrinter();
window.btPrinter = new BluetoothPrinter();

window.connectUSBPrinter = async () => {
    const btn = document.getElementById('connect-printer-btn');
    const connected = await window.usbPrinter.connect();
    if (connected) {
        btn.innerText = "✅ USB On";
        btn.classList.add('success');
        btn.style.background = "#10B981";
        btn.style.color = "#fff";
    } else {
        alert("Failed to connect USB printer.");
    }
};

window.connectBTPrinter = async () => {
    const btn = document.getElementById('connect-bt-btn');
    const connected = await window.btPrinter.connect();
    if (connected) {
        btn.innerText = "✅ BT On";
        btn.classList.add('success');
        btn.style.background = "#10B981";
        btn.style.color = "#fff";
    } else {
        alert("Failed to connect Bluetooth printer. Ensure Bluetooth is on, location permissions are granted, and device is paired or visible.");
    }
};


window.toggleAdminSidebar = () => {
    document.querySelector('.admin-sidebar').classList.toggle('active');
};

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

    // Close sidebar on mobile after clicking
    document.querySelector('.admin-sidebar').classList.remove('active');

    document.getElementById(tabId).classList.add('active');
    // Mark sidebar link as active
    const links = document.querySelectorAll('.sidebar-link');
    if (tabId === 'overview') links[0].classList.add('active');
    if (tabId === 'products-tab') links[1].classList.add('active');
    if (tabId === 'all-products-tab') {
        links[2].classList.add('active');
        renderAllProducts(); // Refresh on switch
    }
    if (tabId === 'categories-tab') links[3].classList.add('active');
    if (tabId === 'orders-tab') links[4].classList.add('active');
    if (tabId === 'sales-report-tab') {
        links[5].classList.add('active');
        renderSalesReport();
    }
};

window.handleLogout = () => {
    localStorage.removeItem('isAdminBypass');
    if (currentUser) {
        currentUser.signOut();
    }
    window.location.href = 'index.html';
};

// --- Products Tab Actions ---
window.toggleAddProductForm = () => {
    const container = document.getElementById('add-product-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
};

window.currentPOSCategory = 'All';
window.currentPOSSearch = '';

window.searchPOSProducts = () => {
    window.currentPOSSearch = document.getElementById('pos-search').value.toLowerCase();
    renderProductGrid(window.currentPOSCategory);
};

window.filterProducts = (category) => {
    window.currentPOSCategory = category;
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const isMatch = btn.innerText === category || (category === 'All' && btn.innerText === 'All Items');
        btn.classList.toggle('active', isMatch);
    });
    renderProductGrid(category);
};

function renderProductGrid(category) {
    const grid = document.getElementById('admin-product-grid');
    if (!grid) return;

    let filtered = category === 'All' ? products : products.filter(p => p.category === category);
    
    if (window.currentPOSSearch) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(window.currentPOSSearch));
    }

    grid.innerHTML = filtered.map(p => `
        <div class="product-card-premium" onclick="addToBill('${p.id}')">
            <img src="${p.image}" onerror="this.src='https://placehold.co/400x400?text=${p.name}'">
            <div class="product-card-overlay">
                <h4>${p.name}</h4>
                <div class="price">₹${p.price}</div>
            </div>
        </div>
    `).join('') || '<p style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #999; font-weight: 500;">No products found.</p>';
}

// --- Quick Bill Logic ---
window.addToBill = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = currentBill.find(item => item.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        currentBill.push({ ...product, qty: 1 });
    }
    updateBillUI();
};

function updateBillUI() {
    const container = document.getElementById('bill-items-container');
    const totalEl = document.getElementById('bill-total-amount');

    if (currentBill.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding-top: 2rem;">Click products to add</p>';
        totalEl.innerText = '₹0';
        return;
    }

    let total = 0;
    container.innerHTML = currentBill.map((item, index) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        return `
            <div class="bill-item">
                <div class="info">
                    <h5>${item.name}</h5>
                    <div style="display:flex; align-items:center; gap:0.6rem; margin-top:0.3rem">
                        <div style="display:flex; align-items:center; background:#f3f4f6; border-radius:6px; overflow:hidden; border:1px solid #e5e7eb">
                            <button onclick="decrementQty(${index})" style="border:none; background:none; padding:4px 10px; cursor:pointer; font-weight:bold; color:var(--admin-accent); transition:0.2s" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">-</button>
                            <span style="font-size:0.85rem; font-weight:700; min-width:24px; text-align:center; background:#fff; padding:4px 0">${item.qty}</span>
                            <button onclick="incrementQty(${index})" style="border:none; background:none; padding:4px 10px; cursor:pointer; font-weight:bold; color:var(--admin-accent); transition:0.2s" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='none'">+</button>
                        </div>
                        <p style="font-size:0.75rem; color:#6B7280; font-weight:500">@ ₹${item.price}</p>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.8rem">
                    <strong style="font-size:0.95rem; color:var(--admin-text-main)">₹${itemTotal}</strong>
                    <button class="btn secondary" style="padding: 0.3rem 0.6rem; background: #FEF2F2; color: #E31837; border-radius:8px" onclick="removeFromBill(${index})" title="Remove item">×</button>
                </div>
            </div>
        `;
    }).join('');

    totalEl.innerText = `₹${total}`;

    // Reset Paid checkbox and button state if bill is empty
    if (currentBill.length === 0) {
        const paidBox = document.getElementById('paid-checkbox');
        const checkoutBtn = document.getElementById('checkout-btn');
        if (paidBox) paidBox.checked = false;
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.style.cursor = 'not-allowed';
        }
    }
}

window.incrementQty = (index) => {
    currentBill[index].qty += 1;
    updateBillUI();
};

window.decrementQty = (index) => {
    if (currentBill[index].qty > 1) {
        currentBill[index].qty -= 1;
    } else {
        currentBill.splice(index, 1);
    }
    updateBillUI();
};


window.removeFromBill = (index) => {
    currentBill.splice(index, 1);
    updateBillUI();
};

window.printReceipt = async () => {
    if (currentBill.length === 0) {
        alert("Please add items to the bill first!");
        return;
    }

    const receiptItems = document.getElementById('receipt-items');
    const receiptTotal = document.getElementById('receipt-total-val');
    const receiptDate = document.getElementById('receipt-date');

    let total = 0;
    window.currentItemsForDB = currentBill.map((item, i) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        return {
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty
        };
    });
    window.currentTotalForDB = total;

    receiptItems.innerHTML = currentBill.map((item, i) => {
        const itemTotal = item.price * item.qty;
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td style="text-align: right;">${item.price}</td>
                <td style="text-align: right;">${itemTotal}</td>
            </tr>
        `;
    }).join('');

    receiptTotal.innerText = total;
    const now = new Date();
    receiptDate.innerText = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const printArea = document.getElementById('receipt-print');
    const previewContainer = document.getElementById('print-preview-container');
    previewContainer.innerHTML = printArea.innerHTML;
    
    document.getElementById('custom-print-modal').style.display = 'flex';
};

window.closeCustomPrintModal = () => {
    document.getElementById('custom-print-modal').style.display = 'none';
};

window.executeBluetoothPrint = async () => {
    const printerHeaderInfo = {
        address: "Nedumkandam, Padinjarekavala",
        phone: "8848782373"
    };

    try {
        if (!window.activePrinter || window.activePrinter !== window.btPrinter) {
            const connected = await window.btPrinter.connect();
            if (!connected) return;
        }

        await window.btPrinter.printReceipt({ items: window.currentItemsForDB, total: window.currentTotalForDB }, printerHeaderInfo);
        console.log("Printed via Bluetooth");
        
        finishCheckout();
    } catch (e) {
        console.error("Bluetooth Print failed", e);
        alert("Bluetooth print failed: " + e.message);
    }
};

window.executeBrowserPrint = () => {
    const printArea = document.getElementById('receipt-print');
    
    // Save order to DB
    savePOSOrder(window.currentItemsForDB, window.currentTotalForDB);

    printArea.style.display = 'block';
    
    setTimeout(() => {
        window.print();
    }, 250);

    window.addEventListener('afterprint', () => {
        printArea.style.display = 'none';
        finishCheckout(false);
    }, { once: true });

    setTimeout(() => {
        if (printArea.style.display === 'block') {
            printArea.style.display = 'none';
            finishCheckout(false);
        }
    }, 3000);
};

function finishCheckout(saveToDB = true) {
    if (saveToDB) {
        savePOSOrder(window.currentItemsForDB, window.currentTotalForDB);
    }
    closeCustomPrintModal();
    currentBill = [];
    const paidBox = document.getElementById('paid-checkbox');
    const checkoutBtn = document.getElementById('checkout-btn');
    if (paidBox) paidBox.checked = false;
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = '0.5';
        checkoutBtn.style.cursor = 'not-allowed';
    }
    updateBillUI();
}

async function savePOSOrder(items, total) {
    try {
        const token = await getToken();
        const orderData = {
            items,
            totalAmount: total,
            shippingDetails: { method: 'POS', address: 'Counter' },
            status: 'Paid'
        };

        const res = await fetch(`${AWS_CONFIG.apiUrl}orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });

        if (res.ok) {
            console.log("POS Order saved successfully");
            // Refresh data to show in orders tab
            loadData();
        }
    } catch (err) {
        console.error("Error saving POS order", err);
    }
}

window.openEditCategoryModal = (name) => {
    document.getElementById('edit-c-old-name').value = name;
    document.getElementById('edit-c-new-name').value = name;
    document.getElementById('edit-category-modal').classList.add('active');
};

window.closeEditCategoryModal = () => {
    document.getElementById('edit-category-modal').classList.remove('active');
};

window.handleEditCategory = async (e) => {
    e.preventDefault();
    const oldName = document.getElementById('edit-c-old-name').value;
    const newName = document.getElementById('edit-c-new-name').value;

    if (!/^[A-Za-z\s]+$/.test(newName)) {
        alert("Invalid category name. Only letters and spaces are allowed.");
        return;
    }

    const token = await getToken();
    const res = await fetch(`${AWS_CONFIG.apiUrl}categories/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newName })
    });

    if (res.ok) {
        alert("Category updated and products moved successfully!");
        closeEditCategoryModal();
        loadData();
    } else {
        const err = await res.json();
        alert(err.message || "Error updating category");
    }
};

window.deleteCategory = async (name) => {
    if (!confirm(`Are you sure you want to delete the category "${name}"? Products in this category will remain but will be uncategorized.`)) return;

    const token = await getToken();
    const res = await fetch(`${AWS_CONFIG.apiUrl}categories/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (res.ok) {
        alert("Category deleted successfully!");
        loadData();
    } else {
        const err = await res.json();
        alert(err.message || "Error deleting category");
    }
};

window.searchInventoryProducts = () => {
    const query = document.getElementById('inventory-search').value.toLowerCase();
    renderAllProducts(query);
};

function renderAllProducts(searchQuery = '') {
    const tableBody = document.getElementById('all-products-list');
    if (!tableBody) return;

    let filtered = products;
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(query));
    }

    tableBody.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:1rem">
                    <img src="${p.image}" style="width:40px; height:40px; border-radius:8px; object-fit:cover" onerror="this.src='https://placehold.co/40px'">
                    <span>${p.name}</span>
                </div>
            </td>
            <td>${p.category}</td>
            <td>₹${p.price}</td>
            <td>
                <button class="action-btn btn-edit" onclick="openEditModal('${p.id}')">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteProduct('${p.id}')">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4">No products found.</td></tr>';
}

window.openEditModal = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('edit-p-id').value = product.id;
    document.getElementById('edit-p-name').value = product.name;
    document.getElementById('edit-p-price').value = product.price;

    const catSelect = document.getElementById('edit-p-category');
    catSelect.innerHTML = categories.map(cat => `<option value="${cat.name}" ${cat.name === product.category ? 'selected' : ''}>${cat.name}</option>`).join('');

    document.getElementById('edit-modal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

async function handleEditProduct(e) {
    e.preventDefault();
    const id = document.getElementById('edit-p-id').value;
    const name = document.getElementById('edit-p-name').value;
    const category = document.getElementById('edit-p-category').value;
    const price = parseFloat(document.getElementById('edit-p-price').value);

    const product = products.find(p => p.id === id);
    const updatedData = {
        ...product,
        name,
        category,
        price
    };

    try {
        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}products/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });

        if (res.ok) {
            alert("Product updated successfully!");
            closeEditModal();
            loadData();
        } else {
            alert("Failed to update product.");
        }
    } catch (err) {
        console.error(err);
        alert("Error updating product.");
    }
}

window.deleteProduct = async (productId) => {
    if (!confirm("Are you sure you want to permanently delete this product?")) return;

    try {
        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            alert("Product deleted successfully!");
            loadData();
        } else {
            alert("Failed to delete product.");
        }
    } catch (err) {
        console.error(err);
        alert("Error deleting product.");
    }
};

window.clearReportFilters = () => {
    document.getElementById('report-date').value = '';
    document.getElementById('report-month').value = '';
    renderSalesReport();
};

window.renderSalesReport = () => {
    const tableBody = document.getElementById('sales-report-table');
    const grandTotalEl = document.getElementById('report-grand-total');
    const orderCountEl = document.getElementById('report-order-count');
    if (!tableBody) return;

    const selectedDate = document.getElementById('report-date').value;
    const selectedMonth = document.getElementById('report-month').value;

    const ordersArray = Array.isArray(orders) ? orders : [];

    // Filter orders
    let filteredOrders = ordersArray;
    if (selectedDate) {
        filteredOrders = filteredOrders.filter(o => o.createdAt.startsWith(selectedDate));
    } else if (selectedMonth) {
        filteredOrders = filteredOrders.filter(o => o.createdAt.startsWith(selectedMonth));
    }

    // Aggregate by item name
    const itemMap = {};
    let grandTotal = 0;

    filteredOrders.forEach(order => {
        grandTotal += order.totalAmount || 0;
        (order.items || []).forEach(item => {
            const key = item.name;
            if (!itemMap[key]) {
                itemMap[key] = {
                    name: item.name,
                    price: item.price,
                    qty: 0,
                    total: 0
                };
            }
            itemMap[key].qty += (item.qty || 1);
            itemMap[key].total += (item.price * (item.qty || 1));
        });
    });

    const reportItems = Object.values(itemMap).sort((a, b) => b.total - a.total);

    tableBody.innerHTML = reportItems.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>₹${item.price}</td>
            <td>${item.qty}</td>
            <td><strong>₹${item.total}</strong></td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding:2rem; color:#999">No sales found for the selected period.</td></tr>';

    grandTotalEl.innerText = `₹${grandTotal}`;
    orderCountEl.innerText = filteredOrders.length;
};

window.viewOrderItems = (orderId) => {
    const order = orders.find(o => o.orderId === orderId);
    if (!order || !order.items) return;

    const container = document.getElementById('order-items-list-container');
    container.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${order.items.map(item => `
                    <tr>
                        <td>${item.name}</td>
                        <td>${item.qty}</td>
                        <td>₹${item.price}</td>
                        <td>₹${item.price * item.qty}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('order-items-modal').style.display = 'flex';
};

window.closeOrderItemsModal = () => {
    document.getElementById('order-items-modal').style.display = 'none';
};
