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

        products = await prodRes.json();
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
    // --- END NEW ---



    // Category List Tags
    const catList = document.getElementById('category-list');
    catList.innerHTML = categories.map(cat => {
        return `<span class="category-tag">${cat.name}</span>`;
    }).join('');

    // Orders List
    const ordersList = document.getElementById('orders-list');
    ordersList.innerHTML = orders.slice().reverse().map(o => `
        <tr>
            <td>#${o.orderId}</td>
            <td>${o.userId}</td>
            <td>₹${o.totalAmount}</td>
            <td><span class="admin-badge" style="background:${o.status === 'Pending' ? '#ffaa00' : '#07c160'}">${o.status}</span></td>
            <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        </tr>
    `).join('') || '<tr><td colspan="5">No orders yet.</td></tr>';
}

function setupEventListeners() {
    // Add Product
    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('p-name').value;
        const category = document.getElementById('p-category').value;
        const price = parseFloat(document.getElementById('p-price').value);
        
        // Validation
        if (price <= 0 || price > 1000) {
            alert("Price must be between 1 and 1000.");
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

    // Image utility
    const getImageData = async (urlInputId, fileInputId) => {
        const fileInput = document.getElementById(fileInputId);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
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


}

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    // Mark sidebar link as active
    const links = document.querySelectorAll('.sidebar-link');
    if (tabId === 'overview') links[0].classList.add('active');
    if (tabId === 'products-tab') links[1].classList.add('active');
    if (tabId === 'categories-tab') links[2].classList.add('active');
    if (tabId === 'orders-tab') links[3].classList.add('active');
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

window.filterProducts = (category) => {
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

    const filtered = category === 'All' ? products : products.filter(p => p.category === category);
    
    grid.innerHTML = filtered.slice().reverse().map(p => `
        <div class="product-card-premium">
            <img src="${p.image}" onerror="this.src='https://placehold.co/400x400?text=${p.name}'">
            <div class="product-card-overlay">
                <h4>${p.name}</h4>
                <div class="price">₹${p.price}</div>
            </div>
        </div>
    `).join('') || '<p style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #999; font-weight: 500;">No products found in this category.</p>';
}


