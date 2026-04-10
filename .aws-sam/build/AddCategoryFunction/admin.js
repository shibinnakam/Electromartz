// --- Configuration (Same as app.js) ---
const AWS_CONFIG = {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_paEQTXF85',
    clientId: '48j8ip6e7tl453hql34pbqchcf',
    apiUrl: 'https://7o7zyf7ts2.execute-api.ap-south-1.amazonaws.com/Prod/'
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

    // Category List Tags
    const catList = document.getElementById('category-list');
    catList.innerHTML = categories.map(cat => `<span class="category-pill">${cat.name}</span>`).join('');

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
        const data = {
            id: Date.now().toString(),
            name: document.getElementById('p-name').value,
            price: parseFloat(document.getElementById('p-price').value),
            category: document.getElementById('p-category').value,
            image: document.getElementById('p-image').value,
            description: document.getElementById('p-desc').value
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
            alert("Product published successfully!");
            e.target.reset();
            loadData();
            switchTab('overview');
        }
    });

    // Add Category
    document.getElementById('add-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('c-name').value;

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
    if (currentUser) {
        currentUser.signOut();
        window.location.href = 'index.html';
    }
};
