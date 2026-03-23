// === SUPABASE CONFIGURATION ===
const supabaseUrl = 'https://jbuhzyuhpubkgsuwjxtv.supabase.co'; // <--- REPLACE THIS
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidWh6eXVocHVia2dzdXdqeHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjc1MjYsImV4cCI6MjA4OTg0MzUyNn0.e5r3GbxbzBVCZq1sDeDMxGIAU1KmqSmdC4sh-CPadbc'; // <--- REPLACE THIS with the key starting with eyJ...
if (supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
    console.error('CRITICAL: You must replace "YOUR_SUPABASE_ANON_KEY" in script.js with your actual Supabase Anon Key.');
}
const supabaseClient = typeof window.supabase !== 'undefined' ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

// === THEME TOGGLE FUNCTIONALITY ===
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;
const icon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

// === PROFESSIONAL TOAST NOTIFICATIONS ===
// Create container if not exists
let toastContainer = document.querySelector('.toast-container');
if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
}

window.showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Sound effect for error/success
    if (type === 'error') { /* Optional: Add error sound logic */ }

    // Remove after 3.5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

// Global Chat Variables
let currentChatRecipient = null;
const chatNotificationSound = new Audio('https://cdn.freesound.org/previews/536/536108_1415754-lq.mp3'); // Simple beep sound
let chatChannel = null;
let typingTimeout = null;
let currentReply = null; // Stores info about message being replied to

// Request Notification Permission on load
if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
}

// Initialize Realtime Subscription
if (supabaseClient) {
    chatChannel = supabaseClient
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
            handleRealtimeMessage(payload);
        })
        .on('broadcast', { event: 'typing' }, payload => {
            handleTypingIndicator(payload.payload);
        })
        .subscribe();
}

// Check Local Storage for Theme Preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    body.classList.add('light-mode');
    if (icon) {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// Toggle Theme on Click
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        
        if (body.classList.contains('light-mode')) {
            localStorage.setItem('theme', 'light');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            localStorage.setItem('theme', 'dark');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    });
}

// === SELLER DASHBOARD: ADD PRODUCT LOGIC ===
const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const closeModal = document.querySelector('.close-modal');
const addProductForm = document.getElementById('addProductForm');

// Toggle Price Input based on Checkbox
const contactForPriceCheckbox = document.getElementById('contactForPrice');
const prodPriceInput = document.getElementById('prodPrice');

if (contactForPriceCheckbox && prodPriceInput) {
    contactForPriceCheckbox.addEventListener('change', (e) => {
        prodPriceInput.disabled = e.target.checked;
        prodPriceInput.required = !e.target.checked;
        if (e.target.checked) prodPriceInput.value = '';
    });
}

// Open Modal
if (addProductBtn && productModal) {
    addProductBtn.addEventListener('click', () => {
        productModal.classList.add('active');
    });
}

// Close Modal
if (closeModal && productModal) {
    closeModal.addEventListener('click', () => {
        productModal.classList.remove('active');
    });
    
    // Close if clicked outside
    window.addEventListener('click', (e) => {
        if (e.target === productModal) {
            productModal.classList.remove('active');
        }
    });
}

// Handle Form Submission
if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return showToast('You must be logged in.', 'error');

        // Image Upload Logic
        const imageFile = document.getElementById('prodImage').files[0];
        let imageUrl = null;

        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('product-images')
                .upload(fileName, imageFile);
            
            if (uploadError) return showToast('Image upload failed: ' + uploadError.message, 'error');
            
            const { data: { publicUrl } } = supabaseClient.storage
                .from('product-images')
                .getPublicUrl(fileName);
            imageUrl = publicUrl;
        }

        const contactCheckbox = document.getElementById('contactForPrice');
        
        const newProduct = {
            seller_id: user.id,
            name: document.getElementById('prodName').value,
            category: document.getElementById('prodCategory').value,
            price: (contactCheckbox && contactCheckbox.checked) ? 'Contact for Price' : document.getElementById('prodPrice').value,
            description: document.getElementById('prodDesc').value,
            image_url: imageUrl
        };

        const { error } = await supabaseClient.from('products').insert([newProduct]);

        if (error) showToast('Error adding product: ' + error.message, 'error');
        else {
            showToast('Product added successfully!', 'success');
            productModal.classList.remove('active');
            addProductForm.reset();
            // Optionally refresh the product list here
            loadSellerProducts(); // Refresh list immediately
        }
    });
}

// === AUTHENTICATION LOGIC ===

// 1. Handle Registration
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    // Set role based on URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || 'customer';
    document.getElementById('role').value = role;
    document.getElementById('register-title').innerText = role === 'seller' ? 'Register Business' : 'Customer Registration';
    
    // Show seller fields if registering as a business
    if (role === 'seller') {
        const sellerFields = document.getElementById('seller-fields');
        if (sellerFields) {
            sellerFields.style.display = 'block';
            document.getElementById('businessName').setAttribute('required', 'true');
            document.getElementById('businessType').setAttribute('required', 'true');
            document.getElementById('location').setAttribute('required', 'true');
        }
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = registerForm.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Creating Account...';
        
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const userRole = document.getElementById('role').value;

        // Check for business docs if seller
        const profilePicFile = document.getElementById('profilePic').files[0];
        const businessDesc = document.getElementById('businessDesc') ? document.getElementById('businessDesc').value : '';
        const docFile = document.getElementById('businessDocs').files[0];
        if (userRole === 'seller' && !docFile) {
            showToast("Please upload business documents to proceed.", 'error');
            btn.disabled = false; btn.innerText = originalText;
            return;
        }

        if (!supabaseClient) {
            showToast("System Error: Supabase not initialized.", 'error');
            btn.disabled = false; btn.innerText = originalText;
            return;
        }

        // Capture seller details if applicable
        let metadata = {
            full_name: fullName,
            role: userRole
        };

        if (userRole === 'seller') {
            metadata.business_name = document.getElementById('businessName').value;
            metadata.business_type = document.getElementById('businessType').value;
            metadata.location = document.getElementById('location').value;
            metadata.description = businessDesc;
        }

        // SYSTEM: Auto-assign 'admin' role if the email starts with "admin"
        if (email.toLowerCase().startsWith('admin') || email.toLowerCase() === 'elinjava9@gmail.com') {
            metadata.role = 'admin';
        }

        // Prepare profile data (for public table)
        const profileData = {
            email: email,
            full_name: fullName,
            role: metadata.role,
            business_name: metadata.business_name || null,
            business_type: metadata.business_type || null,
            description: metadata.description || null,
            verified: metadata.role === 'seller' ? false : true // Sellers need verification
        };

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: metadata,
                    emailRedirectTo: window.location.origin + '/login.html'
                }
            });

            if (error) throw error;

            // Upload Profile Picture (if any)
            let avatarUrl = null;
            if (profilePicFile && data.user) {
                const fileExt = profilePicFile.name.split('.').pop();
                const fileName = `${data.user.id}/avatar_${Date.now()}.${fileExt}`;
                const { error: avError } = await supabaseClient.storage.from('avatars').upload(fileName, profilePicFile);
                if (!avError) {
                    const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                    avatarUrl = urlData.publicUrl;
                }
            }

            // Upload Document if Seller
            let docUrl = null;
            if (userRole === 'seller' && docFile && data.user) {
                const fileExt = docFile.name.split('.').pop();
                const fileName = `${data.user.id}/business_doc.${fileExt}`;
                const { error: uploadError } = await supabaseClient.storage.from('business-docs').upload(fileName, docFile);
                
                if (!uploadError) {
                    const { data: urlData } = supabaseClient.storage.from('business-docs').getPublicUrl(fileName);
                    docUrl = urlData.publicUrl;
                }
            }

            // Create Public Profile Record
            if (data.user) {
                await supabaseClient.from('profiles').insert([
                    { id: data.user.id, ...profileData, documents_url: docUrl, avatar_url: avatarUrl }
                ]);
            }

            showToast('Registration successful! Check email to verify.', 'success');
            setTimeout(() => window.location.href = 'login.html', 2000);

        } catch (error) {
            console.error(error); // See the exact error in the browser console (F12)
            showToast('Error registering: ' + error.message, 'error');
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}

// === ADMIN LOGIN SHORTCUT (Footer Link) ===
const adminLink = document.getElementById('admin-link');
if (adminLink) {
    adminLink.addEventListener('click', (e) => {
        e.preventDefault(); 
        // If on login page, autofill. If elsewhere, redirect then autofill.
        if (window.location.pathname.includes('login.html')) {
            const emailField = document.getElementById('email');
            if (emailField) emailField.value = 'elinjava9@gmail.com'; // Autofill suggestion
            showToast('Admin Login: Please enter password', 'info');
        } else {
            window.location.href = 'login.html?admin_fill=true';
        }
    });
}

// 2. Handle Login
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    if (new URLSearchParams(window.location.search).get('admin_fill') === 'true') {
        document.getElementById('email').value = 'elinjava9@gmail.com';
    }
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Logging in...';
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!supabaseClient) {
            showToast("System Error: Configuration missing.", 'error');
            btn.disabled = false; btn.innerText = originalText;
            return;
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            // Redirect based on role stored in metadata
            let role = data.user.user_metadata.role || 'customer';
            
            // Auto-promote any email starting with 'admin' if not already set
            if ((email.toLowerCase().startsWith('admin') || email.toLowerCase() === 'elinjava9@gmail.com') && role !== 'admin') {
                const { data: updateData, error: updateError } = await supabaseClient.auth.updateUser({
                    data: { role: 'admin' }
                });
                if (!updateError && updateData.user) {
                    role = 'admin';
                    await supabaseClient.auth.refreshSession(); // Force session refresh so dashboard accepts the new role
                }
            }
            
            if (role === 'admin') {
                window.location.href = 'dashboard-admin.html';
            } else if (role === 'seller') {
                window.location.href = 'dashboard-seller.html';
            } else {
                window.location.href = 'dashboard-customer.html';
            }

        } catch (error) {
            console.error(error);
            showToast('Login failed: ' + error.message, 'error');
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });
}

// 4. Handle Forgot Password
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        if (!email) return showToast("Please enter your email address first.", 'info');
        
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/change-password.html' // Redirect to new page
        });

        if (error) showToast("Error: " + error.message, 'error');
        else showToast("Password reset email sent! Check inbox.", 'success');
    });
}

// 5. Handle Change Password Page Submission
const changePasswordForm = document.getElementById('changePasswordForm');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;

        // Update user's password (session is already active from the email link)
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

        if (error) {
            showToast("Error updating password: " + error.message, 'error');
        } else {
            showToast("Password updated! Redirecting...", 'success');
            setTimeout(() => window.location.href = 'login.html', 1500);
        }
    });
}

// 3. Handle Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (!error) {
            window.location.href = 'login.html';
        }
    });
}

// === CONTACT FORM VALIDATION ===
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const subject = document.getElementById('subject').value.trim();
        const message = document.getElementById('message').value.trim();
        
        let isValid = true;
        let errorMessage = "";

        // Simple empty check
        if (!name || !email || !subject || !message) {
            isValid = false;
            errorMessage = "Please fill in all fields.";
        } else {
            // Email format check
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                isValid = false;
                errorMessage = "Please enter a valid email address.";
            }
        }

        if (!isValid) {
            e.preventDefault();
            showToast(errorMessage, 'error');
        } else {
            // Allow submission (for demo purposes we alert success)
            showToast("Message sent successfully!", 'success');
        }
    });
}

// === ADMIN DASHBOARD LOGIC ===
async function loadAdminData() {
    console.log("Loading Admin Data...");

    // 1. Stats
    const { count: userCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'seller');
    const { count: sellerCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller');
    const { count: pendingCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller').eq('verified', false);

    if (document.getElementById('total-users-count')) document.getElementById('total-users-count').innerText = userCount || 0;
    if (document.getElementById('total-sellers-count')) document.getElementById('total-sellers-count').innerText = sellerCount || 0;
    if (document.getElementById('pending-count')) document.getElementById('pending-count').innerText = pendingCount || 0;

    // 2. Pending Verifications
    const pendingTable = document.getElementById('pending-sellers-table');
    if (pendingTable) {
        const { data: pendingSellers } = await supabaseClient.from('profiles').select('*').eq('role', 'seller').eq('verified', false);
        
        if (!pendingSellers || pendingSellers.length === 0) {
            pendingTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending verifications.</td></tr>';
        } else {
            pendingTable.innerHTML = pendingSellers.map(seller => `
                <tr>
                    <td>${seller.business_name || 'N/A'}</td>
                    <td>${seller.full_name}</td>
                    <td>${seller.email}</td>
                    <td>${seller.documents_url ? `<a href="${seller.documents_url}" target="_blank" style="color:#1e90ff; text-decoration:underline;">View Docs</a>` : 'N/A'}</td>
                    <td>
                        <button onclick="verifySeller('${seller.id}', true)" class="btn-primary" style="padding: 5px 10px; font-size: 12px; background: #28a745;">Approve</button>
                        <button onclick="verifySeller('${seller.id}', false)" class="btn-primary" style="padding: 5px 10px; font-size: 12px; background: #dc3545;">Reject</button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // 3. Platform Reports (Products Analytics)
    const reportsContainer = document.getElementById('reports-container');
    if (reportsContainer) {
        const { data: products } = await supabaseClient.from('products').select('*');
        if (products) {
            const totalProducts = products.length;
            const totalValue = products.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0);
            const avgPrice = totalProducts ? (totalValue / totalProducts).toFixed(2) : 0;

            reportsContainer.innerHTML = `
                <h3>Platform Analytics</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>${totalProducts}</h3>
                            <p>Total Products Listed</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>K${totalValue.toLocaleString()}</h3>
                            <p>Total Inventory Value</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-info">
                            <h3>K${avgPrice}</h3>
                            <p>Average Product Price</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// === USER MANAGEMENT LOGIC ===
async function loadAllUsers() {
    const container = document.getElementById('users-list-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading users...</p>';
    
    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p>Error loading users: ${error.message}</p>`;
        return;
    }

    if (!users || users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }

    let html = `
    <table class="data-table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Business</th>
                <th>Verified</th>
                <th>Joined</th>
            </tr>
        </thead>
        <tbody>`;
    
    html += users.map(u => `
        <tr>
            <td>${u.full_name || 'N/A'}</td>
            <td>${u.email || 'N/A'}</td>
            <td>${u.role || 'customer'}</td>
            <td>${u.business_name || '-'}</td>
            <td>${u.verified ? '<span class="status completed">Yes</span>' : '<span class="status pending">No</span>'}</td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Global function for button onclick access
window.verifySeller = async (userId, approve) => {
    if (approve) {
        const { error } = await supabaseClient.from('profiles').update({ verified: true }).eq('id', userId);
        if (error) showToast('Error: ' + error.message, 'error');
        else {
            showToast('Seller approved successfully.', 'success');
            loadAdminData(); // Refresh UI
        }
    } else {
        if(confirm('Are you sure you want to reject this seller?')) {
            // Logic to delete or mark rejected could go here
            showToast('Seller rejected.', 'info');
        }
    }
};

// === MESSAGING LOGIC ===

// 1. Handle Incoming Realtime Messages
async function handleRealtimeMessage(payload) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const msg = payload.new;
    const eventType = payload.eventType;

    // Handle Message Deletion
    if (eventType === 'DELETE') {
        const deletedId = payload.old.id;
        // Remove from Chat Modal
        const bubble = document.getElementById(`msg-${deletedId}`);
        if (bubble) bubble.remove();
        
        // Update Inbox Preview if exists
        loadMessages(); 
        return;
    }

    // 0. Handle Sound & Push Notifications (If message is for me)
    if (eventType === 'INSERT' && msg.receiver_id === user.id) {
        // Play sound
        chatNotificationSound.play().catch(() => {}); // Catch error if user hasn't interacted yet
        
        // Show browser notification if tab is hidden
        if (document.hidden && Notification.permission === "granted") {
            new Notification("New Message", { body: msg.content });
        }
    }

    // Handle Read Receipt Updates (UPDATE event)
    if (eventType === 'UPDATE') {
        // Update the checkmark in the DOM if it exists
        const checkEl = document.getElementById(`msg-check-${msg.id}`);
        if (checkEl && msg.is_read) {
            checkEl.innerHTML = '<i class="fas fa-check-double"></i>'; // Change to double check
            checkEl.classList.add('read');
        }
        return; // Stop processing, we don't need to re-append
    }

    // 1. Handle Chat Modal (Popup)
    if (document.getElementById('chatModal') && 
        document.getElementById('chatModal').classList.contains('active')) {
        
        if ((msg.sender_id === user.id && msg.receiver_id === currentChatRecipient) || 
            (msg.sender_id === currentChatRecipient && msg.receiver_id === user.id)) {
            appendMessageToChat(msg, user.id);
            scrollToBottom();
            
            // If I am receiving this message and chat is open, mark as read immediately
            if (msg.receiver_id === user.id) {
                await supabaseClient.from('messages').update({ is_read: true }).eq('id', msg.id);
                checkUnreadMessages(); // Update badge immediately
            }
        }
    }

    // 2. Handle Full Page Chat (messages.html)
    if (window.location.pathname.includes('messages.html')) {
        // Refresh sidebar list to show new message preview/time
        loadConversations(); 
        
        // If viewing this chat, append message
        if ((msg.sender_id === user.id && msg.receiver_id === currentChatRecipient) || 
            (msg.sender_id === currentChatRecipient && msg.receiver_id === user.id)) {
            appendMessageToChat(msg, user.id);
            scrollToBottom();
            
            // Mark as read immediately
            if (msg.receiver_id === user.id) {
                await supabaseClient.from('messages').update({ is_read: true }).eq('id', msg.id);
                checkUnreadMessages(); // Update badge immediately
            }
        }
    }

    // Always refresh unread counts
    checkUnreadMessages();
    
    // Refresh inbox list if viewing it
    const inboxContainer = document.getElementById('messages-container');
    if (inboxContainer && inboxContainer.offsetParent !== null) {
        loadMessages();
    }
}

// 2. Open Chat Interface (Replaces old Contact Modal)
window.openChatModal = async (partnerId, productId = null, productName = null) => {
    const modal = document.getElementById('chatModal');
    if(!modal) return;
    
    currentChatRecipient = partnerId;
    document.getElementById('chatRecipientId').value = partnerId;
    
    // Fetch User Name for Modal Title
    const { data: profile } = await supabaseClient.from('profiles').select('full_name, business_name').eq('id', partnerId).single();
    const displayName = profile ? (profile.business_name || profile.full_name) : 'User';

    document.getElementById('chatHeaderTitle').innerText = displayName;

    if (productId) document.getElementById('chatProductId').value = productId;
    else document.getElementById('chatProductId').value = '';

    // Inject Reply Preview Bar if not present
    let replyPreviewEl = document.getElementById('chatReplyPreview');
    const chatInputArea = document.getElementById('chatForm');
    if (!replyPreviewEl && chatInputArea) {
        replyPreviewEl = document.createElement('div');
        replyPreviewEl.id = 'chatReplyPreview';
        replyPreviewEl.className = 'reply-preview-bar';
        chatInputArea.parentNode.insertBefore(replyPreviewEl, chatInputArea);
    }
    // Reset reply state
    cancelReply();

    // === PRODUCT CONTEXT (FB Marketplace Style) ===
    let previewEl = document.getElementById('chatProductPreview');
    const modalContent = modal.querySelector('.modal-content');
    const chatHeader = modal.querySelector('.chat-header');
    const chatInput = document.getElementById('chatInput');

    if (!previewEl && modalContent && chatHeader) {
        previewEl = document.createElement('div');
        previewEl.id = 'chatProductPreview';
        previewEl.style.cssText = "background: var(--bg-light); padding: 10px 15px; border-bottom: 1px solid #333; display: none; align-items: center; gap: 15px; flex-shrink: 0; cursor: pointer; transition: background 0.2s;";
        previewEl.onmouseover = () => previewEl.style.background = '#2a2a2a';
        previewEl.onmouseout = () => previewEl.style.background = 'var(--bg-light)';
        chatHeader.parentNode.insertBefore(previewEl, chatHeader.nextSibling);
    }

    if (productId) {
        const { data: product } = await supabaseClient.from('products').select('*').eq('id', productId).single();
        if (product) {
            previewEl.style.display = 'flex';
            
            // Make clickable
            previewEl.onclick = () => {
                const detailsModal = document.getElementById('productDetailsModal');
                if(detailsModal) detailsModal.style.zIndex = '2200'; // Ensure it opens above chat
                openProductDetails(product.id);
            };
            previewEl.title = "View Product Details";

            previewEl.innerHTML = `
                <div style="width: 50px; height: 50px; border-radius: 6px; background: #333; overflow: hidden; flex-shrink: 0;">
                    <img src="${product.image_url || 'https://via.placeholder.com/50'}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex: 1; min-width: 0;">
                    <h4 style="margin: 0; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</h4>
                    <p style="margin: 3px 0 0; font-size: 13px; color: var(--primary-color); font-weight: 500;">
                        ${isNaN(parseFloat(product.price)) ? product.price : 'K' + product.price}
                    </p>
                </div>
                <i class="fas fa-chevron-right" style="color: #666; font-size: 12px;"></i>
            `;
            if (chatInput && !chatInput.value) chatInput.value = "Hi, is this item still available?";
        }
    } else {
        if (previewEl) previewEl.style.display = 'none';
        if (chatInput && chatInput.value === "Hi, is this item still available?") chatInput.value = "";
    }

    // Inject Typing Indicator HTML if not present
    let typingEl = document.getElementById('chatTypingIndicator');
    if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.id = 'chatTypingIndicator';
        typingEl.className = 'typing-indicator';
        typingEl.innerHTML = `<span>typing</span> <div class="typing-dots" style="display:inline-block"><span></span><span></span><span></span></div>`;
        document.getElementById('chatHistory').after(typingEl); // Place after history, before input
    }

    // Clear previous chat
    const historyContainer = document.getElementById('chatHistory');
    historyContainer.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">Loading history...</p>';
    
    modal.classList.add('active');
    await loadChatHistory(partnerId);
    cancelReply(); // Ensure clean state
};

// Alias for compatibility
window.openContactModal = window.openChatModal;

window.closeChatModal = () => {
    const modal = document.getElementById('chatModal');
    if(modal) modal.classList.remove('active');
    currentChatRecipient = null;
    cancelReply();
};

// === CHAT FILE UPLOAD HANDLERS ===
const chatFileBtn = document.getElementById('chatFileBtn');
const chatFileInput = document.getElementById('chatFileInput');

if (chatFileBtn && chatFileInput) {
    chatFileBtn.addEventListener('click', () => {
        chatFileInput.click();
    });

    chatFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('filePreview');
        if (file && preview) {
            preview.style.display = 'block';
            preview.innerText = `Image selected: ${file.name}`;
        } else if (preview) {
            preview.style.display = 'none';
        }
    });
}

const chatForm = document.getElementById('chatForm');
if(chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        if(!user) return showToast('Login to send messages.', 'error');
        
        const input = document.getElementById('chatInput');
        const fileInput = document.getElementById('chatFileInput');
        const content = input.value.trim(); // content is optional if image is present
        const file = fileInput ? fileInput.files[0] : null;

        // Stop typing indicator immediately on send
        if (chatChannel && currentChatRecipient) {
            chatChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { sender_id: user.id, receiver_id: currentChatRecipient, is_typing: false }
            });
        }

        if(!content && !file) return;

        // Handle Image Upload
        let imageUrl = null;
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `chat_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('chat-images')
                .upload(fileName, file);
            
            if (uploadError) {
                showToast('Upload failed: ' + uploadError.message, 'error');
                return;
            }
            
            const { data: { publicUrl } } = supabaseClient.storage.from('chat-images').getPublicUrl(fileName);
            imageUrl = publicUrl;
        }

        const messageData = {
            sender_id: user.id,
            receiver_id: document.getElementById('chatRecipientId').value,
            product_id: document.getElementById('chatProductId').value || null,
            product_name: document.getElementById('chatHeaderTitle').innerText.replace('Chat: ', '') || 'General',
            content: content || (imageUrl ? '📷 Image' : ''), // Fallback text
            image_url: imageUrl,
            // Add Reply Data
            reply_to_id: currentReply ? currentReply.id : null,
            reply_to_name: currentReply ? currentReply.name : null,
            reply_to_content: currentReply ? currentReply.content : null
        };
        
        // Clear input immediately for better UX
        input.value = '';
        if(fileInput) fileInput.value = '';
        if(document.getElementById('filePreview')) document.getElementById('filePreview').style.display = 'none';
        
        // Clear Reply State
        cancelReply();

        const { error } = await supabaseClient.from('messages').insert([messageData]);

        if(error) showToast('Failed to send message: ' + error.message, 'error');
    });
}

// === TYPING INDICATOR LOGIC ===
const chatInputEl = document.getElementById('chatInput');
if (chatInputEl) {
    chatInputEl.addEventListener('input', async () => {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user || !currentChatRecipient || !chatChannel) return;

        // Send "User is typing"
        chatChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { sender_id: user.id, receiver_id: currentChatRecipient, is_typing: true }
        });

        // Debounce: Stop typing after 2 seconds of inactivity
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            chatChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { sender_id: user.id, receiver_id: currentChatRecipient, is_typing: false }
            });
        }, 2000);
    });
}

async function handleTypingIndicator(payload) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Only show if the typing event is meant for ME and coming from the person I'm chatting with
    if (payload.receiver_id === user.id && payload.sender_id === currentChatRecipient) {
        const typingEl = document.getElementById('chatTypingIndicator');
        if (typingEl) {
            typingEl.style.display = payload.is_typing ? 'block' : 'none';
            if (payload.is_typing) {
                const history = document.getElementById('chatHistory');
                history.scrollTop = history.scrollHeight; // Keep scrolling to bottom
            }
        }
    }
}

// === REPLY LOGIC ===
window.replyToMessage = (id, content, senderName) => {
    currentReply = { id, content, name: senderName };
    
    const previewEl = document.getElementById('chatReplyPreview');
    if (previewEl) {
        previewEl.innerHTML = `
            <div>
                <span style="color:var(--primary-color); font-weight:bold;">Replying to ${senderName}</span><br>
                <span style="opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:250px; display:inline-block;">${content}</span>
            </div>
            <span class="close-reply" onclick="cancelReply()"><i class="fas fa-times"></i></span>
        `;
        previewEl.style.display = 'flex';
        document.getElementById('chatInput').focus();
    }
};

window.cancelReply = () => {
    currentReply = null;
    const previewEl = document.getElementById('chatReplyPreview');
    if (previewEl) previewEl.style.display = 'none';
};

async function loadChatHistory(partnerId) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if(!user) return;

    // Fetch conversation between me and partner
    const { data: messages, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

    const historyContainer = document.getElementById('chatHistory');
    historyContainer.innerHTML = '';

    if (error) {
        historyContainer.innerHTML = '<p style="color:red;">Error loading chat.</p>';
        return;
    }

    if (messages.length === 0) {
        historyContainer.innerHTML = '<p style="text-align:center; color:#555; margin-top:20px;">No messages yet. Say hi!</p>';
    } else {
        // Mark unread messages from this partner as read
        const unreadIds = messages.filter(m => m.receiver_id === user.id && !m.is_read).map(m => m.id);
        if (unreadIds.length > 0) {
            await supabaseClient.from('messages').update({ is_read: true }).in('id', unreadIds);
            checkUnreadMessages(); // Immediate badge update
        }

        messages.forEach(msg => appendMessageToChat(msg, user.id));
        scrollToBottom();
    }
}

function appendMessageToChat(msg, currentUserId) {
    const historyContainer = document.getElementById('chatHistory');
    const isSentByMe = msg.sender_id === currentUserId;

    // Determine Sender Name for Reply context (Simple approach: Me or Them)
    // For incoming messages, we don't have the sender's name in the row easily without a join, 
    // but we can infer "You" vs "Them" for the button.
    const senderNameForReply = isSentByMe ? 'You' : (document.getElementById('chatHeaderTitle').innerText || 'User');

    // Construct Quoted Message HTML if exists
    let quotedHtml = '';
    if (msg.reply_to_id) {
        quotedHtml = `
        <div class="quoted-message">
            <span class="quoted-name">${msg.reply_to_name || 'User'}</span>
            <span>${msg.reply_to_content || '...'}</span>
        </div>`;
    }
    
    // Checkmark Logic:
    // If sent by me: show checkmarks. If is_read is true -> Blue Double Check, else Grey Single Check
    let checkMarkHtml = '';
    if (isSentByMe) {
        const checkClass = msg.is_read ? 'msg-check read' : 'msg-check';
        const icon = msg.is_read ? 'fa-check-double' : 'fa-check';
        checkMarkHtml = `<span id="msg-check-${msg.id}" class="${checkClass}"><i class="fas ${icon}"></i></span>`;
    }

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isSentByMe ? 'message-sent' : 'message-received'}`;
    bubble.id = `msg-${msg.id}`; // Add ID for deletion
    bubble.innerHTML = `
        ${isSentByMe ? '' : `<div style="font-size:10px; color:#1e90ff; margin-bottom:2px;">${msg.product_name || 'General'}</div>`}
        ${quotedHtml}
        ${msg.image_url ? `<a href="${msg.image_url}" target="_blank"><img src="${msg.image_url}" class="chat-image"></a>` : ''}
        <span>${msg.content}</span>
        <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 4px; display:flex; align-items:center; justify-content:flex-end;">
            ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            ${checkMarkHtml}
            <span class="reply-btn" onclick="replyToMessage('${msg.id}', '${msg.content.replace(/'/g, "\\'")}', '${senderNameForReply}')" title="Reply"><i class="fas fa-reply"></i></span>
            <span class="delete-btn" onclick="deleteMessage('${msg.id}')" title="Delete message"><i class="fas fa-trash"></i></span>
        </div>
    `;
    historyContainer.appendChild(bubble);
}

function scrollToBottom() {
    const historyContainer = document.getElementById('chatHistory');
    if(historyContainer) historyContainer.scrollTop = historyContainer.scrollHeight;
}

// === FULL PAGE CHAT LOGIC (messages.html) ===

async function loadConversations() {
    const listContainer = document.getElementById('conversationList');
    if (!listContainer) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Fetch all messages involving user to group them
    const { data: messages, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

    if (error || !messages) {
        listContainer.innerHTML = '<p style="padding:20px; text-align:center;">Failed to load chats.</p>';
        return;
    }

    // Group by conversation partner
    const conversations = {};
    messages.forEach(msg => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!conversations[partnerId]) {
            conversations[partnerId] = {
                partnerId: partnerId,
                lastMessage: msg.content,
                time: msg.created_at,
                product: msg.product_name
            };
        }
    });

    const convArray = Object.values(conversations);
    
    if (convArray.length === 0) {
        listContainer.innerHTML = '<p style="padding:20px; text-align:center;">No conversations yet.</p>';
        return;
    }

    // 1. Get all unique partner IDs to fetch names
    const partnerIds = convArray.map(c => c.partnerId);
    const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name, business_name, avatar_url').in('id', partnerIds);
    
    const nameMap = {};
    if (profiles) {
        profiles.forEach(p => nameMap[p.id] = p.business_name || p.full_name);
    }

    // Render list
    listContainer.innerHTML = convArray.map(c => `
        <div class="wa-contact-item ${currentChatRecipient === c.partnerId ? 'active' : ''}" onclick="selectConversation('${c.partnerId}')">
            <div class="wa-avatar">
                ${(profiles && profiles.find(p=>p.id===c.partnerId)?.avatar_url) ? 
                `<img src="${profiles.find(p=>p.id===c.partnerId).avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : 
                `<i class="fas fa-user"></i>`}
            </div>
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="font-weight:600; color:var(--text-color);">${nameMap[c.partnerId] || 'User'}</span>
                    <span style="font-size:11px; color:var(--text-muted);">${new Date(c.time).toLocaleDateString()}</span>
                </div>
                <div style="font-size:13px; color:var(--text-muted); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; width:200px;">
                    ${c.lastMessage}
                </div>
            </div>
        </div>
    `).join('');
}

window.selectConversation = async (partnerId) => {
    currentChatRecipient = partnerId;
    document.getElementById('chatRecipientId').value = partnerId;

    // Hide product preview if switching to a conversation list item
    const previewEl = document.getElementById('chatProductPreview');
    if (previewEl) previewEl.style.display = 'none';
    
    // Update UI for Mobile/Desktop
    document.getElementById('waContainer').classList.add('chat-active');
    document.getElementById('waWelcome').style.display = 'none';
    document.getElementById('waChatView').style.display = 'flex';
    
    // Highlight sidebar item
    document.querySelectorAll('.wa-contact-item').forEach(el => el.classList.remove('active'));
    // (Re-rendering list would set active class, but visual update here is faster)
    
    // Set Header
    // Fetch Name
    const { data: profile } = await supabaseClient.from('profiles').select('full_name, business_name, avatar_url').eq('id', partnerId).single();
    const displayName = profile ? (profile.business_name || profile.full_name) : 'User';
    const avatarUrl = profile?.avatar_url;

    document.getElementById('currentChatName').innerText = displayName;
    document.getElementById('currentChatAvatar').innerHTML = avatarUrl ? 
        `<img src="${avatarUrl}" style="width:100%; height:100%; object-fit:cover;">` : 
        `<i class="fas fa-user"></i>`;
        
    document.getElementById('chatHeaderTitle').innerText = 'Chat'; 

    // Load Messages
    const historyContainer = document.getElementById('chatHistory');
    historyContainer.innerHTML = '<p style="text-align:center; padding:20px;">Loading...</p>';
    
    await loadChatHistory(partnerId);
};

window.toggleMobileChat = (showChat) => {
    const container = document.getElementById('waContainer');
    if(showChat) {
        container.classList.add('chat-active');
    } else {
        container.classList.remove('chat-active');
        currentChatRecipient = null;
    }
};

// === VIEW BUSINESS PROFILE LOGIC ===
window.viewBusinessProfile = async (sellerId) => {
    const modal = document.getElementById('businessProfileModal');
    if (!modal) return;

    const contentDiv = document.getElementById('bizProfileContent');
    // Loading State
    contentDiv.innerHTML = '<div style="padding:50px; text-align:center;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    modal.classList.add('active');

    // Fetch Profile & Products
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', sellerId).single();
    
    if (!profile) {
        contentDiv.innerHTML = '<p style="padding:20px; text-align:center;">Business profile not found.</p>';
        return;
    }

    const { data: products } = await supabaseClient.from('products').select('*').eq('seller_id', sellerId).limit(8);

    // Render Profile
    const avatar = profile.avatar_url || 'https://via.placeholder.com/100?text=Logo';
    
    let productsHTML = '<p style="color:#888; text-align:center; padding: 20px;">No products listed.</p>';
    if (products && products.length > 0) {
        productsHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px;">` + 
        products.map(p => `
            <div onclick="openProductDetails('${p.id}')" style="background:var(--bg-light); border-radius:8px; padding:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.05);">
                <div style="height:100px; background:#333; margin-bottom:8px; border-radius:4px; overflow:hidden;">
                    ${p.image_url ? `<img src="${p.image_url}" style="width:100%; height:100%; object-fit:cover;">` : ''}
                </div>
                <h4 style="font-size:13px; margin:0 0 5px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</h4>
                <p style="font-size:13px; color:#1e90ff; font-weight:bold;">K${p.price}</p>
            </div>
        `).join('') + `</div>`;
    }

    contentDiv.innerHTML = `
        <div style="height:100px; background: linear-gradient(to right, #1e90ff, #007bff); border-radius: 8px 8px 0 0;"></div>
        <div style="padding: 0 20px 20px; margin-top: -50px; text-align: center;">
            <img src="${avatar}" style="width:100px; height:100px; border-radius:50%; border:4px solid var(--bg-card); background:#333; object-fit:cover;">
            <h2 style="margin:10px 0 5px 0; font-size:24px;">${profile.business_name || profile.full_name}</h2>
            <p style="color:var(--primary-color); font-weight:600; font-size:14px; margin-bottom:10px;">${profile.business_type || 'Verified Seller'}</p>
            <p style="color:#aaa; font-size:14px; margin-bottom:20px;"><i class="fas fa-map-marker-alt"></i> ${profile.location || 'Location available on request'}</p>
            
            <div style="background:var(--bg-light); padding:15px; border-radius:8px; margin-bottom:25px; text-align:left;">
                <h4 style="margin-bottom:10px; color:#fff;">About Business</h4>
                <p style="font-size:14px; line-height:1.6; color:#ccc;">${profile.description || 'No business description provided.'}</p>
            </div>

            <h3 style="text-align:left; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">More from this Seller</h3>
            ${productsHTML}
        </div>
    `;
};

// === PRODUCT DETAILS & DELETE LOGIC ===

// 1. View Product Details (Public)
window.openProductDetails = async (productId) => {
    const modal = document.getElementById('productDetailsModal');
    if (!modal) return;

    // Reset/Loading state
    document.getElementById('detailName').innerText = 'Loading...';
    document.getElementById('detailImage').src = '';
    
    // Fetch Product
    const { data: product, error } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (error || !product) return showToast('Product not found', 'error');

    // Fetch Seller Profile for Contact Info
    const { data: seller } = await supabaseClient.from('profiles').select('*').eq('id', product.seller_id).single();

    // Populate Modal
    document.getElementById('detailImage').src = product.image_url || 'https://via.placeholder.com/300?text=No+Image';
    document.getElementById('detailName').innerText = product.name;
    document.getElementById('detailPrice').innerText = isNaN(parseFloat(product.price)) ? product.price : 'K' + product.price;
    document.getElementById('detailDesc').innerText = product.description || 'No description available.';
    document.getElementById('detailCategory').innerText = product.category;
    
    // Populate Seller Contact Info
    const sellerName = seller ? (seller.business_name || seller.full_name) : 'Unknown';
    if (seller) {
        document.getElementById('detailSellerName').innerHTML = `<a href="#" onclick="viewBusinessProfile('${seller.id}'); return false;" style="color: var(--primary-color); text-decoration: underline;">${sellerName}</a>`;
    } else {
        document.getElementById('detailSellerName').innerText = sellerName;
    }
    
    document.getElementById('detailSellerEmail').innerText = seller ? seller.email : 'N/A';
    document.getElementById('detailSellerLocation').innerText = seller ? (seller.location || 'N/A') : 'N/A';

    // Add Description to Modal if available
    const sellerDescEl = document.getElementById('detailSellerDesc');
    if (sellerDescEl && seller && seller.description) {
        sellerDescEl.innerText = seller.description;
        sellerDescEl.parentElement.style.display = 'block';
    } else if (sellerDescEl) {
        sellerDescEl.parentElement.style.display = 'none';
    }

    modal.classList.add('active');
};

// 2. Delete Product (Dashboard)
window.deleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;
    
    // 1. Delete associated messages first to satisfy foreign key constraint
    const { error: msgError } = await supabaseClient.from('messages').delete().eq('product_id', productId);
    
    if (msgError) {
        console.warn('Could not delete related messages (check RLS policies):', msgError.message);
    }

    // 2. Delete the product
    const { error } = await supabaseClient.from('products').delete().eq('id', productId);
    
    if (error) showToast('Error deleting product: ' + error.message, 'error');
    else {
        showToast('Product deleted successfully.', 'success');
        loadSellerProducts(); // Refresh the list
    }
};

// === BUY NOW LOGIC ===
window.buyNow = async (productId) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return showToast('Please login to purchase.', 'info');

    const { data: product } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!product) return showToast('Product error.', 'error');
    
    // Logic: If item needs contact, alert.
    if (isNaN(parseFloat(product.price))) return showToast('Contact seller for pricing.', 'info');

    // Add to cart
    cart.push(product);
    localStorage.setItem('sme_cart', JSON.stringify(cart));
    updateCartCount();
    
    // Calculate total for just payment modal display (simple sum of cart)
    const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        document.getElementById('payAmount').innerText = 'K' + total.toFixed(2);
        paymentModal.classList.add('active');
    }
};

// === WISHLIST LOGIC ===
let wishlist = JSON.parse(localStorage.getItem('sme_wishlist')) || [];

window.addToWishlist = async (productId) => {
    // Check if already in wishlist
    if (wishlist.find(item => item.id === productId)) {
        return showToast('Already in your wishlist.', 'info');
    }

    const { data: product } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!product) return showToast('Product not found.', 'error');

    wishlist.push(product);
    localStorage.setItem('sme_wishlist', JSON.stringify(wishlist));
    showToast(`${product.name} added to wishlist!`, 'success');
};

window.removeFromWishlist = (index) => {
    wishlist.splice(index, 1);
    localStorage.setItem('sme_wishlist', JSON.stringify(wishlist));
    loadCustomerWishlist(); // Refresh view
};

window.loadCustomerWishlist = () => {
    const container = document.getElementById('wishlist-container');
    if (!container) return;

    if (wishlist.length === 0) {
        container.innerHTML = '<p>Your wishlist is empty.</p>';
        return;
    }

    container.innerHTML = wishlist.map((product, index) => `
        <div class="product-mini" style="position: relative;">
            <button onclick="removeFromWishlist(${index})" style="position: absolute; top: 10px; right: 10px; background: rgba(220, 53, 69, 0.9); color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; z-index: 10;" title="Remove">
                <i class="fas fa-times"></i>
            </button>
            <div style="height: 120px; background: #333; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; overflow:hidden;">
                ${product.image_url ? `<img src="${product.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">` : '<i class="fas fa-image fa-2x"></i>'}
            </div>
            <h4>${product.name}</h4>
            <p class="price">${isNaN(parseFloat(product.price)) ? product.price : 'K' + product.price}</p>
            <button class="btn-primary" style="width: 100%; margin-top: 10px; font-size: 12px;" onclick="addToCart('${product.id}')">Add to Cart</button>
        </div>
    `).join('');
};

// === SHOPPING CART LOGIC ===
let cart = JSON.parse(localStorage.getItem('sme_cart')) || [];

function updateCartCount() {
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(b => {
        b.innerText = cart.length;
        b.style.display = cart.length > 0 ? 'inline-block' : 'none';
    });
}

window.addToCart = async (productId) => {
    const { data: product } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    
    if (!product) return showToast('Product error.', 'error');
    if (isNaN(parseFloat(product.price))) return showToast('Contact seller for pricing.', 'info');

    cart.push(product);
    localStorage.setItem('sme_cart', JSON.stringify(cart));
    updateCartCount();
    showToast(`${product.name} added to cart!`, 'success');
};

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    localStorage.setItem('sme_cart', JSON.stringify(cart));
    updateCartCount();
    renderCart();
};

window.toggleCart = () => {
    const modal = document.getElementById('cartModal');
    if (modal) {
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
        } else {
            renderCart();
            modal.classList.add('active');
        }
    }
};

window.renderCart = () => {
    const container = document.getElementById('cartItemsContainer');
    const totalEl = document.getElementById('cartTotal');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#888;">Your cart is empty.</p>';
        totalEl.innerText = 'K0.00';
        return;
    }

    let total = 0;
    container.innerHTML = cart.map((item, index) => {
        const price = parseFloat(item.price);
        total += price;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #333;">
                <div>
                    <h4 style="margin: 0; font-size: 14px; color: var(--text-color);">${item.name}</h4>
                    <p style="margin: 0; font-size: 12px; color: #1e90ff;">K${item.price}</p>
                </div>
                <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #dc3545; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
    
    totalEl.innerText = 'K' + total.toFixed(2);
};

window.checkout = async () => {
    if (cart.length === 0) return showToast('Cart is empty.', 'info');
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return showToast('Please login to checkout.', 'info');
    
    // Open Payment Modal instead of direct confirm
    window.toggleCart(); // Close cart modal
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
        document.getElementById('payAmount').innerText = document.getElementById('cartTotal').innerText;
        paymentModal.classList.add('active');
    }
};

// === HANDLE PAYMENT SUBMISSION ===
window.handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    const network = document.getElementById('payNetwork').value;
    const phone = document.getElementById('payPhone').value;
    const btn = e.target.querySelector('button');

    if (!phone) return showToast('Please enter a valid phone number', 'error');

    // Simulate Payment Processing
    btn.innerText = 'Processing Payment...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    // Simulate API delay (2 seconds)
    await new Promise(r => setTimeout(r, 2000));

    // Proceed to create orders after "Payment Success"
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const orders = cart.map(item => ({
        buyer_id: user.id,
        seller_id: item.seller_id,
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        status: 'Paid' // Mark as Paid
    }));

    const { error } = await supabaseClient.from('orders').insert(orders);

    if (error) {
        showToast('Payment successful but order creation failed.', 'error');
    } else {
        showToast(`Payment Successful via ${network}!`, 'success');
        cart = [];
        localStorage.setItem('sme_cart', JSON.stringify(cart));
        updateCartCount();
        
        // Close Modal
        document.getElementById('paymentModal').classList.remove('active');
        
        // If on customer dashboard, reload orders
        if (window.location.pathname.includes('dashboard-customer')) {
            loadCustomerOrders();
            loadCustomerStats(); // Refresh stats
        }
    }
    
    btn.innerText = 'Pay Now';
    btn.disabled = false;
    btn.style.opacity = '1';
};

// 3. Toggle Product Status (Sold Out / Available)
window.toggleProductStatus = async (productId, currentStatus) => {
    const newStatus = currentStatus === 'sold_out' ? 'available' : 'sold_out';
    const { error } = await supabaseClient.from('products').update({ status: newStatus }).eq('id', productId);
    
    if (error) showToast('Error updating status: ' + error.message, 'error');
    else {
        loadSellerProducts(); // Refresh seller dashboard
    }
};

// === MESSAGING & CHAT LOGIC ===

window.deleteMessage = async (id) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    const { error } = await supabaseClient.from('messages').delete().eq('id', id);

    if (error) showToast('Error deleting message: ' + error.message, 'error');
    else {
        loadMessages();
        checkUnreadMessages();
    }
};

async function loadMessages() {
    const container = document.getElementById('messages-container');
    if(!container) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if(!user) return;

    // Fetch messages where I am the sender OR receiver
    const { data: messages, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

    if(error) {
        container.innerHTML = '<p>Error loading messages.</p>';
        return;
    }

    if(!messages || messages.length === 0) {
        container.innerHTML = '<p>No messages yet.</p>';
        return;
    }

    // Group messages by conversation partner
    const conversations = {};
    messages.forEach(msg => {
        const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        // Only keep the latest message for the preview
        if (!conversations[partnerId]) {
            conversations[partnerId] = {
                partnerId: partnerId,
                lastMessage: msg.content,
                time: msg.created_at,
                product: msg.product_name,
                unreadCount: 0
            };
        }
        if (msg.receiver_id === user.id && !msg.is_read) {
            conversations[partnerId].unreadCount++;
        }
    });

    // 1. Fetch User Names
    const partnerIds = Object.keys(conversations);
    const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name, business_name').in('id', partnerIds);
    
    const nameMap = {};
    if (profiles) {
        profiles.forEach(p => nameMap[p.id] = p.business_name || p.full_name);
    }

    container.innerHTML = Object.values(conversations).map(c => {
        return `
            <div onclick="openChatModal('${c.partnerId}', null, '${c.product || 'General'}')" style="background: #333; padding: 15px; border-radius: 8px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#3a3a3a'" onmouseout="this.style.background='#333'">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <strong style="color: #fff;">${nameMap[c.partnerId] || 'User'}</strong>
                        ${c.unreadCount > 0 ? `<span style="background:#dc3545; color:white; font-size:10px; padding:2px 6px; border-radius:10px;">${c.unreadCount} new</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 12px; color: #888;">${new Date(c.time).toLocaleDateString()}</span>
                    </div>
                </div>
                <p style="color: #ccc; margin-bottom: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px;">
                    ${c.lastMessage}
                </p>
            </div>
        `;
    }).join('');
}

async function checkUnreadMessages() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if(!user) return;

    // Count messages received
    const { count, error } = await supabaseClient
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id);
    
    if (!error && count > 0) {
        const badges = document.querySelectorAll('.msg-badge');
        badges.forEach(badge => {
            badge.innerText = count;
            badge.style.display = 'inline-block';
        });
    } else {
        document.querySelectorAll('.msg-badge').forEach(b => b.style.display = 'none');
    }
}

// === ADMIN BUSINESS LOGIC ===
async function loadAdminBusinessDetails() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if(!user) return;
    
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
    if(profile) {
        if(document.getElementById('adminBizName')) document.getElementById('adminBizName').value = profile.business_name || '';
        if(document.getElementById('adminBizType')) document.getElementById('adminBizType').value = profile.business_type || '';
        if(document.getElementById('adminLocation')) document.getElementById('adminLocation').value = profile.location || '';
        if(document.getElementById('adminDesc')) document.getElementById('adminDesc').value = profile.description || '';
    }
}

const adminBusinessForm = document.getElementById('adminBusinessForm');
if (adminBusinessForm) {
    adminBusinessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const businessName = document.getElementById('adminBizName').value;
        const businessType = document.getElementById('adminBizType').value;
        const location = document.getElementById('adminLocation').value;

        const avatarFile = document.getElementById('adminAvatar').files[0];
        const description = document.getElementById('adminDesc').value;

        const { data: { user } } = await supabaseClient.auth.getUser();

        // Upload Avatar if changed
        let avatarUrl = undefined;
        if (avatarFile) {
             const fileExt = avatarFile.name.split('.').pop();
             const fileName = `${user.id}/avatar_${Date.now()}.${fileExt}`;
             const { error: avError } = await supabaseClient.storage.from('avatars').upload(fileName, avatarFile);
             if (!avError) {
                 const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                 avatarUrl = urlData.publicUrl;
             }
        }
        
        // Admin is implicitly verified
        const updates = {
            business_name: businessName,
            business_type: businessType,
            location: location,
            verified: true 
        };
        
        if (avatarUrl) updates.avatar_url = avatarUrl;
        if (description !== undefined) updates.description = description;

        const { error } = await supabaseClient.from('profiles').update(updates).eq('id', user.id);

        if (error) showToast('Error updating details: ' + error.message, 'error');
        else showToast('Business details updated successfully!', 'success');
    });
}

// === DISPLAY PRODUCTS LOGIC ===

// 1. Load Seller's Own Products (Dashboard)
async function loadSellerProducts() {
    const container = document.getElementById('sellerProductList');
    if (!container) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { data: products, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p>Error loading products: ${error.message}</p>`;
        return;
    }

    if (products.length === 0) {
        container.innerHTML = '<p>No products listed yet.</p>';
        return;
    }

    container.innerHTML = products.map(product => {
        const isSoldOut = product.status === 'sold_out';
        return `
        <div class="product-mini" style="position: relative; opacity: ${isSoldOut ? '0.7' : '1'};">
            <div style="position: absolute; top: 10px; right: 10px; z-index: 10; display:flex; gap:5px;">
                <button onclick="toggleProductStatus('${product.id}', '${product.status || 'available'}')" style="background: ${isSoldOut ? '#28a745' : '#ffc107'}; color: #000; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size:11px; font-weight:bold;">
                    ${isSoldOut ? 'Mark In Stock' : 'Mark Sold Out'}
                </button>
                <button onclick="deleteProduct('${product.id}')" style="background: rgba(220, 53, 69, 0.9); color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;" title="Delete Product">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div style="height: 120px; background: #333; border-radius: 8px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #555; overflow:hidden;">
                ${product.image_url ? `<img src="${product.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">` : '<i class="fas fa-image fa-2x"></i>'}
            </div>
            <h4>${product.name}</h4>
            <p class="price">${isNaN(parseFloat(product.price)) ? product.price : 'K' + product.price}</p>
            <p style="font-size: 12px; color: #888;">${product.category}</p>
            ${isSoldOut ? '<p style="color:#ff4757; font-weight:bold; font-size:12px; margin-top:5px;">SOLD OUT</p>' : ''}
        </div>
    `}).join('');
}

// 3. Load Seller Dashboard Stats (Overview)
async function loadSellerDashboardStats() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // 1. Stats (Simulated for now as we don't have Orders/Revenue tables)
    // Update UI with defaults or derived data
    if(document.getElementById('seller-revenue')) document.getElementById('seller-revenue').innerText = 'K0.00';
    if(document.getElementById('seller-orders-count')) document.getElementById('seller-orders-count').innerText = '0'; 
    if(document.getElementById('seller-rating')) document.getElementById('seller-rating').innerText = '5.0';

    // 2. Recent Products (Replacing Low Stock)
    const recentTable = document.getElementById('recent-products-table');
    if (recentTable) {
        const { data: products } = await supabaseClient
            .from('products')
            .select('*')
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!products || products.length === 0) {
            recentTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">No products listed.</td></tr>';
        } else {
            recentTable.innerHTML = products.map(p => `
                <tr>
                    <td>${p.name}</td>
                    <td>${isNaN(parseFloat(p.price)) ? p.price : 'K' + p.price}</td>
                    <td>${p.category}</td>
                    <td><button onclick="deleteProduct('${p.id}')" class="btn-primary" style="padding: 2px 8px; font-size: 11px; background: #dc3545;">Delete</button></td>
                </tr>
            `).join('');
        }
    }
}

// 2. Load All Products (Public Marketplace)
async function loadPublicProducts() {
    const container = document.getElementById('marketplace-grid');
    if (!container) return;

    // Join with profiles to get Business Name
    const { data: products, error } = await supabaseClient
        .from('products')
        .select('*, profiles(business_name, business_type, avatar_url)')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p>Error loading products: ${error.message}</p>`;
        return;
    }

    if (products.length === 0) {
        container.innerHTML = '<p>No products found.</p>';
        return;
    }

    container.innerHTML = products.map(product => {
        const isSoldOut = product.status === 'sold_out';
        const businessName = (product.profiles && product.profiles.business_name) ? product.profiles.business_name : 'Verified Seller';
        const sellerAvatar = (product.profiles && product.profiles.avatar_url) ? product.profiles.avatar_url : null;
        const isPriceNumeric = !isNaN(parseFloat(product.price));
        
        return `
        <article class="product-market-card" style="${isSoldOut ? 'opacity: 0.7;' : ''}">
            <div class="pmc-image-container">
                <img src="${product.image_url || 'https://via.placeholder.com/300x200?text=No+Image'}" class="pmc-image" alt="${product.name}">
                <button onclick="addToWishlist('${product.id}')" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;">
                    <i class="fas fa-heart"></i>
                </button>
                ${isSoldOut ? '<div style="position:absolute; bottom:0; left:0; right:0; background:rgba(220, 53, 69, 0.9); color:white; text-align:center; padding:5px; font-weight:bold; font-size:12px;">SOLD OUT</div>' : ''}
            </div>
            
            <div class="pmc-content">
                <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px;">${product.category}</div>
                <h3 style="font-size: 16px; margin: 0 0 4px 0; color: var(--text-color); font-weight: 600; line-height: 1.4; height: 44px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${product.name}
                </h3>
                <div style="font-size: 12px; color: #aaa; margin-bottom: 8px; display:flex; align-items:center; gap:5px;">
                    ${sellerAvatar ? `<img src="${sellerAvatar}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">` : '<i class="fas fa-store" style="font-size:10px;"></i>'}
                    <span>Sold by <button onclick="viewBusinessProfile('${product.seller_id}')" style="background:none; border:none; color: #1e90ff; cursor:pointer; padding:0; font-size:inherit; font-weight:inherit; text-decoration:underline;">${businessName}</button></span>
                </div>
                
                <div style="display: flex; align-items: baseline; gap: 5px; margin-bottom: 10px;">
                    <span style="font-size: 12px; color: #fff;">K</span>
                    <span style="font-size: 20px; font-weight: 700; color: #fff;">${isPriceNumeric ? parseFloat(product.price).toFixed(2) : 'Contact'}</span>
                </div>

                <div class="pmc-actions">
                    ${!isSoldOut && isPriceNumeric ? `
                        <button onclick="addToCart('${product.id}')" style="background: #f0c14b; color: #111; border: 1px solid #a88734; border-radius: 20px; font-weight: 600; cursor: pointer; padding: 6px 0; font-size: 13px;">Add to Cart</button>
                        <button onclick="buyNow('${product.id}')" style="background: #fa8900; color: #111; border: 1px solid #ca6f01; border-radius: 20px; font-weight: 600; cursor: pointer; padding: 6px 0; font-size: 13px;">Buy Now</button>
                    ` : `
                        <button onclick="openChatModal('${product.seller_id}', '${product.id}', '${product.name}')" style="grid-column: span 2; background: #333; color: #fff; border: 1px solid #555; border-radius: 6px; padding: 8px 0; cursor: pointer; font-size: 13px;">
                            <i class="fas fa-envelope"></i> Contact Seller
                        </button>
                    `}
                    <button onclick="openProductDetails('${product.id}')" style="grid-column: span 2; background: transparent; color: #888; border: none; cursor: pointer; font-size: 12px; margin-top: 5px; text-decoration: underline;">View Full Details</button>
                </div>
            </div>
        </article>
    `}).join('');
}

// Initialize Public Page
if (window.location.pathname.includes('sellers.html')) {
    // Wait for load to ensure elements exist
    window.addEventListener('DOMContentLoaded', async () => {
        await loadPublicProducts();

        // Check for search query param from Home Page
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');
        const searchInput = document.querySelector('.search-input');

        if (searchQuery && searchInput) {
            searchInput.value = searchQuery;
            // Trigger filter
            const event = new Event('input');
            searchInput.dispatchEvent(event);
        }
    });

    // Simple Filter Logic (Client-side for now)
    const searchInput = document.querySelector('.search-input');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.seller-card');
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

// === SELLER DASHBOARD NAVIGATION ===
const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
const contentSections = document.querySelectorAll('.dashboard-content-section');

// Initialize Dashboard Search Listeners (Run once)
function setupDashboardSearch(inputId, sectionId) {
    const searchInput = document.getElementById(inputId);
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const cards = document.querySelectorAll(`#${sectionId} .product-market-card, #${sectionId} .seller-card`);
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

// Setup searches for both dashboards
setupDashboardSearch('dash-search-input', 'marketplace-grid'); // Seller Dash
setupDashboardSearch('cust-search-input', 'marketplace-grid'); // Customer Dash

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // Remove active class from all links
        sidebarLinks.forEach(l => l.classList.remove('active'));
        // Add active class to clicked link
        link.classList.add('active');

        const targetId = link.getAttribute('data-target');

        // Hide all content sections
        contentSections.forEach(section => {
            section.style.display = 'none';
        });

        // Show the target section
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.style.display = 'block';
            if(targetId === 'messages-section') loadMessages();
            if(targetId === 'users-section') loadAllUsers();
            
            if(targetId === 'marketplace-section') {
                loadPublicProducts();
            }
        }
    });
});

// === MOBILE SIDEBAR TOGGLE ===
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
if (mobileMenuBtn) {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    // Close when clicking overlay
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
    
    // Close sidebar when clicking a link (on mobile)
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            }
        });
    });
}

// === CUSTOMER DASHBOARD ACTIONS (Orders & Settings) ===
document.addEventListener('click', async (e) => {
    // Handle Order Cancellation
    if (e.target.classList.contains('btn-cancel-order')) {
        const confirmCancel = confirm("Are you sure you want to cancel this order? This action cannot be undone.");
        if (confirmCancel) {
            const row = e.target.closest('tr');
            const statusSpan = row.querySelector('.status');
            
            // Update UI to show cancelled status
            statusSpan.className = 'status cancelled';
            statusSpan.innerText = 'Cancelled';
            e.target.remove(); // Remove the cancel button
            showToast('Order cancelled successfully.', 'success');
        }
    }
});

// Handle Profile Settings Update
const profileSettingsForm = document.getElementById('profileSettingsForm');
if (profileSettingsForm) {
    profileSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('updateName').value;
        const newPass = document.getElementById('updatePass').value;
        
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return showToast("You are not logged in.", 'error');

            // 1. Update Password if provided
            if (newPass) {
                const { error } = await supabaseClient.auth.updateUser({ password: newPass });
                if (error) throw error;
            }

            // 2. Update Name in Auth and Profiles table
            const { error: metaError } = await supabaseClient.auth.updateUser({
                data: { full_name: newName }
            });
            if (metaError) throw metaError;

            await supabaseClient.from('profiles').update({ full_name: newName }).eq('id', user.id);

            showToast('Profile updated successfully!', 'success');
            document.getElementById('updatePass').value = ''; // Clear password field
        } catch (error) {
            showToast('Error updating profile: ' + error.message, 'error');
        }
    });
}

async function handleAuthUI() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const navUl = document.querySelector('header nav ul');
    if (!navUl) return;

    const signupLi = navUl.querySelector('a[href="signup.html"], button[onclick*="signup.html"]')?.parentElement;
    const loginLi = navUl.querySelector('a[href="login.html"], button[onclick*="login.html"]')?.parentElement;

    // Remove any previously added dynamic links to prevent duplication
    navUl.querySelector('#dashboard-link')?.remove();
    navUl.querySelector('#logout-link')?.remove();

    if (session) {
        if (signupLi) signupLi.style.display = 'none';
        if (loginLi) loginLi.style.display = 'none';

        const role = session.user.user_metadata.role || 'customer';
        let dashboardUrl = 'dashboard-customer.html';
        if (role === 'seller') dashboardUrl = 'dashboard-seller.html';
        if (role === 'admin') dashboardUrl = 'dashboard-admin.html';

        const dashboardLi = document.createElement('li');
        dashboardLi.id = 'dashboard-link';
        dashboardLi.innerHTML = `<a href="${dashboardUrl}" class="btn-primary">Dashboard</a>`;
        navUl.appendChild(dashboardLi);

        const logoutLi = document.createElement('li');
        logoutLi.id = 'logout-link';
        logoutLi.innerHTML = `<button class="btn-primary" style="background-color: var(--accent-color);">Logout</button>`;
        logoutLi.querySelector('button').addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'index.html';
        });
        navUl.appendChild(logoutLi);
    } else {
        if (signupLi) signupLi.style.display = '';
        if (loginLi) loginLi.style.display = '';
    }
}

// Function to load customer profile data into the settings form
async function loadCustomerProfile() {
    const nameInput = document.getElementById('updateName');
    const emailInput = document.getElementById('updateEmail');
    if (!nameInput || !emailInput) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        emailInput.value = user.email;
        
        // Try to get name from profiles table first, then metadata
        const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', user.id).single();
        if (profile && profile.full_name) {
            nameInput.value = profile.full_name;
        } else if (user.user_metadata.full_name) {
            nameInput.value = user.user_metadata.full_name;
        }
    }
}

// Function to ensure the current user has a profile record (fixes missing data for early users)
async function syncUserProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Check if profile exists
    const { data, error } = await supabaseClient.from('profiles').select('id').eq('id', user.id).maybeSingle();
    
    if (!data) {
        console.log("Syncing missing profile...");
        // Prepare profile data
        const metadata = user.user_metadata || {};
        const profileData = {
            id: user.id,
            email: user.email,
            full_name: metadata.full_name || 'User',
            role: metadata.role || 'customer',
            business_name: metadata.business_name || null,
            business_type: metadata.business_type || null,
            verified: metadata.role === 'seller' ? false : true
        };
        
        await supabaseClient.from('profiles').insert([profileData]);
    }
}

// Load User Name for Dashboard Header
async function loadUserNameDisplay() {
    const nameSpan = document.getElementById('user-name-display');
    if (!nameSpan) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    
    let displayName = "User";

    // 1. Try Metadata first (fastest)
    if (user.user_metadata && user.user_metadata.full_name) {
        displayName = user.user_metadata.full_name;
    } else if (user.email) {
        displayName = user.email.split('@')[0];
    }

    // 2. Try Profile (most accurate if updated)
    const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', user.id).single();
    if (profile && profile.full_name) {
        displayName = profile.full_name;
    }

    nameSpan.innerText = displayName;
}

// Calculate and Display Customer Stats
async function loadCustomerStats() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: orders } = await supabaseClient.from('orders').select('*').eq('buyer_id', user.id);
    
    if (orders) {
        const activeCount = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
        const completedCount = orders.filter(o => o.status === 'Delivered').length;
        
        // Calculate Total Spent (extract numbers from price strings)
        const totalSpent = orders
            .filter(o => o.status !== 'Cancelled')
            .reduce((sum, order) => {
                const priceVal = parseFloat(String(order.price).replace(/[^0-9.]/g, ''));
                return sum + (isNaN(priceVal) ? 0 : priceVal);
            }, 0);

        if(document.getElementById('cust-active-orders')) document.getElementById('cust-active-orders').innerText = activeCount;
        if(document.getElementById('cust-completed-orders')) document.getElementById('cust-completed-orders').innerText = completedCount;
        if(document.getElementById('cust-total-spent')) document.getElementById('cust-total-spent').innerText = 'K' + totalSpent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
}

// Load Recommendations for Customer Overview
async function loadCustomerRecommendations() {
    const container = document.getElementById('recommendations-container');
    if (!container) return;

    // Fetch latest 4 products
    const { data: products } = await supabaseClient.from('products').select('*').order('created_at', { ascending: false }).limit(4);
    
    if (!products || products.length === 0) {
        container.innerHTML = '<p>No recommendations yet.</p>';
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="product-mini" onclick="openProductDetails('${product.id}')" style="cursor:pointer;">
            <div style="height: 100px; background: #333; border-radius: 8px; margin-bottom: 10px; overflow:hidden;">
                ${product.image_url ? `<img src="${product.image_url}" style="width:100%; height:100%; object-fit:cover;">` : ''}
            </div>
            <h4>${product.name}</h4>
            <p class="price">${isNaN(parseFloat(product.price)) ? product.price : 'K' + product.price}</p>
        </div>
    `).join('');
}

async function checkDashboardSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
		console.log('No session found, redirecting to login');
        window.location.href = 'login.html';
    } else {
        // Ensure profile exists for the current user
        await syncUserProfile();
        loadUserNameDisplay(); // Load the dynamic name

        const role = session.user.user_metadata.role || 'customer';
        const currentPath = window.location.pathname;
        
        // === MESSAGES PAGE LOGIC ===
        if (currentPath.includes('messages.html')) {
            loadConversations();
            return; // Stop further dashboard logic
        }
        
        if (role === 'seller') {
            // CHECK VERIFICATION STATUS
            const { data: profile } = await supabaseClient.from('profiles').select('verified').eq('id', session.user.id).single();
            
            if (profile && !profile.verified) {
                // Overwrite main content with Pending Message
                const mainContent = document.querySelector('.main-content');
                mainContent.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:80vh; text-align:center;">
                        <i class="fas fa-hourglass-half" style="font-size: 60px; color: #ffc107; margin-bottom: 20px;"></i>
                        <h2 style="color: var(--text-color);">Account Under Review</h2>
                        <p style="color: var(--text-muted); max-width: 500px; margin: 10px 0 20px;">Thank you for registering. Your business documents are currently being processed by our admin team. You will receive full access once your business is verified.</p>
                        <button class="btn-primary" onclick="window.location.reload()">Check Status</button>
                        <button class="btn-icon" onclick="supabaseClient.auth.signOut().then(() => window.location.href='index.html')" style="margin-top:20px; font-size:14px; color:#ff4757;">Logout</button>
                    </div>
                `;
            } else {
                loadSellerProducts();
                loadSellerDashboardStats();
                loadSellerPurchases(); 
                loadSellerOrders(); // Load orders for seller to manage
            }
        }
        
        if (currentPath.includes('dashboard-customer')) {
            loadCustomerProfile();
            loadCustomerStats(); // Load stats
            loadCustomerRecommendations(); // Load overview recommendations
        }
        
        // Check for messages on any dashboard load
        checkUnreadMessages();

        // Redirect logic to ensure users stay on their correct dashboard
        if (currentPath.includes('seller') && role !== 'seller') {
            window.location.href = 'dashboard-customer.html';
			console.log('incorrect role for dashboard, redirecting');
        }

        // Protect Admin Dashboard
        if (currentPath.includes('admin') && role !== 'admin') {
            window.location.href = 'dashboard-customer.html';
            console.log('Access denied: Admins only');
        } else if (currentPath.includes('admin') && role === 'admin') {
            // Load Admin Data
            loadAdminData();
            loadSellerProducts(); // Load admin's own products
            loadAdminBusinessDetails(); // Load admin's business profile
            // Load messages if currently on message tab, or user switches to it
            if(currentPath.includes('admin') && document.getElementById('messages-section')?.style.display === 'block') loadMessages();
        }
    }
}

// Load real orders for customer dashboard
async function loadCustomerOrders() {
    const container = document.querySelector('#orders-section tbody');
    if (!container) return;
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: orders, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
        
    if (!orders || orders.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888; padding: 20px;">No orders placed yet.</td></tr>';
        return;
    }

    // Define status steps for tracking logic
    const statusMap = { 'Paid': 1, 'Processing': 2, 'Shipped': 3, 'Delivered': 4 };

    container.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id.slice(0,8)}</td>
            <td>${order.product_name}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td><span class="status ${order.status === 'Delivered' ? 'completed' : (order.status === 'Cancelled' ? 'cancelled' : 'pending')}">${order.status}</span></td>
            <td>K${order.price}</td>
            <td><button onclick="trackOrder('${order.id}', '${order.status}')" class="btn-primary" style="padding: 5px 10px; font-size: 12px; background: var(--primary-color);">Track</button></td>
        </tr>
    `).join('');
}

async function initializeHomePage() {
    // Handle Hero Search functionality
    const heroSearchBtn = document.getElementById('heroSearchBtn');
    const heroSearchInput = document.getElementById('heroSearchInput');
    
    if (heroSearchBtn && heroSearchInput) {
        const performSearch = () => {
            const term = heroSearchInput.value.trim();
            if (term) window.location.href = `sellers.html?search=${encodeURIComponent(term)}`;
        };

        heroSearchBtn.addEventListener('click', performSearch);
        heroSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => { // Make async to await auth check
    await handleAuthUI(); // Ensure nav is updated before other scripts run

    if (window.location.pathname.includes('dashboard')) {
        checkDashboardSession();
    }
    
    // Init messages page
    if (window.location.pathname.includes('messages.html')) {
        checkDashboardSession();
    }
    
    // Load customer orders if on dashboard
    if (window.location.pathname.includes('dashboard-customer')) {
        loadCustomerOrders();
    }

    const path = window.location.pathname;
    if (path.endsWith('/') || path.endsWith('index.html')) {
        initializeHomePage();
    }

    // Initialize Cart UI
    updateCartCount();
    
    // Inject Cart Modal to DOM
    if (!document.getElementById('cartModal')) {
        const modalHTML = `
        <div id="cartModal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="toggleCart()">&times;</span>
                <h2>Your Shopping Cart</h2>
                <div id="cartItemsContainer" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #444; padding-top: 15px; margin-bottom: 15px;">
                    <h3>Total:</h3>
                    <h3 id="cartTotal" style="color: #1e90ff;">K0.00</h3>
                </div>
                <button class="btn-primary" style="width: 100%;" onclick="checkout()">Checkout</button>
            </div>
        </div>`;
        
        // Payment Modal HTML
        const paymentModalHTML = `
        <div id="paymentModal" class="modal">
            <div class="modal-content" style="max-width: 400px;">
                <span class="close-modal" onclick="document.getElementById('paymentModal').classList.remove('active')">&times;</span>
                <h2 style="color: #1e90ff;"><i class="fas fa-mobile-alt"></i> Mobile Money</h2>
                <p style="margin-bottom: 20px;">Complete payment to finalize your order.</p>
                
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 1px solid #333;">
                    <p style="color: #aaa; font-size: 12px; margin-bottom: 5px;">Total Amount</p>
                    <h2 id="payAmount" style="color: #fff; margin: 0;">K0.00</h2>
                </div>

                <form id="paymentForm" onsubmit="handlePaymentSubmit(event)">
                    <div class="input-group">
                        <label>Select Network</label>
                        <select id="payNetwork" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; outline:none;">
                            <option value="Airtel">Airtel Money</option>
                            <option value="MTN">MTN Mobile Money</option>
                            <option value="Zamtel">Zamtel Kwacha</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Mobile Number</label>
                        <input type="tel" id="payPhone" placeholder="09xxxxxxxxx" required pattern="[0-9]{10}" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #444; background: #222; color: #fff; outline:none;">
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%;">Pay Now</button>
                </form>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.insertAdjacentHTML('beforeend', paymentModalHTML);

        // Business Profile Modal
        const bizModalHTML = `
        <div id="businessProfileModal" class="modal">
            <div class="modal-content" style="max-width: 600px; padding:0; overflow:hidden;">
                <span class="close-modal" onclick="document.getElementById('businessProfileModal').classList.remove('active')" style="position:absolute; right:15px; top:15px; z-index:10; color:white; text-shadow:0 0 5px rgba(0,0,0,0.5);">&times;</span>
                <div id="bizProfileContent" style="max-height:80vh; overflow-y:auto;"></div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', bizModalHTML);
    }

    // === MOBILE NAVBAR TOGGLE (PUBLIC PAGES) ===
    const header = document.querySelector('header');
    const nav = document.querySelector('nav');
    // Ensure we are on a public page (has header/nav) but NOT on a dashboard (which has .sidebar)
    const isDashboard = document.querySelector('.sidebar');

    if (header && nav && !isDashboard) {
        // If button exists (added via HTML), hook listener. If not, create it.
        let toggleBtn = document.querySelector('.mobile-nav-toggle');
        if (!document.querySelector('.mobile-nav-toggle')) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = 'mobile-nav-toggle';
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
            toggleBtn.setAttribute('aria-label', 'Toggle Navigation');
            // Insert button into header before the nav
            header.insertBefore(toggleBtn, nav);
        }

        toggleBtn.addEventListener('click', () => {
            nav.classList.toggle('active');
            const icon = toggleBtn.querySelector('i');
            if (nav.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
});