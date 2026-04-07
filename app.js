const products = [
    {
        id: 1,
        name: "Pulse X1 Headphones",
        price: 349.99,
        category: "audio",
        image: "assets/hero-headphones.png",
        description: "Adaptive Noise Cancellation with 60-hour battery life."
    },
    {
        id: 2,
        name: "Titan S24 Mobile",
        price: 1199.99,
        category: "mobile",
        image: "assets/titan-s24.png",
        description: "Titanium frame with Pro-level 200MP camera system."
    },
    {
        id: 3,
        name: "Aero Tab Pro",
        price: 899.99,
        category: "tablet",
        image: "assets/aero-tab.png",
        description: "14-inch OLED display for professionals and creators."
    },
    {
        id: 4,
        name: "Vision 8K Display",
        price: 2499.99,
        category: "display",
        image: "assets/vision-8k.png",
        description: "The peak of visual clarity with QD-OLED technology."
    },
    {
        id: 5,
        name: "Echo Buds Gen 3",
        price: 199.99,
        category: "audio",
        image: "assets/echo-buds.png",
        description: "Spatial audio with seamless ecosystem integration."
    }
];

let cart = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderProducts(products);
    setupEventListeners();
    setupIntersectionObserver();
});

// Render Products
function renderProducts(productsToRender) {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';
    
    productsToRender.forEach(product => {
        const productCard = `
            <div class="product-card hidden" data-id="${product.id}">
                <div class="product-img">
                    <img src="${product.image}" alt="${product.name}" onerror="this.src='https://placehold.co/400x400/050505/00B4D8?text=${product.name.replace(' ', '+')}'">
                    <button class="add-btn" onclick="addToCart(${product.id})">Add to Cart</button>
                </div>
                <div class="product-info">
                    <span class="category-pill">${product.category}</span>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                    <span class="price">$${product.price.toFixed(2)}</span>
                </div>
            </div>
        `;
        productGrid.innerHTML += productCard;
    });
}

// Cart Logic
window.addToCart = (productId) => {
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
        cartTotal.innerText = '$0.00';
    } else {
        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://placehold.co/50x50/050505/00B4D8?text=Gadget'">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
                <button class="remove-btn" onclick="removeFromCart(${index})">&times;</button>
            </div>
        `).join('');
        
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        cartTotal.innerText = `$${total.toFixed(2)}`;
    }
}

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    updateCart();
};

// UI Interactions
function setupEventListeners() {
    const navbar = document.getElementById('navbar');
    
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(10, 10, 10, 0.9)';
            navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        } else {
            navbar.style.background = 'var(--glass-bg)';
            navbar.style.borderBottom = 'none';
        }
    });

    const cartBtn = document.getElementById('cart-btn');
    const closeCart = document.getElementById('close-cart');
    const cartSidebar = document.getElementById('cart-sidebar');
    const cartOverlay = document.getElementById('cart-overlay');
    
    cartBtn.addEventListener('click', openCart);
    closeCart.addEventListener('click', closeSideCart);
    cartOverlay.addEventListener('click', closeSideCart);
    
    // Filtering
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const category = tab.getAttribute('data-filter');
            if (category === 'all') {
                renderProducts(products);
            } else {
                const filtered = products.filter(p => p.category === category);
                renderProducts(filtered);
            }
            // Trigger animation for new items
            setTimeout(setupIntersectionObserver, 100);
        });
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

// Animations
function setupIntersectionObserver() {
    const options = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
                observer.unobserve(entry.target);
            }
        });
    }, options);

    document.querySelectorAll('.hidden').forEach(el => observer.observe(el));
}
