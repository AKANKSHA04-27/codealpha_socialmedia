/* Pulse Social - Profile Module */

// Render Profile Header Card
function createProfileCardHTML(user) {
    const currentUser = getCurrentUser();
    const isSelf = user.is_self;

    return `
        <div class="profile-card">
            <img src="${user.cover_image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800'}" alt="Cover Image" class="profile-cover">
            
            <div class="profile-info-header">
                <div class="profile-avatar-row">
                    <img src="${user.avatar}" alt="${user.username}" class="avatar avatar-xl">
                    <div>
                        ${isSelf ? `
                            <button class="btn-secondary" id="edit-profile-btn">
                                <i class="fa-solid fa-pen"></i> Edit Profile
                            </button>
                        ` : currentUser ? `
                            <button class="btn-follow ${user.is_following ? 'following' : ''}" id="profile-follow-btn" data-user-id="${user.id}">
                                ${user.is_following ? 'Following' : 'Follow'}
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="profile-names">
                    <h2 class="profile-fullname">${user.full_name}</h2>
                    <div class="profile-username">@${user.username}</div>
                </div>

                <p class="profile-bio">${user.bio || 'No bio provided yet.'}</p>

                <div class="profile-stats">
                    <div class="stat-item" id="stat-posts">
                        <span class="stat-number">${user.posts_count}</span>
                        <span class="stat-label">Posts</span>
                    </div>
                    <div class="stat-item" id="stat-followers" data-user-id="${user.id}">
                        <span class="stat-number" id="followers-count-num">${user.followers_count}</span>
                        <span class="stat-label">Followers</span>
                    </div>
                    <div class="stat-item" id="stat-following" data-user-id="${user.id}">
                        <span class="stat-number">${user.following_count}</span>
                        <span class="stat-label">Following</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render User List Item (for Followers / Following Modal)
function createUserListItemHTML(user) {
    const currentUser = getCurrentUser();
    const isSelf = currentUser && currentUser.id === user.id;

    return `
        <div class="suggested-user-item">
            <div class="post-author-info">
                <img src="${user.avatar}" class="avatar avatar-sm clickable-avatar" data-username="${user.username}">
                <div class="author-names">
                    <div class="author-fullname clickable-profile" data-username="${user.username}">
                        ${user.full_name}
                    </div>
                    <div class="author-username">@${user.username}</div>
                </div>
            </div>
            ${!isSelf && currentUser ? `
                <button class="btn-follow ${user.is_following ? 'following' : ''}" data-user-id="${user.id}">
                    ${user.is_following ? 'Following' : 'Follow'}
                </button>
            ` : ''}
        </div>
    `;
}

// Open Followers List Modal
async function openFollowersModal(userId) {
    try {
        const followers = await API.users.getFollowers(userId);
        const content = document.getElementById('user-list-modal-body');
        document.getElementById('user-list-modal-title').textContent = 'Followers';

        if (followers.length === 0) {
            content.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">No followers yet.</p>';
        } else {
            content.innerHTML = followers.map(u => createUserListItemHTML(u)).join('');
        }

        openModal('user-list-modal');
    } catch (err) {
        showToast(err.message || 'Failed to fetch followers', 'error');
    }
}

// Open Following List Modal
async function openFollowingModal(userId) {
    try {
        const following = await API.users.getFollowing(userId);
        const content = document.getElementById('user-list-modal-body');
        document.getElementById('user-list-modal-title').textContent = 'Following';

        if (following.length === 0) {
            content.innerHTML = '<p class="text-muted" style="text-align: center; padding: 20px;">Not following anyone yet.</p>';
        } else {
            content.innerHTML = following.map(u => createUserListItemHTML(u)).join('');
        }

        openModal('user-list-modal');
    } catch (err) {
        showToast(err.message || 'Failed to fetch following list', 'error');
    }
}
