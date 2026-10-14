const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../db/database');
const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, full_name } = req.body;

        if (!username || !email || !password || !full_name) {
            return res.status(400).json({ error: 'All fields (username, email, password, full_name) are required.' });
        }

        // Check if username or email exists
        const existingUser = await get(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username.toLowerCase().trim(), email.toLowerCase().trim()]
        );

        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already taken.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Default avatar
        const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;

        // Insert new user
        const result = await run(
            `INSERT INTO users (username, email, password_hash, full_name, avatar) VALUES (?, ?, ?, ?, ?)`,
            [username.toLowerCase().trim(), email.toLowerCase().trim(), password_hash, full_name.trim(), defaultAvatar]
        );

        const newUser = await get('SELECT id, username, email, full_name, bio, avatar, cover_image, created_at FROM users WHERE id = ?', [result.id]);

        // Generate JWT
        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: newUser
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        if (!usernameOrEmail || !password) {
            return res.status(400).json({ error: 'Username/Email and password are required.' });
        }

        const cleanInput = usernameOrEmail.toLowerCase().trim();
        const user = await get(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [cleanInput, cleanInput]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const { password_hash, ...userWithoutPassword } = user;

        res.json({
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await get(
            'SELECT id, username, email, full_name, bio, avatar, cover_image, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Get counts
        const postCount = await get('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [user.id]);
        const followersCount = await get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [user.id]);
        const followingCount = await get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [user.id]);

        user.posts_count = postCount.count;
        user.followers_count = followersCount.count;
        user.following_count = followingCount.count;

        res.json(user);
    } catch (err) {
        console.error('Fetch profile error:', err);
        res.status(500).json({ error: 'Server error fetching profile.' });
    }
});

module.exports = router;
