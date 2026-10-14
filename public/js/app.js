/* Pulse Social - Main Application Controller */

let currentView = 'feed'; // 'feed', 'following', 'profile', 'search', 'tag'
let currentProfileUsername = null;
let currentTagFilter = null;
let currentSearchQuery = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkAuthStatus();
    loadSuggestedUsers();
    setupEventListeners();
    loadMainView('all');
});

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('pulse_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pulse_theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// Modal Helpers
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// Check Authentication Status
async function checkAuthStatus() {
    const token = getToken();
    const navRight = document.getElementById('nav-right-actions');
    const createCard = document.getElementById('create-post-card');
    const leftUserCard = document.getElementById('sidebar-user-card');

    if (!token) {
        // Logged Out
        if (navRight) {
            navRight.innerHTML = `
                <button class="btn-secondary" id="open-login-btn">Log In</button>
                <button class="btn-primary" id="open-register-btn">Sign Up</button>
            `;
        }
        if (createCard) createCard.style.display = 'none';
        if (leftUserCard) leftUserCard.style.display = 'none';
        return;
    }

    try {
        const user = await API.auth.me();
        setCurrentUser(user);

        // Update Navbar
        if (navRight) {
            navRight.innerHTML = `
                <button class="btn-primary" id="header-create-post-btn">
                    <i class="fa-solid fa-plus"></i> Post
                </button>
                <div class="user-mini-card" id="header-user-btn" style="padding: 4px 10px;">
                    <img src="${user.avatar}" class="avatar avatar-sm">
                    <span style="font-size: 0.9rem; font-weight: 600;">${user.full_name.split(' ')[0]}</span>
                </div>
            `;
        }

        // Update Create Post Input Box Avatar
        if (createCard) {
            createCard.style.display = 'block';
            const inputAvatar = createCard.querySelector('.avatar');
            if (inputAvatar) inputAvatar.src = user.avatar;
        }

        // Update Left Sidebar Profile Card
        if (leftUserCard) {
            leftUserCard.style.display = 'flex';
            leftUserCard.innerHTML = `
                <img src="${user.avatar}" class="avatar avatar-sm">
                <div class="author-names">
                    <div class="author-fullname" style="font-size: 0.88rem;">${user.full_name}</div>
                    <div class="author-username" style="font-size: 0.78rem;">@${user.username}</div>
                </div>
            `;
            leftUserCard.onclick = () => loadProfileView(user.username);
        }
    } catch (err) {
        removeToken();
        checkAuthStatus();
    }
}

// Load Main Feed View
async function loadMainView(feedType = 'all') {
    currentView = 'feed';
    const mainArea = document.getElementById('main-feed-area');
    const feedTabs = document.getElementById('feed-filter-tabs');

    if (feedTabs) feedTabs.style.display = 'flex';

    // Update active tab UI
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    const targetTab = document.querySelector(`.feed-tab[data-feed="${feedType}"]`);
    if (targetTab) targetTab.classList.add('active');

    mainArea.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-primary);"></i></div>';

    try {
        const posts = await API.posts.getFeed({ feed: feedType });
        if (posts.length === 0) {
            mainArea.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-folder-open"></i>
                    <h3>No posts found</h3>
                    <p>Be the first to share something with the community!</p>
                </div>
            `;
        } else {
            mainArea.innerHTML = posts.map(p => createPostCardHTML(p)).join('');
        }
    } catch (err) {
        mainArea.innerHTML = `<div class="empty-state"><h3>Error loading posts</h3><p>${err.message}</p></div>`;
    }
}

// Load Profile View
async function loadProfileView(username) {
    currentView = 'profile';
    currentProfileUsername = username;

    const mainArea = document.getElementById('main-feed-area');
    const feedTabs = document.getElementById('feed-filter-tabs');

    if (feedTabs) feedTabs.style.display = 'none';

    mainArea.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--accent-primary);"></i></div>';

    try {
        const profileUser = await API.users.getProfile(username);
        const userPosts = await API.posts.getFeed({ username: username });

        let profileHTML = createProfileCardHTML(profileUser);

        profileHTML += `
            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 12px; margin-top: 8px;">
                ${profileUser.full_name}'s Posts (${userPosts.length})
            </div>
            <div id="profile-posts-list">
        `;

        if (userPosts.length === 0) {
            profileHTML += `
                <div class="empty-state">
                    <i class="fa-regular fa-clone"></i>
                    <h3>No posts yet</h3>
                    <p>This user has not posted anything yet.</p>
                </div>
            `;
        } else {
            profileHTML += userPosts.map(p => createPostCardHTML(p)).join('');
        }

        profileHTML += `</div>`;
        mainArea.innerHTML = profileHTML;

    } catch (err) {
        mainArea.innerHTML = `<div class="empty-state"><h3>Profile Error</h3><p>${err.message}</p></div>`;
    }
}

// Load Suggested Users
async function loadSuggestedUsers() {
    const container = document.getElementById('suggested-users-list');
    if (!container) return;

    try {
        const users = await API.users.getSuggested();
        if (users.length === 0) {
            container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">No new suggestions available.</p>';
        } else {
            container.innerHTML = users.map(u => `
                <div class="suggested-user-item">
                    <div class="post-author-info">
                        <img src="${u.avatar}" class="avatar avatar-sm clickable-avatar" data-username="${u.username}">
                        <div class="author-names">
                            <div class="author-fullname clickable-profile" data-username="${u.username}">${u.full_name}</div>
                            <div class="author-username">@${u.username}</div>
                        </div>
                    </div>
                    ${getToken() ? `
                        <button class="btn-follow" data-user-id="${u.id}">Follow</button>
                    ` : ''}
                </div>
            `).join('');
        }
    } catch (err) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">Failed to load suggestions.</p>';
    }
}

// Global Event Listeners
function setupEventListeners() {
    // Theme Switcher
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

    // Navbar Brand Logo -> Home Feed
    document.querySelector('.brand-logo')?.addEventListener('click', () => {
        loadMainView('all');
    });

    // Left Navigation Links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const page = link.getAttribute('data-page');
            if (page === 'home') loadMainView('all');
            if (page === 'following') {
                if (!getToken()) {
                    showToast('Please log in to view your following feed.', 'warning');
                    openAuthModal();
                    return;
                }
                loadMainView('following');
            }
            if (page === 'explore') loadMainView('all');
            if (page === 'profile') {
                const currentUser = getCurrentUser();
                if (currentUser) loadProfileView(currentUser.username);
                else openAuthModal();
            }
        });
    });

    // Feed Tabs Filter Toggle
    document.querySelectorAll('.feed-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const feed = tab.getAttribute('data-feed');
            if (feed === 'following' && !getToken()) {
                showToast('Please log in to view following feed.', 'warning');
                openAuthModal();
                return;
            }
            loadMainView(feed);
        });
    });

    // Modal Close Buttons
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Delegated Clicks (Follows, Likes, Comments, Profiles, Share, Delete, Demo accounts)
    document.addEventListener('click', async (e) => {
        // Open Login/Register Modals
        if (e.target.closest('#open-login-btn')) openAuthModal('login');
        if (e.target.closest('#open-register-btn')) openAuthModal('register');

        // Header User Card -> Go to Profile
        if (e.target.closest('#header-user-btn')) {
            const current = getCurrentUser();
            if (current) loadProfileView(current.username);
        }

        // Header / Floating Create Post
        if (e.target.closest('#header-create-post-btn') || e.target.closest('#sidebar-create-btn')) {
            if (!getToken()) {
                showToast('Please log in to create a post.', 'warning');
                openAuthModal();
            } else {
                openModal('create-post-modal');
            }
        }

        // Profile Click (Username or Avatar)
        const profileEl = e.target.closest('.clickable-profile') || e.target.closest('.clickable-avatar');
        if (profileEl) {
            const username = profileEl.getAttribute('data-username');
            if (username) loadProfileView(username);
        }

        // Follow / Unfollow Button
        const followBtn = e.target.closest('.btn-follow');
        if (followBtn) {
            if (!getToken()) {
                showToast('Please log in to follow users.', 'warning');
                openAuthModal();
                return;
            }
            const targetId = followBtn.getAttribute('data-user-id');
            try {
                const res = await API.users.toggleFollow(targetId);
                if (res.is_following) {
                    followBtn.classList.add('following');
                    followBtn.textContent = 'Following';
                } else {
                    followBtn.classList.remove('following');
                    followBtn.textContent = 'Follow';
                }

                // If on profile header, update stats counter
                const countNum = document.getElementById('followers-count-num');
                if (countNum) countNum.textContent = res.followers_count;

                showToast(res.message, 'success');
                loadSuggestedUsers();
            } catch (err) {
                showToast(err.message || 'Follow error', 'error');
            }
        }

        // Like Button
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            const postId = likeBtn.getAttribute('data-post-id');
            handleLikeToggle(postId, likeBtn);
        }

        // Comment Toggle Button
        const commentToggleBtn = e.target.closest('.comment-toggle-btn');
        if (commentToggleBtn) {
            const postId = commentToggleBtn.getAttribute('data-post-id');
            handleCommentToggle(postId);
        }

        // Submit Comment Button
        const submitCommentBtn = e.target.closest('.submit-comment-btn');
        if (submitCommentBtn) {
            const postId = submitCommentBtn.getAttribute('data-post-id');
            handleAddComment(postId);
        }

        // Delete Comment Button
        const deleteCommentBtn = e.target.closest('.delete-comment-btn');
        if (deleteCommentBtn) {
            const commentId = deleteCommentBtn.getAttribute('data-comment-id');
            const postId = deleteCommentBtn.getAttribute('data-post-id');
            handleDeleteComment(commentId, postId);
        }

        // Delete Post Button
        const deletePostBtn = e.target.closest('.delete-post-btn');
        if (deletePostBtn) {
            const postId = deletePostBtn.getAttribute('data-post-id');
            handleDeletePost(postId);
        }

        // Share Link Button
        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            const postId = shareBtn.getAttribute('data-post-id');
            const shareUrl = `${window.location.origin}/#post-${postId}`;
            navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        }

        // Open Edit Profile Modal
        if (e.target.closest('#edit-profile-btn')) {
            const current = getCurrentUser();
            if (current) {
                document.getElementById('edit-name-input').value = current.full_name;
                document.getElementById('edit-bio-input').value = current.bio || '';
                document.getElementById('edit-avatar-input').value = current.avatar || '';
                document.getElementById('edit-cover-input').value = current.cover_image || '';
                openModal('edit-profile-modal');
            }
        }

        // Followers / Following Stats Click
        if (e.target.closest('#stat-followers')) {
            const userId = e.target.closest('#stat-followers').getAttribute('data-user-id');
            openFollowersModal(userId);
        }
        if (e.target.closest('#stat-following')) {
            const userId = e.target.closest('#stat-following').getAttribute('data-user-id');
            openFollowingModal(userId);
        }

        // Demo Account Pill Click
        const demoPill = e.target.closest('.demo-pill');
        if (demoPill) {
            const username = demoPill.getAttribute('data-demo-user');
            quickDemoLogin(username);
        }

        // Image Click Zoom / Lightbox
        const postImg = e.target.closest('.post-image');
        if (postImg) {
            const src = postImg.getAttribute('data-full') || postImg.src;
            document.getElementById('lightbox-img').src = src;
            openModal('lightbox-modal');
        }
    });

    // Enter Key for Comment Inputs
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
            const postId = e.target.getAttribute('data-post-id');
            handleAddComment(postId);
        }
    });

    // Setup Create Post Form Submit
    const inlineSubmitBtn = document.getElementById('inline-post-submit-btn');
    const inlineTextArea = document.getElementById('inline-post-text');
    const inlineImageInput = document.getElementById('inline-post-image-url');

    if (inlineSubmitBtn && inlineTextArea) {
        inlineSubmitBtn.addEventListener('click', async () => {
            if (!inlineTextArea.value.trim()) {
                showToast('Please enter post content.', 'warning');
                return;
            }
            try {
                await API.posts.create({
                    content: inlineTextArea.value.trim(),
                    image_url: inlineImageInput ? inlineImageInput.value.trim() : ''
                });
                inlineTextArea.value = '';
                if (inlineImageInput) inlineImageInput.value = '';
                showToast('Post created!', 'success');
                loadMainView('all');
            } catch (err) {
                showToast(err.message || 'Error creating post', 'error');
            }
        });
    }

    // Modal Create Post Form
    const modalPostForm = document.getElementById('modal-post-form');
    if (modalPostForm) {
        modalPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('modal-post-text').value;
            const imgUrl = document.getElementById('modal-post-img-url').value;

            if (!text.trim()) {
                showToast('Content is required.', 'warning');
                return;
            }

            try {
                await API.posts.create({ content: text.trim(), image_url: imgUrl.trim() });
                closeAllModals();
                document.getElementById('modal-post-text').value = '';
                document.getElementById('modal-post-img-url').value = '';
                showToast('Post published successfully!', 'success');
                loadMainView('all');
            } catch (err) {
                showToast(err.message || 'Failed to publish post', 'error');
            }
        });
    }

    // Save Edit Profile Form
    const editProfileForm = document.getElementById('edit-profile-form');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('edit-name-input').value;
            const bio = document.getElementById('edit-bio-input').value;
            const avatar = document.getElementById('edit-avatar-input').value;
            const cover = document.getElementById('edit-cover-input').value;

            try {
                const res = await API.users.updateProfile({
                    full_name: name,
                    bio: bio,
                    avatar: avatar,
                    cover_image: cover
                });
                setCurrentUser(res.user);
                closeAllModals();
                showToast('Profile updated!', 'success');
                checkAuthStatus();
                loadProfileView(res.user.username);
            } catch (err) {
                showToast(err.message || 'Profile update failed', 'error');
            }
        });
    }

    // Search Input Live Filter
    const searchInput = document.getElementById('global-search-input');
    const searchDropdown = document.getElementById('search-results-dropdown');
    if (searchInput && searchDropdown) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const val = searchInput.value.trim();
            if (!val) {
                searchDropdown.classList.remove('active');
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const results = await API.users.search(val);
                    if (results.length === 0) {
                        searchDropdown.innerHTML = '<div class="search-item"><span class="text-muted">No users found</span></div>';
                    } else {
                        searchDropdown.innerHTML = results.map(u => `
                            <div class="search-item clickable-profile" data-username="${u.username}">
                                <img src="${u.avatar}" class="avatar avatar-sm">
                                <div class="author-names">
                                    <div class="author-fullname">${u.full_name}</div>
                                    <div class="author-username">@${u.username}</div>
                                </div>
                            </div>
                        `).join('');
                    }
                    searchDropdown.classList.add('active');
                } catch (err) {
                    console.error(err);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) {
                searchDropdown.classList.remove('active');
            }
        });
    }
}

// Quick Demo Login Helper
async function quickDemoLogin(username) {
    try {
        const res = await API.auth.login({
            usernameOrEmail: username,
            password: 'password123'
        });
        setToken(res.token);
        setCurrentUser(res.user);
        checkAuthStatus();
        showToast(`Logged in as @${username}!`, 'success');
        loadMainView('all');
    } catch (err) {
        showToast('Demo login failed: ' + err.message, 'error');
    }
}

// Open Auth Modal (Login vs Register)
function openAuthModal(mode = 'login') {
    const modalTitle = document.getElementById('auth-modal-title');
    const loginFields = document.getElementById('login-fields');
    const registerFields = document.getElementById('register-fields');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-mode');

    if (mode === 'login') {
        modalTitle.textContent = 'Welcome Back';
        loginFields.style.display = 'block';
        registerFields.style.display = 'none';
        submitBtn.textContent = 'Log In';
        toggleText.innerHTML = `Don't have an account? <a href="#" id="switch-to-register">Sign Up</a>`;
    } else {
        modalTitle.textContent = 'Create Account';
        loginFields.style.display = 'none';
        registerFields.style.display = 'block';
        submitBtn.textContent = 'Sign Up';
        toggleText.innerHTML = `Already have an account? <a href="#" id="switch-to-login">Log In</a>`;
    }

    openModal('auth-modal');

    // Toggle Link Switchers inside modal
    document.getElementById('switch-to-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal('register');
    });
    document.getElementById('switch-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal('login');
    });

    // Handle Auth Form Submission
    const authForm = document.getElementById('auth-form');
    authForm.onsubmit = async (e) => {
        e.preventDefault();
        if (mode === 'login') {
            const userOrEmail = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            try {
                const res = await API.auth.login({ usernameOrEmail: userOrEmail, password });
                setToken(res.token);
                setCurrentUser(res.user);
                closeAllModals();
                showToast('Welcome back!', 'success');
                checkAuthStatus();
                loadMainView('all');
            } catch (err) {
                showToast(err.message || 'Login failed', 'error');
            }
        } else {
            const username = document.getElementById('reg-username').value;
            const email = document.getElementById('reg-email').value;
            const full_name = document.getElementById('reg-fullname').value;
            const password = document.getElementById('reg-password').value;

            try {
                const res = await API.auth.register({ username, email, full_name, password });
                setToken(res.token);
                setCurrentUser(res.user);
                closeAllModals();
                showToast('Account created successfully!', 'success');
                checkAuthStatus();
                loadMainView('all');
            } catch (err) {
                showToast(err.message || 'Registration failed', 'error');
            }
        }
    };
}
