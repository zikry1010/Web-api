const API_BASE = 'http://localhost:5000/api';
let currentUser = null;
let currentOrderPhone = null;
let allPhones = [];
let isEditMode = false;
let currentEditPhoneId = null;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Checking backend status...');
    checkBackendStatus().then(() => {
        checkAuthentication();
        setupEventListeners();
        setupProfileSection();
        loadPhones();
        loadFeaturedPhones();
        setupFAQ();
        updateAdminButtons();
    });
});

// ========== AUTHENTICATION FUNCTIONS ==========
function checkAuthentication() {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
        try {
            currentUser = JSON.parse(userData);
            updateUIForUser(currentUser);
            updateProfileSection();
        } catch (error) {
            console.error('Error parsing user data:', error);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            updateUIForUser(null);
            updateProfileSection();
        }
    } else {
        updateUIForUser(null);
        updateProfileSection();
    }
}

function updateUIForUser(user) {
    const navAuth = document.querySelector('.nav-auth');
    const userInfo = document.getElementById('user-info');
    
    if (user) {
        if (navAuth) navAuth.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (document.getElementById('username-display')) {
            document.getElementById('username-display').textContent = user.username;
        }
        
        if (user.is_admin) {
            // Show admin nav links
            const adminNavLinks = document.querySelectorAll('.nav-link.admin-only');
            adminNavLinks.forEach(el => el.style.display = 'block');
            
            // Reset admin sections to CSS control (they will be hidden by .section until activated)
            const adminSections = document.querySelectorAll('.section.admin-only');
            adminSections.forEach(el => {
                el.style.display = '';
                // Ensure no active class lingers
                el.classList.remove('active');
            });
        } else {
            // Hide admin nav links
            const adminNavLinks = document.querySelectorAll('.nav-link.admin-only');
            adminNavLinks.forEach(el => el.style.display = 'none');
            
            // Force hide admin sections
            const adminSections = document.querySelectorAll('.section.admin-only');
            adminSections.forEach(el => {
                el.style.display = 'none';
                el.classList.remove('active');
            });
        }
    } else {
        if (navAuth) navAuth.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'none';
        
        // Hide all admin elements
        const adminNavLinks = document.querySelectorAll('.nav-link.admin-only');
        adminNavLinks.forEach(el => el.style.display = 'none');
        
        const adminSections = document.querySelectorAll('.section.admin-only');
        adminSections.forEach(el => {
            el.style.display = 'none';
            el.classList.remove('active');
        });
    }
}

async function logout() {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
        try {
            await fetch(`${API_BASE}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    currentUser = null;
    updateUIForUser(null);
    showSection('home');
    alert('You have been logged out.');
}

// ========== EVENT LISTENERS SETUP ==========
function setupEventListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            showSection(sectionId);
            
            if (sectionId === 'profile') {
                updateProfileSection();
            }
        });
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    const addPhoneForm = document.getElementById('add-phone-form');
    if (addPhoneForm) {
        addPhoneForm.addEventListener('submit', handlePhoneFormSubmit);
    }
    
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.addEventListener('submit', handlePlaceOrder);
    }
    
    const quantityInput = document.getElementById('quantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', updateOrderTotal);
    }
    
    const updateProfileForm = document.getElementById('update-profile-form');
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', handleUpdateProfile);
    }
}

// ========== NAVIGATION & UI FUNCTIONS ==========
function showSection(sectionId) {
    // Hide all sections by removing active class
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    const navLink = document.querySelector(`[href="#${sectionId}"]`);
    if (navLink) {
        navLink.classList.add('active');
    }
    
    if (sectionId === 'phones') {
        loadPhones();
    } else if (sectionId === 'admin-reports') {  // Fixed: was 'reports'
        loadSalesReport();
    } else if (sectionId === 'admin-orders') {  // Fixed: was 'orders'
        loadOrders();
    } else if (sectionId === 'profile') {
        updateProfileSection();
    } else if (sectionId === 'admin-dashboard') {
        loadAdminDashboard();
    } else if (sectionId === 'add-phone') {
        if (isEditMode) {
            const title = document.querySelector('#add-phone h2');
            if (title) title.textContent = 'Edit Phone';
            const submitBtn = document.querySelector('#add-phone-form button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Phone';
        } else {
            const title = document.querySelector('#add-phone h2');
            if (title) title.textContent = 'Add New Phone';
            const submitBtn = document.querySelector('#add-phone-form button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Add Phone to Inventory';
        }
    }
}

// ========== ADMIN DASHBOARD FUNCTIONS ==========
async function loadAdminDashboard() {
    if (!currentUser || !currentUser.is_admin) return;
    
    try {
        // Load admin stats
        const ordersResponse = await apiRequest(`${API_BASE}/orders`);
        const ordersData = await ordersResponse.json();
        const phonesResponse = await fetch(`${API_BASE}/phones`);
        const phonesData = await phonesResponse.json();
        
        const totalOrders = ordersData.orders.length;
        const totalPhones = phonesData.phones.length;
        const totalRevenue = ordersData.orders.reduce((sum, order) => sum + parseFloat(order.total_price || 0), 0);
        
        // Update dashboard stats
        document.getElementById('admin-total-orders').textContent = totalOrders;
        document.getElementById('admin-total-phones').textContent = totalPhones;
        document.getElementById('admin-total-revenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('admin-total-customers').textContent = '0'; // You might want to implement user counting
        
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

function manageInventory() {
    showSection('phones');
}

// ========== PHONE MANAGEMENT FUNCTIONS ==========
async function loadPhones() {
    try {
        const response = await fetch(`${API_BASE}/phones`);
        const data = await response.json();
        allPhones = data.phones || [];
        displayPhones(allPhones);
    } catch (error) {
        console.error('Error loading phones:', error);
        showFormMessage('Error loading phones. Please make sure the server is running.', 'error');
    }
}

function displayPhones(phones) {
    const container = document.getElementById('phones-container');
    if (!container) return;
    
    if (phones.length === 0) {
        container.innerHTML = `
            <div class="no-phones-message">
                <i class="fas fa-mobile-alt"></i>
                <h3>No Phones in Inventory</h3>
                <p>Get started by adding your first phone to the inventory.</p>
                ${currentUser && currentUser.is_admin ? 
                    `<div class="empty-state-actions">
                        <button class="btn btn-primary btn-large" onclick="showSection('add-phone')">
                            <i class="fas fa-plus-circle"></i> Add Your First Phone
                        </button>
                        <button class="btn btn-secondary" onclick="loadSamplePhones()">
                            <i class="fas fa-magic"></i> Load Sample Phones
                        </button>
                    </div>` : 
                    `<p class="admin-notice">Please contact an administrator to add phones to the inventory.</p>`
                }
            </div>
        `;
        return;
    }
    
    container.innerHTML = phones.map(phone => {
        const stockStatus = phone.stock_quantity === 0 ? 'out-of-stock' : 
                           phone.stock_quantity <= 10 ? 'low-stock' : 'in-stock';
        const stockText = phone.stock_quantity === 0 ? 'Out of Stock' : 
                         phone.stock_quantity <= 10 ? `Only ${phone.stock_quantity} left` : 'In Stock';
        
        return `
        <div class="phone-card">
            <div class="phone-image">
               <div class="image-wrapper">
    ${phone.image_url ? 
        `<img src="${phone.image_url}" alt="${phone.brand} ${phone.model}" 
              onerror="this.onerror=null; this.src='https://via.placeholder.com/300x400/111/444?text=No+Image';">` : 
        ''
    }
    <div class="phone-image-placeholder" style="${phone.image_url ? 'display: none;' : 'display: flex;'}">
        <i class="fas fa-mobile-alt"></i>
    </div>
</div>
                <div class="phone-image-placeholder" style="${phone.image_url ? 'display: none;' : ''}">
                    <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="stock-badge ${stockStatus}">${stockText}</div>
                
                <!-- Admin Quick Actions on Hover -->
                ${currentUser && currentUser.is_admin ? `
                    <div class="admin-hover-actions">
                        <button class="btn-icon btn-danger" onclick="deletePhone(${phone.id})" title="Delete Phone">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn-icon btn-info" onclick="editPhone(${phone.id})" title="Edit Phone">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            <div class="phone-content">
                <div class="phone-brand">${phone.brand}</div>
                <h3 class="phone-model">${phone.model}</h3>
                <div class="phone-price">$${parseFloat(phone.price).toFixed(2)}</div>
                <div class="phone-specs">
                    <span><i class="fas fa-hdd"></i> ${phone.storage}</span>
                    <span><i class="fas fa-palette"></i> ${phone.color}</span>
                    ${phone.screen_size ? `<span><i class="fas fa-expand"></i> ${phone.screen_size}</span>` : ''}
                </div>
                <p class="phone-description">${phone.description || 'No description available.'}</p>
                <div class="phone-actions">
                    <button class="btn btn-primary btn-small" onclick="showOrderForm(${phone.id})" 
                            ${phone.stock_quantity === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> 
                        ${phone.stock_quantity === 0 ? 'Out of Stock' : 'Buy Now'}
                    </button>
                    ${currentUser && currentUser.is_admin ? 
                        `<button class="btn btn-outline btn-small" onclick="editPhone(${phone.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>` : ''
                    }
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// FIXED: handlePhoneFormSubmit
async function handlePhoneFormSubmit(e) {
    e.preventDefault();
    
    if (!currentUser || !currentUser.is_admin) {
        alert('You must be an administrator to manage phones.');
        return;
    }
    
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (isEditMode ? 'Updating...' : 'Adding...');
    submitButton.disabled = true;
    
    try {
        const formData = new FormData(form);
        const phoneData = {
            brand: formData.get('brand'),
            model: formData.get('model'),
            price: parseFloat(formData.get('price')),
            stock_quantity: parseInt(formData.get('stock_quantity')),
            storage: formData.get('storage'),
            color: formData.get('color'),
            screen_size: formData.get('screen_size'),
            camera: formData.get('camera'),
            battery: formData.get('battery'),
            processor: formData.get('processor'),
            image_url: formData.get('image_url'),
            description: formData.get('description') || ''
        };

        let response;
        if (isEditMode) {
            // FIXED: Use /api/admin/phones/
            response = await apiRequest(`${API_BASE}/admin/phones/${currentEditPhoneId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(phoneData)
            });
        } else {
            // FIXED: Use /api/admin/phones
            response = await apiRequest(`${API_BASE}/admin/phones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(phoneData)
            });
        }

        if (response.ok) {
            const result = await response.json();
            showFormMessage(`Phone ${isEditMode ? 'updated' : 'added'} successfully!`, 'success');
            form.reset();
            isEditMode = false;
            currentEditPhoneId = null;
            submitButton.innerHTML = '<i class="fas fa-save"></i> Add Phone to Inventory';
            setTimeout(() => { showSection('phones'); loadPhones(); }, 1500);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Operation failed');
        }
    } catch (error) {
        showFormMessage(error.message || 'Operation failed. Check console.', 'error');
        console.error('Phone CRUD error:', error);
    } finally {
        submitButton.innerHTML = '<i class="fas fa-save"></i> ' + (isEditMode ? 'Update Phone' : 'Add Phone to Inventory');
        submitButton.disabled = false;
    }
}

async function editPhone(phoneId) {
    if (!currentUser || !currentUser.is_admin) {
        alert('You must be an admin to edit phones.');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/phones/${phoneId}`);
        const phone = await response.json();
        
        // Populate form
        const form = document.getElementById('add-phone-form');
        form.querySelector('#brand').value = phone.brand;
        form.querySelector('#model').value = phone.model;
        form.querySelector('#price').value = phone.price;
        form.querySelector('#stock_quantity').value = phone.stock_quantity;
        form.querySelector('#storage').value = phone.storage;
        form.querySelector('#color').value = phone.color;
        form.querySelector('#screen_size').value = phone.screen_size || '';
        form.querySelector('#camera').value = phone.camera || '';
        form.querySelector('#battery').value = phone.battery || '';
        form.querySelector('#processor').value = phone.processor || '';
        form.querySelector('#image_url').value = phone.image_url || '';
        form.querySelector('#description').value = phone.description || '';
        
        // Features
        const features = phone.features ? phone.features.split(', ') : [];
        form.querySelectorAll('input[name="features"]').forEach(checkbox => {
            checkbox.checked = features.includes(checkbox.value);
        });
        
        // Set edit mode
        isEditMode = true;
        currentEditPhoneId = phoneId;
        
        // Change button and title
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Phone';
        const title = document.querySelector('#add-phone h2');
        if (title) title.textContent = 'Edit Phone';
        
        showSection('add-phone');
    } catch (error) {
        console.error('Error loading phone for edit:', error);
        alert('Error loading phone details.');
    }
}

// FIXED: deletePhone
async function deletePhone(phoneId) {
    if (!currentUser || !currentUser.is_admin) {
        alert('Admin only!');
        return;
    }
    
    if (!confirm('Delete this phone permanently?')) return;

    try {
        // FIXED: Correct endpoint with /admin/
        const response = await apiRequest(`${API_BASE}/admin/phones/${phoneId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showFormMessage('Phone deleted!', 'success');
            await loadPhones();
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Delete failed: ' + error.message);
    }
}

function clearPhoneForm() {
    const form = document.getElementById('add-phone-form');
    if (form) {
        form.reset();
        if (isEditMode) {
            isEditMode = false;
            currentEditPhoneId = null;
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Add Phone to Inventory';
            const title = document.querySelector('#add-phone h2');
            if (title) title.textContent = 'Add New Phone';
        }
        showFormMessage('Form cleared.', 'info');
    }
}

function showFormMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.form-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `form-message ${type}-message`;
    messageDiv.innerHTML = `
        <i class="fas fa-${getMessageIcon(type)}"></i>
        ${message}
        <button class="close-message" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const form = document.getElementById('add-phone-form');
    if (form) {
        form.parentNode.insertBefore(messageDiv, form);
        
        // Auto-remove after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                if (messageDiv.parentElement) {
                    messageDiv.remove();
                }
            }, 5000);
        }
    }
}

function getMessageIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        info: 'info-circle',
        warning: 'exclamation-triangle'
    };
    return icons[type] || 'info-circle';
}

// ========== ORDER MANAGEMENT ==========
async function showOrderForm(phoneId) {
    if (!currentUser) {
        alert('Please log in to place an order.');
        window.location.href = 'login.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/phones/${phoneId}`);
        const phone = await response.json();
        
        currentOrderPhone = phone;
        
        document.getElementById('order-phone-id').value = phone.id;
        document.getElementById('order-phone-summary').innerHTML = `
            <div class="phone-card">
                <div class="phone-brand">${phone.brand}</div>
                <div class="phone-model">${phone.model}</div>
                <div class="phone-price">$${phone.price}</div>
                <div class="phone-specs">
                    <span><i class="fas fa-hdd"></i> ${phone.storage}</span>
                    <span><i class="fas fa-palette"></i> ${phone.color}</span>
                    <span><i class="fas fa-box"></i> ${phone.stock_quantity} in stock</span>
                </div>
                <p class="phone-description">${phone.description || 'No description available.'}</p>
            </div>
        `;
        
        document.getElementById('customer_name').value = currentUser.username;
        document.getElementById('customer_email').value = currentUser.email || '';
        
        const stockInfo = document.getElementById('stock-info');
        if (stockInfo) {
            stockInfo.textContent = `Available: ${phone.stock_quantity}`;
        }
        
        document.getElementById('quantity').value = 1;
        updateOrderTotal();
        showSection('order-phone');
    } catch (error) {
        console.error('Error loading phone:', error);
        alert('Error loading phone details. Please try again.');
    }
}

function updateOrderTotal() {
    const quantityInput = document.getElementById('quantity');
    const totalPriceElement = document.getElementById('total-price');
    const subtotalElement = document.getElementById('summary-subtotal');
    const shippingElement = document.getElementById('summary-shipping');
    
    if (!quantityInput || !totalPriceElement || !currentOrderPhone) return;
    
    const quantity = parseInt(quantityInput.value) || 1;
    const price = currentOrderPhone.price;
    const subtotal = price * quantity;
    const shipping = quantity > 2 ? 0 : 9.99;
    
    if (quantity > currentOrderPhone.stock_quantity) {
        alert(`Only ${currentOrderPhone.stock_quantity} units available in stock!`);
        quantityInput.value = currentOrderPhone.stock_quantity;
        const validQuantity = currentOrderPhone.stock_quantity;
        const validSubtotal = price * validQuantity;
        const validShipping = validQuantity > 2 ? 0 : 9.99;
        
        subtotalElement.textContent = `$${validSubtotal.toFixed(2)}`;
        shippingElement.textContent = validShipping === 0 ? 'FREE' : `$${validShipping.toFixed(2)}`;
        totalPriceElement.textContent = `$${(validSubtotal + validShipping).toFixed(2)}`;
        return;
    }
    
    if (quantity < 1) {
        quantityInput.value = 1;
        subtotalElement.textContent = `$${price.toFixed(2)}`;
        shippingElement.textContent = '$9.99';
        totalPriceElement.textContent = `$${(price + 9.99).toFixed(2)}`;
        return;
    }
    
    subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
    shippingElement.textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
    totalPriceElement.textContent = `$${(subtotal + shipping).toFixed(2)}`;
}

async function handlePlaceOrder(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please log in to place an order.');
        window.location.href = 'login.html';
        return;
    }
    
    if (!currentOrderPhone) {
        alert('No phone selected for order. Please try again.');
        return;
    }
    
    const formData = new FormData(e.target);
    const quantity = parseInt(formData.get('quantity'));
    
    if (quantity > currentOrderPhone.stock_quantity) {
        alert(`Sorry, only ${currentOrderPhone.stock_quantity} units available in stock!`);
        return;
    }
    
    const requiredFields = ['house_number', 'street_address', 'delivery_city', 'delivery_state', 'delivery_zip', 'delivery_country'];
    for (const field of requiredFields) {
        if (!formData.get(field)) {
            alert(`Please fill in all required delivery address fields.`);
            return;
        }
    }
    
    const orderData = {
        phone_id: parseInt(formData.get('phone_id')),
        customer_name: formData.get('customer_name'),
        customer_email: formData.get('customer_email'),
        customer_phone: formData.get('customer_phone'),
        quantity: quantity,
        house_number: formData.get('house_number'),
        street_address: formData.get('street_address'),
        delivery_city: formData.get('delivery_city'),
        delivery_state: formData.get('delivery_state'),
        delivery_zip: formData.get('delivery_zip'),
        delivery_country: formData.get('delivery_country'),
        delivery_notes: formData.get('delivery_notes')
    };
    
    try {
        const response = await apiRequest(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
        });
        
        if (response.ok) {
            const orderResult = await response.json();
            alert(`Order placed successfully! Order ID: #${orderResult.order_id}\nTotal: $${(currentOrderPhone.price * quantity).toFixed(2)}`);
            e.target.reset();
            currentOrderPhone = null;
            showSection('phones');
            loadPhones();
        } else {
            const error = await response.json();
            alert('Error placing order: ' + error.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error placing order. Please try again.');
    }
}

// ========== PROFILE SECTION FUNCTIONS ==========
function setupProfileSection() {
    updateProfileSection();
}

function updateProfileSection() {
    const guestHint = document.getElementById('guest-profile-hint');
    const updateProfileSection = document.getElementById('update-profile-section');
    
    updateProfileDetails();
    
    if (currentUser) {
        if (guestHint) guestHint.style.display = 'none';
        if (updateProfileSection) updateProfileSection.style.display = 'block';
        
        if (updateProfileSection) {
            document.getElementById('update-username').value = currentUser.username;
            document.getElementById('update-email').value = currentUser.email || '';
        }
        
        loadUserOrderHistory();
        loadProfileStatistics();
    } else {
        if (guestHint) guestHint.style.display = 'block';
        if (updateProfileSection) updateProfileSection.style.display = 'none';
        
        showGuestOrderMessage();
        loadProfileStatistics();
    }
}

function updateProfileDetails() {
    const user = currentUser;
    
    if (document.getElementById('profile-username')) {
        document.getElementById('profile-username').textContent = user ? user.username : 'Guest User';
    }
    if (document.getElementById('profile-email')) {
        document.getElementById('profile-email').textContent = user ? user.email : 'Not logged in';
    }
    
    if (document.getElementById('info-username')) {
        document.getElementById('info-username').textContent = user ? user.username : '-';
    }
    if (document.getElementById('info-email')) {
        document.getElementById('info-email').textContent = user ? user.email : '-';
    }
    if (document.getElementById('info-account-type')) {
        document.getElementById('info-account-type').textContent = user ? (user.is_admin ? 'Administrator' : 'Regular User') : 'Guest';
    }
    
    const userTypeBadge = document.getElementById('user-type-badge');
    if (userTypeBadge) {
        if (user) {
            userTypeBadge.textContent = user.is_admin ? 'Admin' : 'Member';
            userTypeBadge.className = `badge ${user.is_admin ? 'admin' : 'member'}`;
        } else {
            userTypeBadge.textContent = 'Guest';
            userTypeBadge.className = 'badge guest';
        }
    }
}

async function loadProfileStatistics() {
    if (!currentUser) {
        document.getElementById('total-orders').textContent = '0';
        document.getElementById('total-spent').textContent = '$0';
        document.getElementById('completed-orders').textContent = '0';
        return;
    }

    try {
        const response = await apiRequest(`${API_BASE}/user/orders`);
        const data = await response.json();
        const orders = data.orders || [];

        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + parseFloat(order.total_price || 0), 0);
        const completedOrders = orders.filter(order => order.status === 'completed' || order.status === 'delivered').length;

        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('total-spent').textContent = `$${totalSpent.toFixed(2)}`;
        document.getElementById('completed-orders').textContent = completedOrders;

    } catch (error) {
        console.error('Error loading profile statistics:', error);
        document.getElementById('total-orders').textContent = '0';
        document.getElementById('total-spent').textContent = '$0';
        document.getElementById('completed-orders').textContent = '0';
    }
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please log in to update your profile.');
        return;
    }
    
    const formData = new FormData(e.target);
    const profileData = {
        username: formData.get('username'),
        email: formData.get('email')
    };
    
    try {
        const response = await apiRequest(`${API_BASE}/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData)
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('auth_token', data.session_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            updateUIForUser(currentUser);
            updateProfileSection();
            alert('Profile updated successfully!');
        } else {
            const error = await response.json();
            alert('Error updating profile: ' + error.error);
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile. Please try again.');
    }
}

async function loadUserOrderHistory() {
    if (!currentUser) {
        showGuestOrderMessage();
        return;
    }

    try {
        const response = await apiRequest(`${API_BASE}/user/orders`);
        const data = await response.json();
        displayUserOrderHistory(data.orders);
    } catch (error) {
        console.error('Error loading order history:', error);
        showOrderHistoryError();
    }
}

function displayUserOrderHistory(orders) {
    const container = document.getElementById('order-history-list');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="no-orders-message">
                <div class="no-orders-icon">
                    <i class="fas fa-shopping-bag"></i>
                </div>
                <h4>No Orders Yet</h4>
                <p>You haven't placed any orders yet. Start shopping to see your order history here.</p>
                <button class="btn btn-primary" onclick="showSection('phones')">
                    <i class="fas fa-shopping-cart"></i> Start Shopping
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th>Order ID</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                    ${currentUser.is_admin ? '<th>Customer</th>' : ''}
                    ${currentUser.is_admin ? '<th>Address</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${orders.map(order => `
                    <tr>
                        <td>#${order.id}</td>
                        <td>
                            <strong>${order.brand} ${order.model}</strong><br>
                            <small>${order.storage} • ${order.color}</small>
                        </td>
                        <td>${order.quantity}</td>
                        <td>$${order.total_price}</td>
                        <td>
                            <span class="status ${order.status}">
                                ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                        </td>
                        <td>${new Date(order.created_at).toLocaleDateString()}</td>
                        ${currentUser.is_admin ? `
                            <td>
                                <div><strong>${order.customer_name}</strong></div>
                                <small>${order.customer_email}</small>
                                <div><small>${order.customer_phone}</small></div>
                            </td>
                        ` : ''}
                        ${currentUser.is_admin ? `
                            <td>
                                <small>${order.house_number} ${order.street_address}</small><br>
                                <small>${order.delivery_city}, ${order.delivery_state} ${order.delivery_zip}</small>
                            </td>
                        ` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showGuestOrderMessage() {
    const container = document.getElementById('order-history-list');
    if (!container) return;

    container.innerHTML = `
        <div class="guest-order-message">
            <div class="guest-icon">
                <i class="fas fa-shopping-cart"></i>
            </div>
            <h4>No Order History</h4>
            <p>Your order history will appear here once you place orders with a registered account.</p>
            <div class="guest-actions">
                <button class="btn btn-primary" onclick="redirectToRegister()">
                    <i class="fas fa-user-plus"></i> Register to Track Orders
                </button>
                <button class="btn btn-secondary" onclick="showSection('phones')">
                    <i class="fas fa-shopping-bag"></i> Browse Products
                </button>
            </div>
        </div>
    `;
}

function refreshOrders() {
    loadUserOrderHistory();
    if (currentUser) {
        loadProfileStatistics();
    }
}

function redirectToRegister() {
    window.location.href = 'register.html';
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

// ========== ADMIN ORDER MANAGEMENT ==========
async function loadOrders() {
    try {
        const response = await apiRequest(`${API_BASE}/orders`);
        const data = await response.json();
        displayOrders(data.orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        showStatusMessage('Error loading orders. Please try again.', 'error');
    }
}

function displayOrders(orders) {
    const tbody = document.querySelector('#orders-management-table tbody');
    if (!tbody) return;
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="no-orders">
                    <div class="no-orders-message">
                        <i class="fas fa-box-open"></i>
                        <h4>No Orders Found</h4>
                        <p>There are no orders in the system yet.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr data-order-id="${order.id}" data-status="${order.status}">
            <td><strong>#${order.id}</strong></td>
            <td>
                <div class="product-info">
                    <strong>${order.brand} ${order.model}</strong><br>
                    <small class="product-specs">${order.storage} • ${order.color}</small>
                </div>
            </td>
            <td>
                <div class="customer-info">
                    <strong>${order.customer_name}</strong>
                </div>
            </td>
            <td>
                <div class="contact-info">
                    <div><i class="fas fa-envelope"></i> ${order.customer_email}</div>
                    <div><i class="fas fa-phone"></i> ${order.customer_phone}</div>
                </div>
            </td>
            <td><span class="quantity-badge">${order.quantity}</span></td>
            <td><strong>$${parseFloat(order.total_price).toFixed(2)}</strong></td>
            <td>
                <div class="status-control">
                    <select class="status-select" onchange="updateOrderStatus(${order.id}, this.value)" 
                            ${!currentUser?.is_admin ? 'disabled' : ''}>
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>🚚 Shipped</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>📦 Delivered</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
                    </select>
                </div>
            </td>
            <td>
                <div class="address-info">
                    <div class="full-address">
                        <i class="fas fa-home"></i>
                        <span>${order.house_number} ${order.street_address}</span>
                    </div>
                    <div class="location">
                        ${order.delivery_city}, ${order.delivery_state} ${order.delivery_zip}
                    </div>
                    <div class="country">${order.delivery_country}</div>
                    ${order.delivery_notes ? `
                        <div class="delivery-notes">
                            <small><i class="fas fa-sticky-note"></i> ${order.delivery_notes}</small>
                        </div>
                    ` : ''}
                </div>
            </td>
            <td>
                <div class="order-date">
                    ${new Date(order.created_at).toLocaleDateString()}<br>
                    <small>${new Date(order.created_at).toLocaleTimeString()}</small>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    ${currentUser?.is_admin ? `
                        <button class="btn btn-small btn-danger" onclick="deleteOrder(${order.id})" title="Delete Order">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, newStatus) {
    if (!currentUser || !currentUser.is_admin) {
        alert('Only administrators can update order status.');
        return;
    }
    
    try {
        const response = await apiRequest(`${API_BASE}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showStatusMessage(`Order #${orderId} status updated to ${newStatus}`, 'success');
            loadOrders(); // Reload to show updated status
        } else {
            const error = await response.json();
            alert('Error updating order status: ' + error.error);
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Error updating order status. Please try again.');
    }
}

async function deleteOrder(orderId) {
    if (!currentUser || !currentUser.is_admin) {
        alert('Only administrators can delete orders.');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete order #${orderId}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiRequest(`${API_BASE}/orders/${orderId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadOrders();
            showStatusMessage(`Order #${orderId} deleted successfully`, 'success');
        } else {
            const error = await response.json();
            alert('Error deleting order: ' + error.error);
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Error deleting order. Please try again.');
    }
}

// ========== REPORT FUNCTIONS ==========
function showReport(reportType) {
    document.querySelectorAll('.report-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${reportType}-report`).classList.add('active');
    event.target.classList.add('active');
    
    if (reportType === 'sales') {
        loadSalesReport();
    } else if (reportType === 'stock') {
        loadStockReport();
    } else if (reportType === 'orders') {
        loadOrdersReport();
    }
}

async function loadSalesReport() {
    try {
        const response = await apiRequest(`${API_BASE}/orders`);
        const data = await response.json();
        const orders = data.orders || [];
        
        // Calculate sales by product
        const salesMap = {};
        orders.forEach(order => {
            const key = `${order.brand}-${order.model}`;
            if (!salesMap[key]) {
                salesMap[key] = {
                    brand: order.brand,
                    model: order.model,
                    orders_count: 0,
                    total_quantity: 0,
                    total_revenue: 0
                };
            }
            salesMap[key].orders_count += 1;
            salesMap[key].total_quantity += order.quantity;
            salesMap[key].total_revenue += parseFloat(order.total_price);
        });
        
        const sales = Object.values(salesMap);
        displaySalesReport(sales);
    } catch (error) {
        console.error('Error loading sales report:', error);
    }
}

function displaySalesReport(sales) {
    const tbody = document.querySelector('#sales-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = sales.map(sale => `
        <tr>
            <td>${sale.brand}</td>
            <td>${sale.model}</td>
            <td>${sale.orders_count}</td>
            <td>${sale.total_quantity}</td>
            <td>$${sale.total_revenue?.toFixed(2) || '0.00'}</td>
        </tr>
    `).join('');
}

async function loadStockReport() {
    try {
        const response = await fetch(`${API_BASE}/phones`);
        const data = await response.json();
        displayStockReport(data.phones);
    } catch (error) {
        console.error('Error loading stock report:', error);
    }
}

function displayStockReport(stock) {
    const tbody = document.querySelector('#stock-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = stock.map(item => {
        let statusClass = 'in-stock';
        let statusText = 'In Stock';
        
        if (item.stock_quantity === 0) {
            statusClass = 'out-of-stock';
            statusText = 'Out of Stock';
        } else if (item.stock_quantity <= 10) {
            statusClass = 'low-stock';
            statusText = 'Low Stock';
        }
        
        return `
            <tr>
                <td>${item.brand}</td>
                <td>${item.model}</td>
                <td>${item.stock_quantity}</td>
                <td>$${item.price}</td>
                <td>
                    <span class="stock-status ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadOrdersReport() {
    try {
        const response = await apiRequest(`${API_BASE}/orders`);
        const data = await response.json();
        displayOrdersReport(data.orders);
    } catch (error) {
        console.error('Error loading orders report:', error);
    }
}

function displayOrdersReport(orders) {
    const tbody = document.querySelector('#orders-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.brand} ${order.model}</td>
            <td>${order.customer_name}</td>
            <td>${order.customer_email}</td>
            <td>${order.quantity}</td>
            <td>$${order.total_price}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

function showStatusMessage(message, type = 'info') {
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${message}
        <button class="close-message" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    const container = document.querySelector('#admin-orders .container');
    const tableContainer = container.querySelector('.table-container');
    container.insertBefore(messageDiv, tableContainer);
    
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 5000);
}

function filterOrders() {
    const statusFilter = document.getElementById('status-filter').value;
    const rows = document.querySelectorAll('#admin-orders-management-table tbody tr');  // Fixed selector to match ID
    
    rows.forEach(row => {
        if (row.querySelector('.no-orders')) {
            return;
        }
        
        if (statusFilter === 'all' || row.getAttribute('data-status') === statusFilter) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// ========== UTILITY FUNCTIONS ==========
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('auth_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            currentUser = null;
            updateUIForUser(null);
            throw new Error('Authentication required. Please login again.');
        }
        
        if (response.status === 403) {
            throw new Error('You do not have permission to perform this action.');
        }
        
        return response;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

async function checkBackendStatus() {
    try {
        const healthResponse = await fetch(`${API_BASE}/health`);
        const dbResponse = await fetch(`${API_BASE}/db-check`);
        
        const health = await healthResponse.json();
        const db = await dbResponse.json();
        
        console.log('🔧 Backend Status:', health);
        console.log('📊 Database Status:', db);
        
        return { health, db };
    } catch (error) {
        console.error('❌ Cannot connect to backend:', error);
        alert('Cannot connect to backend server. Please make sure the Flask server is running on http://localhost:5000');
        return null;
    }
}

function setupFAQ() {
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            answer.classList.toggle('active');
            
            const icon = question.querySelector('i');
            if (icon) {
                icon.style.transform = answer.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    });
}

// ========== HOME PAGE FUNCTIONS ==========
async function loadFeaturedPhones() {
    try {
        const response = await fetch(`${API_BASE}/phones`);
        const data = await response.json();
        const featuredContainer = document.getElementById('featured-phones');
        
        if (featuredContainer && data.phones) {
            const featuredPhones = data.phones.slice(0, 3);
            featuredContainer.innerHTML = featuredPhones.map(phone => {
                const stockStatus = phone.stock_quantity === 0 ? 'out-of-stock' : 
                                   phone.stock_quantity <= 10 ? 'low-stock' : 'in-stock';
                const stockText = phone.stock_quantity === 0 ? 'Out of Stock' : 
                                 phone.stock_quantity <= 10 ? `Only ${phone.stock_quantity} left` : 'In Stock';
                
                return `
                <div class="phone-card">
                    <div class="phone-image">
                        ${phone.image_url ? 
                            `<img src="${phone.image_url}" alt="${phone.brand} ${phone.model}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                            `<div class="phone-image-placeholder">
                                <i class="fas fa-mobile-alt"></i>
                            </div>`
                        }
                        <div class="stock-badge ${stockStatus}">${stockText}</div>
                    </div>
                    <div class="phone-content">
                        <div class="phone-brand">${phone.brand}</div>
                        <h3 class="phone-model">${phone.model}</h3>
                        <div class="phone-price">$${phone.price}</div>
                        <div class="phone-specs">
                            <span><i class="fas fa-hdd"></i> ${phone.storage}</span>
                            <span><i class="fas fa-palette"></i> ${phone.color}</span>
                        </div>
                        <p class="phone-description">${phone.description || 'Premium smartphone with latest features'}</p>
                        <div class="phone-actions">
                            <button class="btn btn-primary" onclick="showOrderForm(${phone.id})" ${phone.stock_quantity === 0 ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart"></i> ${phone.stock_quantity === 0 ? 'Out of Stock' : 'Buy Now'}
                            </button>
                            <button class="btn btn-secondary" onclick="showSection('phones')">
                                <i class="fas fa-info"></i> View All
                            </button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading featured phones:', error);
    }
}

// ========== ADMIN BUTTON MANAGEMENT ==========
function updateAdminButtons() {
    const addPhoneBtn = document.getElementById('add-phone-btn');
    const fabAdmin = document.getElementById('fab-admin');
    
    if (currentUser && currentUser.is_admin) {
        if (addPhoneBtn) addPhoneBtn.style.display = 'flex';
        if (fabAdmin) fabAdmin.style.display = 'flex';
    } else {
        if (addPhoneBtn) addPhoneBtn.style.display = 'none';
        if (fabAdmin) fabAdmin.style.display = 'none';
    }
}

// ========== SAMPLE PHONES FUNCTION ==========
// FIXED: loadSamplePhones() also wrong URL
async function loadSamplePhones() {
    if (!confirm('Add sample phones?')) return;

    const samplePhones = [/* your data */];

    try {
        for (const phone of samplePhones) {
            const resp = await apiRequest(`${API_BASE}/admin/phones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(phone)
            });
            if (!resp.ok) throw new Error('Failed to add sample');
        }
        alert('Sample phones added!');
        loadPhones();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Simple filter functions
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const brandFilter = document.getElementById('brand-filter').value;
    const minPrice = document.getElementById('min-price-filter').value;
    const maxPrice = document.getElementById('max-price-filter').value;
    const sortBy = document.getElementById('sort-filter').value;
    
    let filteredPhones = allPhones.filter(phone => {
        const matchesSearch = phone.brand.toLowerCase().includes(searchTerm) || 
                             phone.model.toLowerCase().includes(searchTerm) ||
                             phone.description.toLowerCase().includes(searchTerm);
        const matchesBrand = !brandFilter || phone.brand === brandFilter;
        const matchesMinPrice = !minPrice || phone.price >= parseFloat(minPrice);
        const matchesMaxPrice = !maxPrice || phone.price <= parseFloat(maxPrice);
        
        return matchesSearch && matchesBrand && matchesMinPrice && matchesMaxPrice;
    });
    
    // Sort the filtered phones
    filteredPhones.sort((a, b) => {
        switch (sortBy) {
            case 'price_low':
                return a.price - b.price;
            case 'price_high':
                return b.price - a.price;
            case 'name':
                return a.model.localeCompare(b.model);
            case 'newest':
            default:
                return b.id - a.id;
        }
    });
    
    displayPhones(filteredPhones);
}

function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('brand-filter').value = '';
    document.getElementById('min-price-filter').value = '';
    document.getElementById('max-price-filter').value = '';
    document.getElementById('sort-filter').value = 'newest';
    
    displayPhones(allPhones);
}

// Temporary debug function - add this to test deletion
async function debugDeletePhone(phoneId) {
    console.log('=== DEBUG DELETE PHONE ===');
    console.log('Phone ID:', phoneId);
    console.log('Current User:', currentUser);
    console.log('API Base URL:', API_BASE);
    
    // Test if the endpoint exists
    try {
        const testResponse = await fetch(`${API_BASE}/phones/${phoneId}`);
        console.log('Phone exists test:', testResponse.status);
        
        if (testResponse.ok) {
            const phoneData = await testResponse.json();
            console.log('Phone data:', phoneData);
        }
    } catch (error) {
        console.error('Test fetch error:', error);
    }
    
    // Now try the actual delete
    await deletePhone(phoneId);
}