const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/database');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// GET /api/users/profile/:username
router.get('/profile/:username', optionalToken, async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        const user = await get(
            'SELECT id, username, email, full_name, bio, avatar, cover_image, created_at FROM users WHERE username = ?',
            [username]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Aggregate counts
        const postCount = await get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);
        const followersCount = await get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]);
        const followingCount = await get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]);

        user.posts_count = postCount.count;
        user.followers_count = followersCount.count;
        user.following_count = followingCount.count;

        // Check if req.user is following this profile
        user.is_following = false;
        if (req.user && req.user.id !== user.id) {
            const follow = await get(
                'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
                [req.user.id, user.id]
            );
            user.is_following = !!follow;
        }

        user.is_self = req.user ? req.user.id === user.id : false;

        res.json(user);
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Server error retrieving user profile.' });
    }
});

// PUT /api/users/profile - Edit Profile
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { full_name, bio, avatar, cover_image } = req.body;
        const userId = req.user.id;

        const current = await get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!current) return res.status(404).json({ error: 'User not found' });

        const updatedFullName = full_name !== undefined ? full_name.trim() : current.full_name;
        const updatedBio = bio !== undefined ? bio.trim() : current.bio;
        const updatedAvatar = avatar !== undefined ? avatar.trim() : current.avatar;
        const updatedCover = cover_image !== undefined ? cover_image.trim() : current.cover_image;

        await run(
            `UPDATE users SET full_name = ?, bio = ?, avatar = ?, cover_image = ? WHERE id = ?`,
            [updatedFullName, updatedBio, updatedAvatar, updatedCover, userId]
        );

        const updatedUser = await get(
            'SELECT id, username, email, full_name, bio, avatar, cover_image, created_at FROM users WHERE id = ?',
            [userId]
        );

        res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Server error updating profile.' });
    }
});

// POST /api/users/upload-avatar
router.post('/upload-avatar', verifyToken, upload.single('avatar'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    res.json({ url: avatarUrl });
});

// POST /api/users/upload-cover
router.post('/upload-cover', verifyToken, upload.single('cover'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const coverUrl = `/uploads/${req.file.filename}`;
    res.json({ url: coverUrl });
});

// POST /api/users/:id/follow - Toggle Follow / Unfollow
router.post('/:id/follow', verifyToken, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        const followerId = req.user.id;

        if (targetId === followerId) {
            return res.status(400).json({ error: 'You cannot follow yourself.' });
        }

        const targetUser = await get('SELECT id FROM users WHERE id = ?', [targetId]);
        if (!targetUser) {
            return res.status(404).json({ error: 'User to follow not found.' });
        }

        const existing = await get(
            'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
            [followerId, targetId]
        );

        let isFollowing = false;
        if (existing) {
            // Unfollow
            await run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, targetId]);
            isFollowing = false;
        } else {
            // Follow
            await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [followerId, targetId]);
            isFollowing = true;
        }

        const followersCount = await get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [targetId]);

        res.json({
            message: isFollowing ? 'Followed successfully' : 'Unfollowed successfully',
            is_following: isFollowing,
            followers_count: followersCount.count
        });
    } catch (err) {
        console.error('Follow error:', err);
        res.status(500).json({ error: 'Server error processing follow request.' });
    }
});

// GET /api/users/:id/followers
router.get('/:id/followers', optionalToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const followers = await all(
            `SELECT u.id, u.username, u.full_name, u.avatar, u.bio
             FROM follows f
             JOIN users u ON f.follower_id = u.id
             WHERE f.following_id = ?
             ORDER BY f.created_at DESC`,
            [userId]
        );

        if (req.user) {
            for (let f of followers) {
                const check = await get(
                    'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
                    [req.user.id, f.id]
                );
                f.is_following = !!check;
                f.is_self = req.user.id === f.id;
            }
        }

        res.json(followers);
    } catch (err) {
        console.error('Get followers error:', err);
        res.status(500).json({ error: 'Server error retrieving followers.' });
    }
});

// GET /api/users/:id/following
router.get('/:id/following', optionalToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const following = await all(
            `SELECT u.id, u.username, u.full_name, u.avatar, u.bio
             FROM follows f
             JOIN users u ON f.following_id = u.id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC`,
            [userId]
        );

        if (req.user) {
            for (let f of following) {
                const check = await get(
                    'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
                    [req.user.id, f.id]
                );
                f.is_following = !!check;
                f.is_self = req.user.id === f.id;
            }
        }

        res.json(following);
    } catch (err) {
        console.error('Get following error:', err);
        res.status(500).json({ error: 'Server error retrieving following list.' });
    }
});

// GET /api/users/suggested - Suggested users to follow
router.get('/suggested/list', optionalToken, async (req, res) => {
    try {
        let users;
        if (req.user) {
            users = await all(
                `SELECT u.id, u.username, u.full_name, u.avatar, u.bio
                 FROM users u
                 WHERE u.id != ? AND u.id NOT IN (
                     SELECT following_id FROM follows WHERE follower_id = ?
                 )
                 ORDER BY RANDOM()
                 LIMIT 5`,
                [req.user.id, req.user.id]
            );
        } else {
            users = await all(
                `SELECT u.id, u.username, u.full_name, u.avatar, u.bio FROM users ORDER BY RANDOM() LIMIT 5`
            );
        }

        res.json(users);
    } catch (err) {
        console.error('Get suggested users error:', err);
        res.status(500).json({ error: 'Server error fetching suggested users.' });
    }
});

// GET /api/users/search - Search users
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q ? req.query.q.trim() : '';
        if (!query) return res.json([]);

        const users = await all(
            `SELECT id, username, full_name, avatar, bio FROM users 
             WHERE username LIKE ? OR full_name LIKE ? 
             LIMIT 10`,
            [`%${query}%`, `%${query}%`]
        );

        res.json(users);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Server error during user search.' });
    }
});

module.exports = router;
