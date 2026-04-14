// --- Configuration (Same as app.js) ---
const AWS_CONFIG = {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_1CmJ2GeNh',
    clientId: '42dovnuj79hnha44se0r9q52d7',
    apiUrl: 'https://diixpyzogj.execute-api.ap-south-1.amazonaws.com/Prod/'
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

    const scCatSelect = document.getElementById('sc-category');
    if (scCatSelect) {
        scCatSelect.innerHTML = '<option value="">Select Category</option>' + 
            categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }

    // Category List Tags
    const catList = document.getElementById('category-list');
    catList.innerHTML = categories.map(cat => {
        let scList = (cat.subCategories && cat.subCategories.length > 0) ? ` (Sub: ${cat.subCategories.map(s => s.name).join(', ')})` : '';
        return `<span class="category-pill">${cat.name}${scList}</span>`;
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

        // Collect images
        const images = Array.from(document.querySelectorAll('.p-image-url')).map(input => input.value).filter(val => val.trim() !== '');
        
        // Collect highlights
        const highlights = Array.from(document.querySelectorAll('.p-highlight')).map(input => input.value).filter(val => val.trim() !== '');
        
        // Collect specifications
        const specifications = [];
        document.querySelectorAll('.spec-section').forEach(section => {
            const sectionName = section.querySelector('.p-spec-section-name').value;
            const specs = [];
            section.querySelectorAll('.spec-input-row').forEach(row => {
                const key = row.querySelector('.p-spec-key').value;
                const value = row.querySelector('.p-spec-value').value;
                if(key && value) {
                    specs.push({ key, value });
                }
            });
            if(sectionName && specs.length > 0) {
                specifications.push({ section: sectionName, specs });
            }
        });

        const data = {
            id: Date.now().toString(),
            name: document.getElementById('p-name').value,
            brand: document.getElementById('p-brand').value,
            category: document.getElementById('p-category').value,
            description: document.getElementById('p-desc').value,
            price: parseFloat(document.getElementById('p-price').value),
            originalPrice: document.getElementById('p-original-price').value ? parseFloat(document.getElementById('p-original-price').value) : null,
            inStock: document.getElementById('p-stock').value === 'true',
            images: images,
            image: images[0] || '', // fallback for older UI
            highlights: highlights,
            specifications: specifications
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

    // Image utility
    const getImageData = async (urlInputId, fileInputId) => {
        const fileInput = document.getElementById(fileInputId);
        const urlInput = document.getElementById(urlInputId);
        if (fileInput.files && fileInput.files[0]) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(fileInput.files[0]);
            });
        }
        return urlInput.value;
    };

    // Add Category
    document.getElementById('add-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('c-name').value;
        if (!/^[A-Za-z\s]+$/.test(name)) {
            alert("Invalid category name. Only letters and spaces are allowed.");
            return;
        }

        const image = await getImageData('c-image-url', 'c-image-file');
        
        // DynamoDB item size limit is 400KB. 
        if (image && image.length > 350000) {
            alert("The uploaded image is too large! Please use an image smaller than 250KB, or provide an image URL instead.");
            return;
        }

        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}categories`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, image })
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

    // Add Sub-category
    document.getElementById('add-subcategory-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const categoryName = document.getElementById('sc-category').value;
        const subCategoryName = document.getElementById('sc-name').value;
        
        if (!/^[A-Za-z\s]+$/.test(subCategoryName)) {
            alert("Invalid sub-category name. Only letters and spaces are allowed.");
            return;
        }

        const image = await getImageData('sc-image-url', 'sc-image-file');
        
        if (image && image.length > 350000) {
            alert("The uploaded image is too large! Please use an image smaller than 250KB, or provide an image URL instead.");
            return;
        }

        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}categories/${encodeURIComponent(categoryName)}/subcategories`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subCategoryName, image })
        });

        if (res.ok) {
            alert("Sub-category added!");
            e.target.reset();
            loadData();
        } else {
            const err = await res.json();
            alert(err.message || "Error adding sub-category");
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

window.addInputRow = (containerId, type, placeholder) => {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = `form-group ${type}-input-row`;
    div.style.display = 'flex';
    div.style.gap = '1rem';
    div.style.marginTop = '0.5rem';
    div.innerHTML = `
        <input type="text" class="p-${type}${type === 'image' ? '-url' : ''}" placeholder="${placeholder}" required style="flex:1;">
        <button type="button" class="btn secondary" style="background:#ff4757; color:white; border-color:transparent;" onclick="this.parentElement.remove()">-</button>
    `;
    container.appendChild(div);
};

window.addSpecRow = (btn) => {
    const container = btn.parentElement.parentElement;
    const div = document.createElement('div');
    div.className = `form-group spec-input-row`;
    div.style.display = 'flex';
    div.style.gap = '1rem';
    div.style.alignItems = 'center';
    div.style.marginTop = '0.5rem';
    div.innerHTML = `
        <input type="text" class="p-spec-key" placeholder="Key (e.g. Model Name)" required style="flex:1;">
        <input type="text" class="p-spec-value" placeholder="Value (e.g. Z9 5G)" required style="flex:1;">
        <button type="button" class="btn secondary" style="background:#ff4757; color:white; border-color:transparent;" onclick="this.parentElement.remove()">-</button>
    `;
    container.appendChild(div);
};

window.addSpecSection = () => {
    const container = document.getElementById('specs-container');
    const div = document.createElement('div');
    div.className = 'spec-section';
    div.style.background = 'rgba(255,255,255,0.05)';
    div.style.padding = '1.5rem';
    div.style.borderRadius = '12px';
    div.style.marginBottom = '1.5rem';
    div.innerHTML = `
        <div class="form-group" style="display:flex; justify-content: space-between; align-items: center;">
            <input type="text" class="p-spec-section-name" placeholder="Section Name (e.g., General)" style="width: 50%;" required>
            <button type="button" class="btn secondary" style="background: #ff4757; color: white; border-color:transparent;" onclick="this.parentElement.parentElement.remove()">Remove Section</button>
        </div>
        <div class="spec-rows-container">
            <div class="form-group spec-input-row" style="display:flex; gap:1rem; align-items: center; margin-top:0.5rem">
                <input type="text" class="p-spec-key" placeholder="Key (e.g. Model Name)" required style="flex:1;">
                <input type="text" class="p-spec-value" placeholder="Value (e.g. Z9 5G)" required style="flex:1;">
                <button type="button" class="btn secondary" onclick="addSpecRow(this)">+</button>
            </div>
        </div>
    `;
    container.appendChild(div);
};
