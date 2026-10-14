const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/database');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// POST /api/posts/upload-image
router.post('/upload-image', verifyToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

// POST /api/posts - Create a new post
router.post('/', verifyToken, async (req, res) => {
    try {
        const { content, image_url } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Post content cannot be empty.' });
        }

        const result = await run(
            `INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)`,
            [req.user.id, content.trim(), image_url || '']
        );

        const newPost = await get(`
            SELECT p.id, p.content, p.image_url, p.created_at, p.user_id,
                   u.username, u.full_name, u.avatar
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `, [result.id]);

        newPost.likes_count = 0;
        newPost.comments_count = 0;
        newPost.is_liked = false;
        newPost.is_owner = true;

        res.status(201).json({
            message: 'Post created successfully',
            post: newPost
        });
    } catch (err) {
        console.error('Create post error:', err);
        res.status(500).json({ error: 'Server error creating post.' });
    }
});

// GET /api/posts - Get posts feed
router.get('/', optionalToken, async (req, res) => {
    try {
        const { feed, username, search } = req.query;
        let sql = `
            SELECT p.id, p.content, p.image_url, p.created_at, p.user_id,
                   u.username, u.full_name, u.avatar,
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
        `;
        let params = [];
        let whereClauses = [];

        if (feed === 'following' && req.user) {
            whereClauses.push(`(p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ?)`);
            params.push(req.user.id, req.user.id);
        } else if (username) {
            const author = await get('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
            if (!author) return res.json([]);
            whereClauses.push(`p.user_id = ?`);
            params.push(author.id);
        } else if (search) {
            whereClauses.push(`(p.content LIKE ? OR u.username LIKE ? OR u.full_name LIKE ?)`);
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (whereClauses.length > 0) {
            sql += ` WHERE ` + whereClauses.join(' AND ');
        }

        sql += ` ORDER BY p.created_at DESC`;

        const posts = await all(sql, params);

        // Process user-specific interaction flags
        for (let post of posts) {
            post.is_liked = false;
            post.is_owner = req.user ? req.user.id === post.user_id : false;
            post.is_following_author = false;

            if (req.user) {
                const liked = await get('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, post.id]);
                post.is_liked = !!liked;

                if (req.user.id !== post.user_id) {
                    const following = await get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, post.user_id]);
                    post.is_following_author = !!following;
                }
            }
        }

        res.json(posts);
    } catch (err) {
        console.error('Fetch posts error:', err);
        res.status(500).json({ error: 'Server error retrieving feed posts.' });
    }
});

// GET /api/posts/:id - Single Post
router.get('/:id', optionalToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const post = await get(`
            SELECT p.id, p.content, p.image_url, p.created_at, p.user_id,
                   u.username, u.full_name, u.avatar,
                   (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
                   (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.id = ?
        `, [postId]);

        if (!post) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        post.is_liked = false;
        post.is_owner = req.user ? req.user.id === post.user_id : false;

        if (req.user) {
            const liked = await get('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', [req.user.id, post.id]);
            post.is_liked = !!liked;
        }

        res.json(post);
    } catch (err) {
        console.error('Fetch post error:', err);
        res.status(500).json({ error: 'Server error fetching post.' });
    }
});

// DELETE /api/posts/:id - Delete Post
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const post = await get('SELECT * FROM posts WHERE id = ?', [postId]);

        if (!post) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        if (post.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You can only delete your own posts.' });
        }

        await run('DELETE FROM posts WHERE id = ?', [postId]);
        res.json({ message: 'Post deleted successfully', postId });
    } catch (err) {
        console.error('Delete post error:', err);
        res.status(500).json({ error: 'Server error deleting post.' });
    }
});

// POST /api/posts/:id/like - Toggle Like
router.post('/:id/like', verifyToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const userId = req.user.id;

        const post = await get('SELECT id FROM posts WHERE id = ?', [postId]);
        if (!post) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        const existingLike = await get('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);

        let isLiked = false;
        if (existingLike) {
            // Unlike
            await run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
            isLiked = false;
        } else {
            // Like
            await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
            isLiked = true;
        }

        const likesCountRes = await get('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [postId]);

        res.json({
            is_liked: isLiked,
            likes_count: likesCountRes.count
        });
    } catch (err) {
        console.error('Like error:', err);
        res.status(500).json({ error: 'Server error toggling like.' });
    }
});

// GET /api/posts/:id/likes - List of users who liked the post
router.get('/:id/likes', optionalToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const users = await all(`
            SELECT u.id, u.username, u.full_name, u.avatar, u.bio
            FROM likes l
            JOIN users u ON l.user_id = u.id
            WHERE l.post_id = ?
            ORDER BY l.created_at DESC
        `, [postId]);

        if (req.user) {
            for (let user of users) {
                const followCheck = await get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [req.user.id, user.id]);
                user.is_following = !!followCheck;
                user.is_self = req.user.id === user.id;
            }
        }

        res.json(users);
    } catch (err) {
        console.error('Fetch post likes error:', err);
        res.status(500).json({ error: 'Server error fetching post likes.' });
    }
});

module.exports = router;
