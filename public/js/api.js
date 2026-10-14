/* Pulse Social - API Layer */

const API_BASE = '/api';

// Auth State Management
function getToken() {
    return localStorage.getItem('pulse_token');
}

function setToken(token) {
    localStorage.setItem('pulse_token', token);
}

function removeToken() {
    localStorage.removeItem('pulse_token');
    localStorage.removeItem('pulse_user');
}

function setCurrentUser(user) {
    localStorage.setItem('pulse_user', JSON.stringify(user));
}

function getCurrentUser() {
    const userStr = localStorage.getItem('pulse_user');
    return userStr ? JSON.parse(userStr) : null;
}

// Universal API Fetcher
async function apiFetch(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = getToken();

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred during request.');
        }

        return data;
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

// API Services Object
const API = {
    auth: {
        login: (credentials) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
        register: (userData) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
        me: () => apiFetch('/auth/me')
    },
    users: {
        getProfile: (username) => apiFetch(`/users/profile/${username}`),
        updateProfile: (profileData) => apiFetch('/users/profile', { method: 'PUT', body: JSON.stringify(profileData) }),
        uploadAvatar: (formData) => apiFetch('/users/upload-avatar', { method: 'POST', body: formData }),
        uploadCover: (formData) => apiFetch('/users/upload-cover', { method: 'POST', body: formData }),
        toggleFollow: (userId) => apiFetch(`/users/${userId}/follow`, { method: 'POST' }),
        getFollowers: (userId) => apiFetch(`/users/${userId}/followers`),
        getFollowing: (userId) => apiFetch(`/users/${userId}/following`),
        getSuggested: () => apiFetch('/users/suggested/list'),
        search: (query) => apiFetch(`/users/search?q=${encodeURIComponent(query)}`)
    },
    posts: {
        getFeed: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return apiFetch(`/posts?${query}`);
        },
        getSingle: (id) => apiFetch(`/posts/${id}`),
        create: (postData) => apiFetch('/posts', { method: 'POST', body: JSON.stringify(postData) }),
        uploadImage: (formData) => apiFetch('/posts/upload-image', { method: 'POST', body: formData }),
        delete: (id) => apiFetch(`/posts/${id}`, { method: 'DELETE' }),
        toggleLike: (id) => apiFetch(`/posts/${id}/like`, { method: 'POST' }),
        getLikes: (id) => apiFetch(`/posts/${id}/likes`)
    },
    comments: {
        getForPost: (postId) => apiFetch(`/comments/post/${postId}`),
        add: (postId, content) => apiFetch(`/comments/post/${postId}`, { method: 'POST', body: JSON.stringify({ content }) }),
        delete: (commentId) => apiFetch(`/comments/${commentId}`, { method: 'DELETE' })
    }
};
