/* Pulse Social - Feed & Posts Module */

// Relative Time Formatter
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

// Highlight Hashtags in Text
function formatPostContent(text) {
    if (!text) return '';
    // Escape HTML first for safety
    const safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    // Replace hashtags with styled spans
    return safeText.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
}

// Render Single Post Card HTML
function createPostCardHTML(post) {
    const currentUser = getCurrentUser();
    const isOwner = currentUser && currentUser.id === post.user_id;

    return `
        <div class="post-card" id="post-${post.id}" data-id="${post.id}">
            <div class="post-header">
                <div class="post-author-info">
                    <img src="${post.avatar}" alt="${post.username}" class="avatar clickable-avatar" data-username="${post.username}">
                    <div class="author-names">
                        <div class="author-fullname clickable-profile" data-username="${post.username}">
                            ${post.full_name}
                        </div>
                        <div class="author-username">
                            @${post.username} • <span class="post-time">${timeAgo(post.created_at)}</span>
                        </div>
                    </div>
                </div>

                ${!isOwner && currentUser ? `
                    <button class="btn-follow ${post.is_following_author ? 'following' : ''}" data-user-id="${post.user_id}">
                        ${post.is_following_author ? 'Following' : 'Follow'}
                    </button>
                ` : ''}

                ${isOwner ? `
                    <button class="btn-danger delete-post-btn" data-post-id="${post.id}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                ` : ''}
            </div>

            <div class="post-content">
                ${formatPostContent(post.content)}
            </div>

            ${post.image_url ? `
                <img src="${post.image_url}" alt="Post image" class="post-image" data-full="${post.image_url}">
            ` : ''}

            <div class="post-actions">
                <button class="action-btn like-btn ${post.is_liked ? 'liked' : ''}" data-post-id="${post.id}">
                    <i class="${post.is_liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    <span class="like-count">${post.likes_count}</span>
                </button>

                <button class="action-btn comment-toggle-btn" data-post-id="${post.id}">
                    <i class="fa-regular fa-comment"></i>
                    <span class="comment-count">${post.comments_count}</span>
                </button>

                <button class="action-btn share-btn" data-post-id="${post.id}">
                    <i class="fa-regular fa-share-from-square"></i> Share
                </button>
            </div>

            <div class="comments-section" id="comments-${post.id}">
                ${currentUser ? `
                    <div class="add-comment-box">
                        <img src="${currentUser.avatar}" class="avatar avatar-sm">
                        <input type="text" placeholder="Write a comment..." class="comment-input" data-post-id="${post.id}">
                        <button class="btn-primary submit-comment-btn" data-post-id="${post.id}">Post</button>
                    </div>
                ` : `
                    <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 12px;">Please log in to comment.</p>
                `}
                
                <div class="comment-list" id="comment-list-${post.id}">
                    <!-- Comments loaded dynamically -->
                </div>
            </div>
        </div>
    `;
}

// Render Comments List HTML
function createCommentItemHTML(comment) {
    const currentUser = getCurrentUser();
    const canDelete = currentUser && (currentUser.id === comment.user_id || comment.is_owner);

    return `
        <div class="comment-item" id="comment-${comment.id}">
            <img src="${comment.avatar}" class="avatar avatar-sm clickable-avatar" data-username="${comment.username}">
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-user clickable-profile" data-username="${comment.username}">
                        ${comment.full_name} <span class="text-muted">@${comment.username}</span>
                    </span>
                    <span class="comment-time">${timeAgo(comment.created_at)}</span>
                </div>
                <div class="comment-text">${comment.content}</div>
            </div>
            ${canDelete ? `
                <button class="btn-danger delete-comment-btn" data-comment-id="${comment.id}" data-post-id="${comment.post_id}">
                    <i class="fa-solid fa-times"></i>
                </button>
            ` : ''}
        </div>
    `;
}

// Toggle Like Handler
async function handleLikeToggle(postId, button) {
    if (!getToken()) {
        showToast('Please log in to like posts.', 'warning');
        openAuthModal();
        return;
    }

    try {
        const res = await API.posts.toggleLike(postId);
        const icon = button.querySelector('i');
        const countSpan = button.querySelector('.like-count');

        if (res.is_liked) {
            button.classList.add('liked');
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
        } else {
            button.classList.remove('liked');
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');
        }
        countSpan.textContent = res.likes_count;
    } catch (err) {
        showToast(err.message || 'Failed to update like status', 'error');
    }
}

// Comment Section Toggle & Load Handler
async function handleCommentToggle(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (!section) return;

    const isActive = section.classList.contains('active');
    if (isActive) {
        section.classList.remove('active');
    } else {
        section.classList.add('active');
        await loadCommentsForPost(postId);
    }
}

// Load Comments for Post
async function loadCommentsForPost(postId) {
    const listContainer = document.getElementById(`comment-list-${postId}`);
    if (!listContainer) return;

    try {
        const comments = await API.comments.getForPost(postId);
        if (comments.length === 0) {
            listContainer.innerHTML = '<p class="text-muted" style="font-size: 0.85rem;">No comments yet. Be the first to comment!</p>';
        } else {
            listContainer.innerHTML = comments.map(c => createCommentItemHTML(c)).join('');
        }
    } catch (err) {
        listContainer.innerHTML = '<p class="text-muted">Error loading comments.</p>';
    }
}

// Add Comment Handler
async function handleAddComment(postId) {
    if (!getToken()) {
        showToast('Please log in to comment.', 'warning');
        openAuthModal();
        return;
    }

    const input = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
    if (!input || !input.value.trim()) return;

    try {
        const res = await API.comments.add(postId, input.value.trim());
        input.value = '';
        showToast('Comment added!', 'success');

        // Update comment counter on post card
        const card = document.getElementById(`post-${postId}`);
        if (card) {
            const countSpan = card.querySelector('.comment-count');
            if (countSpan) countSpan.textContent = res.comments_count;
        }

        await loadCommentsForPost(postId);
    } catch (err) {
        showToast(err.message || 'Failed to add comment', 'error');
    }
}

// Delete Comment Handler
async function handleDeleteComment(commentId, postId) {
    try {
        const res = await API.comments.delete(commentId);
        showToast('Comment deleted', 'success');

        // Update comment count
        const card = document.getElementById(`post-${postId}`);
        if (card) {
            const countSpan = card.querySelector('.comment-count');
            if (countSpan) countSpan.textContent = res.comments_count;
        }

        await loadCommentsForPost(postId);
    } catch (err) {
        showToast(err.message || 'Failed to delete comment', 'error');
    }
}

// Delete Post Handler
async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
        await API.posts.delete(postId);
        showToast('Post deleted successfully', 'success');
        const card = document.getElementById(`post-${postId}`);
        if (card) {
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 250);
        }
    } catch (err) {
        showToast(err.message || 'Failed to delete post', 'error');
    }
}
