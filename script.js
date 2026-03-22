// === SUPABASE CONFIGURATION ===
const supabaseUrl = 'https://zezbbeeasafarvsyphvu.supabase.co'; // <--- REPLACE THIS
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplemJiZWVhc2FmYXJ2c3lwaHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMDg3NjIsImV4cCI6MjA4OTY4NDc2Mn0.KoE7mo4n0xyDqZikZFGmuELjqb1MRNgAJACaGZLcbE4'; // <--- REPLACE THIS with the key starting with eyJ...
if (supabaseKey === 'YOUR_SUPABASE_ANON_KEY') {
    console.error('CRITICAL: You must replace "YOUR_SUPABASE_ANON_KEY" in script.js with your actual Supabase Anon Key.');
}
const supabaseClient = typeof window.supabase !== 'undefined' ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

// === THEME TOGGLE FUNCTIONALITY ===
const themeToggleBtn = document.getElementById('theme-toggle');
const body = document.body;
const icon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

// Global Chat Variables
let currentChatRecipient = null;
const chatNotificationSound = new Audio('https://cdn.freesound.org/previews/536/536108_1415754-lq.mp3'); // Simple beep sound

// Request Notification Permission on load
if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
}

// Initialize Realtime Subscription
if (supabaseClient) {
    supabaseClient
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
            handleRealtimeMessage(payload);
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
        if (!user) return alert('You must be logged in.');

        // Image Upload Logic
        const imageFile = document.getElementById('prodImage').files[0];
        let imageUrl = null;

        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabaseClient.storage
                .from('product-images')
                .upload(fileName, imageFile);
            
            if (uploadError) return alert('Image upload failed: ' + uploadError.message);
            
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

        if (error) alert('Error adding product: ' + error.message);
        else {
            alert('Product added successfully!');
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
        
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const userRole = document.getElementById('role').value;

        if (!supabaseClient) {
            alert("Supabase is not initialized. Check your API URL and Key in script.js");
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
        }

        // SECRET: Auto-assign 'admin' role if the email starts with "admin" or is the owner
        if (email.toLowerCase().startsWith('admin') || email.toLowerCase() === 'nondee115@gmail.com') {
            metadata.role = 'admin';
        }

        // Prepare profile data (for public table)
        const profileData = {
            email: email,
            full_name: fullName,
            role: metadata.role,
            business_name: metadata.business_name || null,
            business_type: metadata.business_type || null,
            verified: metadata.role === 'seller' ? false : true // Sellers need verification
        };

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: metadata
                }
            });

            if (error) throw error;

            // Create Public Profile Record
            if (data.user) {
                await supabaseClient.from('profiles').insert([
                    { id: data.user.id, ...profileData }
                ]);
            }

            alert('Registration successful! Please check your email to verify your account, then login.');
            window.location.href = 'login.html';

        } catch (error) {
            console.error(error); // See the exact error in the browser console (F12)
            alert('Error registering: ' + error.message);
        }
    });
}

// === HIDDEN ADMIN LOGIN BUTTON ===
const adminTrigger = document.getElementById('admin-trigger');
if (adminTrigger) {
    adminTrigger.addEventListener('click', (e) => {
        e.preventDefault(); 
        // If on login page, autofill. If elsewhere, redirect then autofill.
        if (window.location.pathname.includes('login.html')) {
            const emailField = document.getElementById('email');
            if (emailField) emailField.value = 'nondee115@gmail.com';
        } else {
            window.location.href = 'login.html?admin_fill=true';
        }
    });
}

// 2. Handle Login
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    if (new URLSearchParams(window.location.search).get('admin_fill') === 'true') {
        document.getElementById('email').value = 'nondee115@gmail.com';
    }
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!supabaseClient) {
            alert("Supabase is not initialized. Check your API URL and Key in script.js");
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
            
            // Auto-promote owner to admin if not already
            if (email.toLowerCase() === 'nondee115@gmail.com' && role !== 'admin') {
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
            alert('Login failed: ' + error.message);
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
            alert(errorMessage);
        } else {
            // Allow submission (for demo purposes we alert success)
            alert("Message sent successfully!");
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
        if (error) alert('Error verifying seller: ' + error.message);
        else {
            alert('Seller approved successfully.');
            loadAdminData(); // Refresh UI
        }
    } else {
        if(confirm('Are you sure you want to reject this seller?')) {
            // Logic to delete or mark rejected could go here
            alert('Seller rejected (Action simulation).');
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
    
    const contextTitle = productName ? ` (${productName})` : '';
    document.getElementById('chatHeaderTitle').innerText = `${displayName}${contextTitle}`;

    if (productId) document.getElementById('chatProductId').value = productId;

    // Clear previous chat
    const historyContainer = document.getElementById('chatHistory');
    historyContainer.innerHTML = '<p style="text-align:center; color:#888; font-size:12px;">Loading history...</p>';
    
    modal.classList.add('active');
    await loadChatHistory(partnerId);
};

// Alias for compatibility
window.openContactModal = window.openChatModal;

window.closeChatModal = () => {
    const modal = document.getElementById('chatModal');
    if(modal) modal.classList.remove('active');
    currentChatRecipient = null;
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
        if(!user) return alert('You must be logged in to send messages.');
        
        const input = document.getElementById('chatInput');
        const fileInput = document.getElementById('chatFileInput');
        const content = input.value.trim(); // content is optional if image is present
        const file = fileInput ? fileInput.files[0] : null;

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
                alert('Failed to upload image: ' + uploadError.message);
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
            image_url: imageUrl
        };
        
        // Clear input immediately for better UX
        input.value = '';
        if(fileInput) fileInput.value = '';
        if(document.getElementById('filePreview')) document.getElementById('filePreview').style.display = 'none';

        const { error } = await supabaseClient.from('messages').insert([messageData]);

        if(error) alert('Failed to send message: ' + error.message);
    });
}

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
    bubble.innerHTML = `
        ${isSentByMe ? '' : `<div style="font-size:10px; color:#1e90ff; margin-bottom:2px;">${msg.product_name || 'General'}</div>`}
        ${msg.image_url ? `<a href="${msg.image_url}" target="_blank"><img src="${msg.image_url}" class="chat-image"></a>` : ''}
        <span>${msg.content}</span>
        <div style="font-size: 9px; opacity: 0.7; text-align: right; margin-top: 4px; display:flex; align-items:center; justify-content:flex-end;">
            ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            ${checkMarkHtml}
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
    const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name, business_name').in('id', partnerIds);
    
    const nameMap = {};
    if (profiles) {
        profiles.forEach(p => nameMap[p.id] = p.business_name || p.full_name);
    }

    // Render list
    listContainer.innerHTML = convArray.map(c => `
        <div class="wa-contact-item ${currentChatRecipient === c.partnerId ? 'active' : ''}" onclick="selectConversation('${c.partnerId}')">
            <div class="wa-avatar"><i class="fas fa-user"></i></div>
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
    
    // Update UI for Mobile/Desktop
    document.getElementById('waContainer').classList.add('chat-active');
    document.getElementById('waWelcome').style.display = 'none';
    document.getElementById('waChatView').style.display = 'flex';
    
    // Highlight sidebar item
    document.querySelectorAll('.wa-contact-item').forEach(el => el.classList.remove('active'));
    // (Re-rendering list would set active class, but visual update here is faster)
    
    // Set Header
    // Fetch Name
    const { data: profile } = await supabaseClient.from('profiles').select('full_name, business_name').eq('id', partnerId).single();
    const displayName = profile ? (profile.business_name || profile.full_name) : 'User';

    document.getElementById('currentChatName').innerText = displayName;
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
    if (error || !product) return alert('Product not found');

    // Fetch Seller Profile for Contact Info
    const { data: seller } = await supabaseClient.from('profiles').select('*').eq('id', product.seller_id).single();

    // Populate Modal
    document.getElementById('detailImage').src = product.image_url || 'https://via.placeholder.com/300?text=No+Image';
    document.getElementById('detailName').innerText = product.name;
    document.getElementById('detailPrice').innerText = isNaN(parseFloat(product.price)) ? product.price : 'K' + product.price;
    document.getElementById('detailDesc').innerText = product.description || 'No description available.';
    document.getElementById('detailCategory').innerText = product.category;
    
    // Populate Seller Contact Info
    document.getElementById('detailSellerName').innerText = seller ? (seller.business_name || seller.full_name) : 'Unknown';
    document.getElementById('detailSellerEmail').innerText = seller ? seller.email : 'N/A';
    document.getElementById('detailSellerLocation').innerText = seller ? (seller.location || 'N/A') : 'N/A';

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
    
    if (error) alert('Error deleting product: ' + error.message);
    else {
        alert('Product deleted successfully.');
        loadSellerProducts(); // Refresh the list
    }
};

// === BUY NOW LOGIC ===
window.buyNow = async (productId) => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return alert('Please login to purchase.');

    const { data: product } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!product) return alert('Product error.');
    
    // Logic: If item needs contact, alert.
    if (isNaN(parseFloat(product.price))) return alert('Please contact the seller for pricing on this item.');

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
        return alert('Item is already in your wishlist.');
    }

    const { data: product } = await supabaseClient.from('products').select('*').eq('id', productId).single();
    if (!product) return alert('Product not found.');

    wishlist.push(product);
    localStorage.setItem('sme_wishlist', JSON.stringify(wishlist));
    alert(`${product.name} added to wishlist!`);
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
    
    if (!product) return alert('Product error.');
    if (isNaN(parseFloat(product.price))) return alert('This item requires contacting the seller for pricing.');

    cart.push(product);
    localStorage.setItem('sme_cart', JSON.stringify(cart));
    updateCartCount();
    alert(`${product.name} added to cart!`);
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
    if (cart.length === 0) return alert('Cart is empty.');
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return alert('Please login to checkout.');
    
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

    if (!phone) return alert('Please enter a valid phone number');

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
        alert('Payment successful but order creation failed: ' + error.message);
    } else {
        alert(`Payment Successful via ${network}! Order placed.`);
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
    
    if (error) alert('Error updating status: ' + error.message);
    else {
        loadSellerProducts(); // Refresh seller dashboard
    }
};

// === MESSAGING & CHAT LOGIC ===

window.deleteMessage = async (id) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    const { error } = await supabaseClient.from('messages').delete().eq('id', id);

    if (error) alert('Error deleting message: ' + error.message);
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
    }
}

const adminBusinessForm = document.getElementById('adminBusinessForm');
if (adminBusinessForm) {
    adminBusinessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const businessName = document.getElementById('adminBizName').value;
        const businessType = document.getElementById('adminBizType').value;
        const location = document.getElementById('adminLocation').value;

        const { data: { user } } = await supabaseClient.auth.getUser();
        
        // Admin is implicitly verified
        const { error } = await supabaseClient.from('profiles').update({
            business_name: businessName,
            business_type: businessType,
            location: location,
            verified: true 
        }).eq('id', user.id);

        if (error) alert('Error updating business details: ' + error.message);
        else alert('Business details updated successfully!');
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
        .select('*, profiles(business_name, business_type)')
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
                <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">Sold by <span style="color: #1e90ff;">${businessName}</span></div>
                
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
            alert('Order cancelled successfully.');
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
            if (!user) return alert("You are not logged in.");

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

            alert('Profile updated successfully!');
            document.getElementById('updatePass').value = ''; // Clear password field
        } catch (error) {
            alert('Error updating profile: ' + error.message);
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

        const role = session.user.user_metadata.role || 'customer';
        const currentPath = window.location.pathname;
        
        // === MESSAGES PAGE LOGIC ===
        if (currentPath.includes('messages.html')) {
            loadConversations();
            return; // Stop further dashboard logic
        }
        
        if (role === 'seller') {
            loadSellerProducts();
            loadSellerDashboardStats();
            loadSellerPurchases(); // Load purchases tab data
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

    container.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id.slice(0,8)}</td>
            <td>${order.product_name}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td><span class="status pending">${order.status}</span></td>
            <td>K${order.price}</td>
            <td><button class="btn-primary" style="padding: 5px 10px; font-size: 12px; background: #555;">Details</button></td>
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

document.addEventListener('DOMContentLoaded', () => {
    handleAuthUI();
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
    }
});