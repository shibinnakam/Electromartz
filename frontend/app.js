// --- Configuration ---
// Note: REPLACE these values with your actual AWS resource IDs after deployment
const AWS_CONFIG = {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_1CmJ2GeNh',
    clientId: '42dovnuj79hnha44se0r9q52d7',
    apiUrl: 'https://diixpyzogj.execute-api.ap-south-1.amazonaws.com/Prod/'
};

// --- State Management ---
let products = [];
let categories = [];
let cart = [];
let currentUser = null;
let userProfile = {};
let savedAddresses = []; // List of address objects
let wishlist = []; // Store product IDs
let currentHeroSlide = 0;
let heroAutoplayInterval;

// --- Filter State ---
let activeFilters = {
    categories: [],
    brands: [],
    maxPrice: 500000,
    sortBy: 'default'
};

// --- AWS Cognito Setup ---
const poolData = {
    UserPoolId: AWS_CONFIG.userPoolId,
    ClientId: AWS_CONFIG.clientId
};
const userPool = (poolData.UserPoolId !== 'YOUR_USER_POOL_ID') ? new AmazonCognitoIdentity.CognitoUserPool(poolData) : null;

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    await checkUserSession();
    await loadInitialData();
    setupIntersectionObserver();
    initHeroCarousel();

    // Handle redirection after login
    const redirect = sessionStorage.getItem('loginRedirect');
    if (redirect && currentUser) {
        sessionStorage.removeItem('loginRedirect');
        if (redirect === 'profile') openDashboard('profile');
    }
}

async function loadInitialData() {
    try {
        await Promise.all([
            fetchProducts(),
            fetchCategories()
        ]);
        renderStoreExplorer();
    } catch (err) {
        console.warn("Using fallback data. Please check your API configuration.");
        products = [
            { id: '1', name: "Pulse X1", price: 9, category: "audio", image: "assets/hero-headphones.png", description: "fallback" }
        ];
        renderProducts(products);
    }
}

// --- Data Fetching ---
async function fetchProducts() {
    const res = await fetch(`${AWS_CONFIG.apiUrl}products`);
    products = await res.json();
    renderProducts(products);
}

async function fetchCategories() {
    const res = await fetch(`${AWS_CONFIG.apiUrl}categories`);
    categories = await res.json();
    updateCategoryUI();
}

// --- Rendering ---
function renderProducts(productsToRender) {
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return;
    productGrid.innerHTML = '';

    window.filterByCat = (category) => {
        const filtered = products.filter(p => p.category.toLowerCase().includes(category.toLowerCase()));
        renderProducts(filtered);
    };

    productsToRender.forEach(product => {
        const isInWishlist = wishlist.includes(product.id);
        const productCard = `
            <div class="product-card hidden" data-id="${product.id}" onclick="addToRecentlyViewed('${product.id}')">
                <div class="product-img">
                    <img src="${product.image}" alt="${product.name}" onerror="this.src='https://placehold.co/400x400/fff/3B82F6?text=${product.name.replace(' ', '+')}'">
                    <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(event, '${product.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isInWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                    <button class="add-btn" onclick="addToCart(event, '${product.id}')">Add to Cart</button>
                </div>
                <div class="product-info">
                    <div class="interactive-rating emetix-stars" data-id="${product.id}">
                        ${[1,2,3,4,5].map(s => `<span class="star" onclick="submitRating(event, '${product.id}', ${s})">★</span>`).join('')}
                    </div>
                    <h3>${product.name}</h3>
                    <div class="emetix-price">
                        £${product.price}.00 <del>£${Math.round(product.price * 1.2)}.00</del>
                    </div>
                </div>
            </div>
        `;
        productGrid.innerHTML += productCard;
    });
    setupIntersectionObserver();
}

function updateCategoryUI() {
    // Update filter tabs
    const filterContainer = document.querySelector('.filter-tabs');
    if (filterContainer) {
        let html = '<button class="filter-tab active" data-filter="all">All</button>';
        categories.forEach(cat => {
            html += `<button class="filter-tab" data-filter="${cat.name}">${cat.name}</button>`;
        });
        filterContainer.innerHTML = html;
        setupFilterListeners();
        renderStoreExplorer(); // Re-render sidebar if categories change
    }

    // Update Admin dropdown
    const catSelect = document.getElementById('p-category');
    if (catSelect) {
        catSelect.innerHTML = '<option value="">Select Category</option>' + 
            categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }
}

// --- Cart Functionality ---
window.addToCart = (e, productId) => {
    if (e) e.stopPropagation();
    const product = products.find(p => p.id === productId);
    if (product) {
        cart.push(product);
        updateCart();
        openCart();
    }
};

function updateCart() {
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');

    cartCount.innerText = cart.length;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
        cartTotal.innerText = '₹0';
    } else {
        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://placehold.co/50x50/050505/00B4D8?text=Gadget'">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <span>₹${item.price}</span>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${index})">&times;</button>
            </div>
        `).join('');

        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotal.innerText = `₹${total}`;
    }
}

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    updateCart();
};

window.redirectToRazorpay = async () => {
    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    if (!currentUser) {
        alert("Please login to proceed to checkout.");
        openAuthModal();
        return;
    }

    if (savedAddresses.length === 0) {
        alert("Please add a shipping address before proceeding to checkout.");
        openDashboard('addresses');
        return;
    }

    try {
        const token = await getToken();
        const total = cart.reduce((s, i) => s + i.price, 0);
        
        // 1. Create Internal and Razorpay Order
        const res = await fetch(`${AWS_CONFIG.apiUrl}orders`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: cart,
                totalAmount: total,
                shippingDetails: {
                    name: userProfile.name,
                    phone: userProfile.phone_number,
                    address: savedAddresses[0].address,
                    pincode: savedAddresses[0].pincode,
                    city: savedAddresses[0].city
                }
            })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to create order on server");
        }
        const orderData = await res.json();

        // 2. Initialize Razorpay Checkout
        const options = {
            "key": orderData.razorpayKey, 
            "amount": Math.round(total * 100),
            "currency": "INR",
            "name": "ELECTROMARTZ",
            "description": "Premium Electronics Purchase",
            "order_id": orderData.razorpayOrderId,
            "handler": async function (response) {
                // 3. Verify Payment on Success
                try {
                    const verifyRes = await fetch(`${AWS_CONFIG.apiUrl}verify-payment`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            orderId: orderData.orderId
                        })
                    });

                    if (verifyRes.ok) {
                        alert("Payment Successful! Your order has been placed.");
                        cart = [];
                        updateCart();
                        openDashboard('orders');
                    } else {
                        alert("Payment verification failed. Please contact support.");
                    }
                } catch (err) {
                    console.error("Verification error:", err);
                    alert("Error verifying payment.");
                }
            },
            "prefill": {
                "name": userProfile.name,
                "email": currentUser.attributes?.email,
                "contact": userProfile.phone_number
            },
            "theme": {
                "color": "#00B4D8"
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            alert(`Payment Failed: ${response.error.description}`);
        });
        rzp.open();

    } catch (err) { 
        console.error("Checkout error:", err); 
        alert("There was an error initiating checkout. Please try again.");
    }
};

// --- Auth Logic ---
async function checkUserSession() {
    if (!userPool) return;
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
        cognitoUser.getSession(async (err, session) => {
            if (session && session.isValid()) {
                currentUser = cognitoUser;
                await fetchUserProfile();
                updateAuthUI(true);
                checkAdminAccess(session);
            } else {
                updateAuthUI(false);
            }
        });
    }
}

async function fetchUserProfile() {
    return new Promise((resolve) => {
        currentUser.getUserAttributes((err, attributes) => {
            if (err) return resolve();
            
            const profile = {};
            attributes.forEach(attr => {
                const key = attr.getName().replace('custom:', '');
                profile[key] = attr.getValue();
            });
            userProfile = profile;
            
            // Handle Multiple Addresses
            try {
                savedAddresses = profile.addresses ? JSON.parse(profile.addresses) : [];
            } catch (e) {
                savedAddresses = [];
            }
            
            fillProfileForm();
            renderAddresses();
            resolve();
        });
    });
}

function fillProfileForm() {
    const fields = {
        'p-name-field': 'name',
        'p-phone-field': 'phone_number',
        'p-address-field': 'address',
        'p-pincode-field': 'pincode',
        'p-landmark-field': 'landmark'
    };
    for (const [id, key] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = userProfile[key] || '';
    }
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

function updateAuthUI(isLoggedIn) {
    const userSection = document.getElementById('user-section');
    if (isLoggedIn && currentUser) {
        userSection.innerHTML = `
            <div class="user-info-group">
                <button onclick="openDashboard('profile')" class="user-pill">
                    <span>${userProfile.name ? userProfile.name.split(' ')[0] : 'Account'}</span>
                </button>
                <div id="admin-badge-container"></div>
                <button onclick="handleLogout()" class="logout-link">Logout</button>
            </div>
        `;
        
        // Personalize Navbar Links
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            navLinks.innerHTML = `
                <li><a href="javascript:switchView('user-page')" class="active">Dashboard</a></li>
                <li><a href="javascript:switchView('store')">Store</a></li>
                <li><a href="javascript:openDashboard('wishlist')">Wishlist</a></li>
                <li><a href="javascript:openDashboard('orders')">Orders</a></li>
            `;
        }
        
        fetchWishlist();
        switchView('user-page');
    } else {
        userSection.innerHTML = `<button id="login-btn" onclick="openAuthModal()" class="btn secondary">Login</button>`;
    }
}

// --- Wishlist & Ratings & Recently Viewed ---

async function fetchWishlist() {
    if (!currentUser) return;
    try {
        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}wishlist`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const items = await res.json();
        wishlist = items.map(i => i.productId);
        renderProducts(products); // Refresh with hearts
        renderWishlistTab();
    } catch (err) { console.error(err); }
}

window.toggleWishlist = async (e, productId) => {
    e.stopPropagation();
    if (!currentUser) { openAuthModal(); return; }
    
    try {
        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}wishlist`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
        });
        const result = await res.json();
        if (result.action === 'added') wishlist.push(productId);
        else wishlist = wishlist.filter(id => id !== productId);
        
        renderProducts(products);
        renderWishlistTab();
    } catch (err) { console.error(err); }
};

window.submitRating = async (e, productId, rating) => {
    e.stopPropagation();
    if (!currentUser) { openAuthModal(); return; }
    
    try {
        const token = await getToken();
        await fetch(`${AWS_CONFIG.apiUrl}ratings`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, rating })
        });
        alert("Thanks for your rating!");
    } catch (err) { console.error(err); }
};

window.addToRecentlyViewed = (productId) => {
    recentlyViewed = recentlyViewed.filter(id => id !== productId);
    recentlyViewed.unshift(productId);
    recentlyViewed = recentlyViewed.slice(0, 5); // Keep last 5
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
    renderRecentlyViewedTab();
};

function renderWishlistTab() {
    const container = document.getElementById('wishlist-items-list');
    if (!container) return;
    const items = products.filter(p => wishlist.includes(p.id));
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-msg">Your wishlist is empty.</p>';
        return;
    }
    container.innerHTML = items.map(p => `
        <div class="arrival-mini">
            <img src="${p.image}" alt="${p.name}">
            <div class="mini-info">
                <h4>${p.name}</h4>
                <span class="mini-price">₹${p.price}</span>
                <button onclick="addToCart(event, '${p.id}')" class="btn primary" style="padding:0.4rem 0.8rem; font-size:0.7rem; margin-top:0.5rem; width:fit-content">Add to Cart</button>
            </div>
        </div>
    `).join('');
}

function renderRecentlyViewedTab() {
    const container = document.getElementById('recent-items-list');
    if (!container) return;
    const items = recentlyViewed.map(id => products.find(p => p.id === id)).filter(p => p);
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-msg">No recently viewed items.</p>';
        return;
    }
    container.innerHTML = items.map(p => `
        <div class="arrival-mini" onclick="window.location.href='#products'">
            <img src="${p.image}" alt="${p.name}">
            <div class="mini-info">
                <h4>${p.name}</h4>
                <span class="mini-price">₹${p.price}</span>
            </div>
        </div>
    `).join('');
}

function checkAdminAccess(session) {
    const groups = session.getIdToken().payload['cognito:groups'] || [];
    if (groups.includes('Admins')) {
        const badgeContainer = document.getElementById('admin-badge-container');
        if (badgeContainer) badgeContainer.innerHTML = `<span class="admin-badge" onclick="window.location.href='admin.html'" style="cursor:pointer">Admin Panel</span>`;
    }
}

window.handleLogout = () => {
    if (currentUser) {
        currentUser.signOut();
        window.location.reload();
    }
};

// --- Auth UI Interactions ---
window.openAuthModal = () => document.getElementById('auth-modal').classList.add('active');
window.closeAuthModal = () => document.getElementById('auth-modal').classList.remove('active');

window.toggleAuthMode = (mode) => {
    document.getElementById('login-form-container').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('signup-form-container').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('verify-form-container').style.display = mode === 'verify' ? 'block' : 'none';
};

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const authData = { Username: email, Password: password };
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
            const accessToken = result.getAccessToken().getJwtToken();
            const refreshToken = result.getRefreshToken().getToken();
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            sessionStorage.setItem('loginRedirect', 'profile'); // Flag to open profile after reload
            window.location.reload();
        },
        onFailure: (err) => {
            alert(err.message || JSON.stringify(err));
        }
    });
});

document.getElementById('signup-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })
    ];

    signupEmail = email; // Store for verification
    userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
            alert(err.message || JSON.stringify(err));
            return;
        }
        toggleAuthMode('verify');
    });
});

document.getElementById('verify-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('verify-code').value;
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: signupEmail, Pool: userPool });

    cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
            alert(err.message || JSON.stringify(err));
            return;
        }
        alert('Verification successful! You can now log in.');
        toggleAuthMode('login');
    });
});

// Admin modal logic removed (see admin.js)

// Tab logic moved to admin.js

// Removed add-product and add-category form listeners (moved to admin.js)

// --- UI Interactions (Existing) ---
function setupEventListeners() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    document.getElementById('cart-btn').addEventListener('click', openCart);
    document.getElementById('close-cart').addEventListener('click', closeSideCart);
    document.getElementById('cart-overlay').addEventListener('click', closeSideCart);

    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    mobileMenuBtn?.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking a link
    navLinks?.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn?.classList.remove('active');
            navLinks?.classList.remove('active');
        });
    });

    // Address Form Listener
    document.getElementById('add-address-form')?.addEventListener('submit', handleAddAddress);
}

function setupFilterListeners() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.getAttribute('data-filter');
            if (category === 'all') {
                renderProducts(products);
            } else {
                const filtered = products.filter(p => p.category === category);
                renderProducts(filtered);
            }
        });
    });
}

// --- Store Explorer Logic ---

window.renderStoreExplorer = () => {
    const brandList = document.getElementById('brand-filter-list');
    const catList = document.getElementById('category-filter-list');
    
    if (!brandList || !catList) return;

    // 1. Render Categories
    catList.innerHTML = categories.map(cat => `
        <label class="filter-item">
            <input type="checkbox" value="${cat.name}" onchange="toggleCategoryFilter('${cat.name}')" ${activeFilters.categories.includes(cat.name) ? 'checked' : ''}>
            ${cat.name}
        </label>
    `).join('');

    // 2. Render Brands (Extracted from products)
    const brands = [...new Set(products.map(p => p.brand).filter(b => b))].sort();
    brandList.innerHTML = brands.map(brand => `
        <label class="filter-item">
            <input type="checkbox" value="${brand}" onchange="toggleBrandFilter('${brand}')" ${activeFilters.brands.includes(brand) ? 'checked' : ''}>
            ${brand}
        </label>
    `).join('');

    applyFilters();
};

window.toggleCategoryFilter = (cat) => {
    if (activeFilters.categories.includes(cat)) {
        activeFilters.categories = activeFilters.categories.filter(c => c !== cat);
    } else {
        activeFilters.categories.push(cat);
    }
    applyFilters();
};

window.toggleBrandFilter = (brand) => {
    if (activeFilters.brands.includes(brand)) {
        activeFilters.brands = activeFilters.brands.filter(b => b !== brand);
    } else {
        activeFilters.brands.push(brand);
    }
    applyFilters();
};

window.updatePriceFilter = (val) => {
    activeFilters.maxPrice = Number(val);
    const label = document.getElementById('price-max-label');
    if (label) label.innerText = val;
    applyFilters();
};

window.handleSort = (val) => {
    activeFilters.sortBy = val;
    applyFilters();
};

window.clearAllFilters = () => {
    activeFilters = {
        categories: [],
        brands: [],
        maxPrice: 500000,
        sortBy: 'default'
    };
    // Reset UI elements
    const range = document.getElementById('price-range');
    if (range) range.value = 500000;
    const label = document.getElementById('price-max-label');
    if (label) label.innerText = 500000;
    document.querySelectorAll('.filter-item input').forEach(input => input.checked = false);
    applyFilters();
};

window.applyFilters = () => {
    let filtered = products.filter(p => {
        const matchesCategory = activeFilters.categories.length === 0 || activeFilters.categories.includes(p.category);
        const matchesBrand = activeFilters.brands.length === 0 || activeFilters.brands.includes(p.brand);
        const matchesPrice = p.price <= activeFilters.maxPrice;
        return matchesCategory && matchesBrand && matchesPrice;
    });

    // Handle Sorting
    if (activeFilters.sortBy === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (activeFilters.sortBy === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    }

    renderExplorerGrid(filtered);
    updateActiveFilterTags();
};

function renderExplorerGrid(filteredProducts) {
    const grid = document.getElementById('explorer-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<div class="empty-msg" style="grid-column: 1/-1; padding: 4rem; text-align: center;"><h3>No products match your filters.</h3><p>Try adjusting your criteria.</p></div>';
        return;
    }

    filteredProducts.forEach(product => {
        const isInWishlist = wishlist.includes(product.id);
        const productCard = `
            <div class="product-card" data-id="${product.id}" onclick="addToRecentlyViewed('${product.id}')">
                <div class="product-img">
                    <img src="${product.image}" alt="${product.name}" onerror="this.src='https://placehold.co/400x400/fff/3B82F6?text=${product.name.replace(' ', '+')}'">
                    <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" onclick="toggleWishlist(event, '${product.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isInWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                    ${product.brand ? `<span class="category-pill" style="position:absolute; top:1rem; left:1rem; margin:0;">${product.brand}</span>` : ''}
                    <button class="add-btn" onclick="addToCart(event, '${product.id}')">Add to Cart</button>
                </div>
                <div class="product-info">
                    <div class="interactive-rating emetix-stars" data-id="${product.id}">
                        ${[1,2,3,4,5].map(s => `<span class="star" onclick="submitRating(event, '${product.id}', ${s})">★</span>`).join('')}
                    </div>
                    <h3>${product.name}</h3>
                    <div class="emetix-price">
                        ₹${product.price}.00 <del>₹${Math.round(product.price * 1.2)}.00</del>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += productCard;
    });
}

function updateActiveFilterTags() {
    const container = document.getElementById('active-filters');
    if (!container) return;
    
    let html = '';
    activeFilters.categories.forEach(cat => {
        html += `<span class="filter-tag">${cat} <button onclick="toggleCategoryFilter('${cat}')">&times;</button></span>`;
    });
    activeFilters.brands.forEach(brand => {
        html += `<span class="filter-tag">${brand} <button onclick="toggleBrandFilter('${brand}')">&times;</button></span>`;
    });
    if (activeFilters.maxPrice < 500000) {
        html += `<span class="filter-tag">Under ₹${activeFilters.maxPrice} <button onclick="updatePriceFilter(500000)">&times;</button></span>`;
    }
    container.innerHTML = html;
}

// --- View Switching ---

window.switchView = (viewName, category = null) => {
    const mainSectionsIds = ['hero', 'categories', 'products', 'new-arrivals'];
    const explorerSection = document.getElementById('store-explorer-view');
    const userPageSection = document.getElementById('user-page');
    const heroWrapper = document.querySelector('.dark-hero-wrapper');
    const featuresWrapper = document.querySelector('.features-wrapper');

    // Hide EVERYTHING by default
    mainSectionsIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    if (heroWrapper) heroWrapper.classList.add('hidden');
    if (featuresWrapper) featuresWrapper.classList.add('hidden');
    if (explorerSection) explorerSection.classList.add('hidden');
    if (userPageSection) userPageSection.classList.add('hidden');

    if (viewName === 'store') {
        if (explorerSection) explorerSection.classList.remove('hidden');
        if (category) {
            activeFilters.categories = [category];
            renderStoreExplorer();
        } else {
            applyFilters();
        }
        updateNavLinks('store');
        window.scrollTo(0, 0);
    } else if (viewName === 'user-page') {
        if (userPageSection) userPageSection.classList.remove('hidden');
        updateNavLinks('user-page');
        window.scrollTo(0, 0);
    } else {
        // Show Landing Sections
        mainSectionsIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
        });
        if (heroWrapper) heroWrapper.classList.remove('hidden');
        if (featuresWrapper) featuresWrapper.classList.remove('hidden');
        updateNavLinks('home');
    }
};

function updateNavLinks(activeView) {
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href');
        if (activeView === 'store' && (href === '#products' || href.includes('store'))) {
            link.classList.add('active');
        }
        if (activeView === 'user-page' && (href.includes('wishlist') || href.includes('orders') || href.includes('profile'))) {
            link.classList.add('active');
        }
        if (activeView === 'home' && href.includes('home')) {
            link.classList.add('active');
        }
    });
}


function openCart() {
    document.getElementById('cart-sidebar').classList.add('active');
    document.getElementById('cart-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSideCart() {
    document.getElementById('cart-sidebar').classList.remove('active');
    document.getElementById('cart-overlay').classList.remove('active');
    document.body.style.overflow = 'auto';
}

// --- Hero Carousel ---
function initHeroCarousel() {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    
    startHeroAutoplay();
    
    // Add event listeners to hero nav if they exist
    // They are currently using onclick in HTML for simplicity per project pattern
}

window.showSlide = (index) => {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');
    
    if (index >= slides.length) currentHeroSlide = 0;
    else if (index < 0) currentHeroSlide = slides.length - 1;
    else currentHeroSlide = index;

    slides.forEach((slide, i) => {
        slide.classList.remove('active');
        dots[i].classList.remove('active');
        if (i === currentHeroSlide) {
            slide.classList.add('active');
            dots[i].classList.add('active');
        }
    });
};

window.nextSlide = () => {
    stopHeroAutoplay();
    showSlide(currentHeroSlide + 1);
};

window.prevSlide = () => {
    stopHeroAutoplay();
    showSlide(currentHeroSlide - 1);
};

window.goToSlide = (index) => {
    stopHeroAutoplay();
    showSlide(index);
};

function startHeroAutoplay() {
    heroAutoplayInterval = setInterval(() => {
        showSlide(currentHeroSlide + 1);
    }, 3000);
}

function stopHeroAutoplay() {
    clearInterval(heroAutoplayInterval);
}

// --- Dashboard logic ---
window.openDashboard = async (tabId = 'profile') => {
    switchView('user-page');
    switchDashTab(tabId);
    if (tabId === 'orders') await fetchUserOrders();
    if (tabId === 'wishlist') await fetchWishlist();
    if (tabId === 'recent') renderRecentlyViewedTab();
};

window.closeDashboard = () => {
    switchView('home');
};

window.switchDashTab = (tabId) => {
    // Hide all sections
    document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
    // Deactivate all sidebar buttons
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    
    // Show target section
    const targetSection = document.getElementById(`${tabId}-tab`);
    if (targetSection) targetSection.classList.add('active');
    
    // Activate target sidebar button
    const targetBtn = document.getElementById(`${tabId}-tab-btn`);
    if (targetBtn) targetBtn.classList.add('active');
};

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Saving...";
    btn.disabled = true;

    const attributes = [
        { Name: 'name', Value: document.getElementById('p-name-field').value },
        { Name: 'phone_number', Value: document.getElementById('p-phone-field').value }
    ];

    const cognitoAttributes = attributes.map(a => new AmazonCognitoIdentity.CognitoUserAttribute(a));

    currentUser.updateAttributes(cognitoAttributes, (err, result) => {
        btn.innerText = "Save Profile Changes";
        btn.disabled = false;
        if (err) {
            alert(err.message || JSON.stringify(err));
            return;
        }
        alert("Profile updated successfully!");
        fetchUserProfile();
        updateAuthUI(true);
    });
});

async function fetchUserOrders() {
    try {
        const token = await getToken();
        const res = await fetch(`${AWS_CONFIG.apiUrl}orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orders = await res.json();
        renderUserOrders(orders);
    } catch (err) {
        console.error("Failed to fetch orders", err);
    }
}

function renderUserOrders(orders) {
    const container = document.getElementById('user-orders-list');
    if (!container) return;

    if (!orders || orders.length === 0) {
        container.innerHTML = '<p class="empty-msg">No orders found yet.</p>';
        return;
    }

    container.innerHTML = orders.slice().reverse().map(order => `
        <div class="order-card">
            <div class="order-top">
                <span class="order-id">#${order.orderId.substring(0, 10)}...</span>
                <span class="admin-badge" style="background:${order.status === 'Pending' ? '#ffaa00' : '#07c160'}">${order.status}</span>
            </div>
            <div class="order-items">
                ${order.items.map(item => `
                    <div class="order-item-mini">
                        <span>${item.name}</span>
                        <span>₹${item.price}</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-footer">
                <div class="order-total">Total: ₹${order.totalAmount}</div>
                <button class="view-invoice" onclick='generateInvoice(${JSON.stringify(order).replace(/'/g, "&apos;")})'>
                    Download Invoice
                </button>
            </div>
        </div>
    `).join('');
}

window.generateInvoice = (order) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 180, 216); // Accent color
    doc.text("ELECTROMARTZ", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Premium Electronic Gadgets", 20, 28);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 140, 20);
    doc.text(`Order ID: ${order.orderId}`, 140, 28);

    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);

    // Shipping Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Bill To:", 20, 45);
    doc.setFontSize(10);
    doc.text(order.shippingDetails?.name || "Customer", 20, 52);
    doc.text(order.shippingDetails?.address || "No address provided", 20, 58, { maxWidth: 60 });
    doc.text(`Phone: ${order.shippingDetails?.phone || "N/A"}`, 20, 68);

    // Items Table
    const tableData = order.items.map(i => [i.name, 1, `₹${i.price}`, `₹${i.price}`]);
    doc.autoTable({
        startY: 80,
        head: [['Item', 'Qty', 'Unit Price', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 180, 216] }
    });

    // Summary
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Total Amount: ₹${order.totalAmount}`, 140, finalY);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Thank you for shopping with Electra Premium!", 60, finalY + 30);

    doc.save(`Invoice_${order.orderId.substring(0, 8)}.pdf`);
};

// --- Address Management ---
window.openAddAddressModal = () => document.getElementById('address-modal').classList.add('active');
window.closeAddressModal = () => document.getElementById('address-modal').classList.remove('active');

async function handleAddAddress(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    
    try {
        btn.innerText = "Saving...";
        btn.disabled = true;

        const newAddr = {
            id: Date.now(),
            type: document.getElementById('addr-type').value,
            address: document.getElementById('addr-field').value,
            pincode: document.getElementById('addr-pincode').value,
            city: document.getElementById('addr-city').value
        };

        savedAddresses.push(newAddr);
        await syncAddresses();
        
        closeAddressModal();
        renderAddresses();
        alert("Address added successfully!");
    } catch (err) {
        console.error("Failed to add address:", err);
        alert(`Error saving address: ${err.message || 'Please ensure you are logged in and try again.'}`);
        // Rollback local state on failure
        savedAddresses.pop();
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function syncAddresses() {
    if (!currentUser) throw new Error("User session expired. Please login again.");
    
    const attributes = [{ Name: 'custom:addresses', Value: JSON.stringify(savedAddresses) }];
    const cognitoAttributes = attributes.map(a => new AmazonCognitoIdentity.CognitoUserAttribute(a));

    return new Promise((resolve, reject) => {
        currentUser.updateAttributes(cognitoAttributes, (err, result) => {
            if (err) {
                console.error("Cognito Attribute Update Error:", err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function renderAddresses() {
    const container = document.getElementById('address-list');
    if (!container) return;

    if (savedAddresses.length === 0) {
        container.innerHTML = '<p class="empty-msg">No saved addresses yet.</p>';
        return;
    }

    container.innerHTML = savedAddresses.map(addr => `
        <div class="arrival-mini" style="border: 1px solid #eee; padding: 1rem; position: relative;">
            <div class="mini-info">
                <span class="admin-badge" style="background:#f1f5f9; color:#64748b; margin-bottom:0.5rem">${addr.type}</span>
                <p style="font-size:0.9rem; color:var(--text-primary); margin:0.3rem 0;">${addr.address}</p>
                <p style="font-size:0.8rem; color:var(--text-secondary)">${addr.city} - ${addr.pincode}</p>
            </div>
            <button onclick="deleteAddress(${addr.id})" style="position:absolute; top:1rem; right:1rem; color:#ef4444; font-size:0.8rem;">Delete</button>
        </div>
    `).join('');
}

window.deleteAddress = async (id) => {
    savedAddresses = savedAddresses.filter(a => a.id !== id);
    await syncAddresses();
    renderAddresses();
};

// --- Smooth Reveal ---
function setupIntersectionObserver() {
    const options = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, options);
    document.querySelectorAll('.hidden, .reveal-up').forEach(el => observer.observe(el));
}
