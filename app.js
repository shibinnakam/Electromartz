const products = [
    {
        id: 1,
        name: "Pulse X1 Headphones",
        price: 9,
        category: "audio",
        image: "assets/hero-headphones.png",
        description: "Adaptive Noise Cancellation with 60-hour battery life."
    },
    {
        id: 2,
        name: "Titan S24 Mobile",
        price: 10,
        category: "mobile",
        image: "assets/titan-s24.png",
        description: "Titanium frame with Pro-level 200MP camera system."
    },
    {
        id: 3,
        name: "Aero Tab Pro",
        price: 8,
        category: "tablet",
        image: "assets/aero-tab.png",
        description: "14-inch OLED display for professionals and creators."
    },
    {
        id: 4,
        name: "Vision 8K Display",
        price: 7,
        category: "display",
        image: "assets/vision-8k.png",
        description: "The peak of visual clarity with QD-OLED technology."
    },
    {
        id: 5,
        name: "Echo Buds Gen 3",
        price: 6,
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
                    <span class="price">₹${product.price}</span>
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

// Checkout and Payment Logic
window.openCheckout = () => {
    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('checkout-amount').innerText = `₹${total}`;
    
    closeSideCart();
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('checkout-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeCheckout = () => {
    document.getElementById('checkout-modal').classList.remove('active');
    document.getElementById('checkout-overlay').classList.remove('active');
    document.body.style.overflow = 'auto';
};

window.initiatePayment = () => {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const name = document.getElementById('cust-name').value;
    const email = document.getElementById('cust-email').value;
    const phone = document.getElementById('cust-phone').value;
    const address = document.getElementById('cust-address').value;

    const options = {
        "key": "YOUR_RAZORPAY_KEY", // Enter your Live/Test Key here
        "amount": total * 100, // Amount in paise
        "currency": "INR",
        "name": "Electra Premium",
        "description": "Premium Electronics Purchase",
        "image": "https://placehold.co/200x200/050505/00B4D8?text=EP",
        "handler": function (response){
            alert("Payment Successful! Payment ID: " + response.razorpay_payment_id);
            const customerDetails = { name, email, phone, address };
            generatePDFInvoice(response.razorpay_payment_id, customerDetails);
            
            // Clear cart and close modal
            cart = [];
            updateCart();
            closeCheckout();
        },
        "prefill": {
            "name": name,
            "email": email,
            "contact": phone
        },
        "theme": {
            "color": "#00B4D8"
        }
    };

    const rzp1 = new Razorpay(options);
    rzp1.open();
};

function generatePDFInvoice(paymentId, customer) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const date = new Date().toLocaleDateString();

    // Add Logo / Header
    doc.setFontSize(22);
    doc.setTextColor(0, 180, 216);
    doc.text("ELECTRA PREMIUM", 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Official Electronics E-Commerce Invoice", 105, 28, { align: 'center' });

    // Customer and Order Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Invoice Date: ${date}`, 15, 45);
    doc.text(`Payment ID: ${paymentId}`, 15, 52);
    
    doc.setFontSize(14);
    doc.text("Bill To:", 15, 65);
    doc.setFontSize(11);
    doc.text(`Name: ${customer.name}`, 15, 72);
    doc.text(`Phone: ${customer.phone}`, 15, 79);
    doc.text(`Email: ${customer.email}`, 15, 86);
    doc.text(`Address: ${customer.address}`, 15, 93);

    // Table Data
    const tableData = cart.map(item => [item.name, item.category, `₹${item.price}`]);
    
    doc.autoTable({
        startY: 105,
        head: [['Product Name', 'Category', 'Price']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillStyle: [0, 180, 216] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.text(`Total Paid: ₹${total}`, 195, finalY, { align: 'right' });

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Thank you for shopping with Electra Premium!", 105, 285, { align: 'center' });

    // Save PDF
    doc.save(`Invoice_Electra_${paymentId}.pdf`);
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
