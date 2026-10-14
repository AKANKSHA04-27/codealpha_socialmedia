const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/database');
const { verifyToken, optionalToken } = require('../middleware/authMiddleware');

// POST /api/comments/post/:postId - Add comment
router.post('/post/:postId', verifyToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment text cannot be empty.' });
        }

        const post = await get('SELECT id FROM posts WHERE id = ?', [postId]);
        if (!post) {
            return res.status(404).json({ error: 'Post not found.' });
        }

        const result = await run(
            `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
            [postId, req.user.id, content.trim()]
        );

        const newComment = await get(`
            SELECT c.id, c.content, c.created_at, c.post_id, c.user_id,
                   u.username, u.full_name, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [result.id]);

        newComment.is_owner = true;

        const countRes = await get('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [postId]);

        res.status(201).json({
            message: 'Comment added successfully',
            comment: newComment,
            comments_count: countRes.count
        });
    } catch (err) {
        console.error('Add comment error:', err);
        res.status(500).json({ error: 'Server error adding comment.' });
    }
});

// GET /api/comments/post/:postId - Get post comments
router.get('/post/:postId', optionalToken, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        const comments = await all(`
            SELECT c.id, c.content, c.created_at, c.post_id, c.user_id,
                   u.username, u.full_name, u.avatar
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
        `, [postId]);

        for (let c of comments) {
            c.is_owner = req.user ? req.user.id === c.user_id : false;
        }

        res.json(comments);
    } catch (err) {
        console.error('Get comments error:', err);
        res.status(500).json({ error: 'Server error fetching comments.' });
    }
});

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const comment = await get(`
            SELECT c.id, c.user_id, c.post_id, p.user_id as post_author_id
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            WHERE c.id = ?
        `, [commentId]);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found.' });
        }

        // Allow deletion if caller is comment author OR post author
        if (comment.user_id !== req.user.id && comment.post_author_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized: You cannot delete this comment.' });
        }

        await run('DELETE FROM comments WHERE id = ?', [commentId]);

        const countRes = await get('SELECT COUNT(*) as count FROM comments WHERE post_id = ?', [comment.post_id]);

        res.json({
            message: 'Comment deleted successfully',
            commentId,
            postId: comment.post_id,
            comments_count: countRes.count
        });
    } catch (err) {
        console.error('Delete comment error:', err);
        res.status(500).json({ error: 'Server error deleting comment.' });
    }
});

module.exports = router;
