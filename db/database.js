const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'social_media.db');
const db = new sqlite3.Database(dbPath);

// Helper for Promisified DB Queries
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Initialize Database Tables
async function initDB() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Enable foreign keys
                db.run('PRAGMA foreign_keys = ON');

                // Users Table
                await run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        full_name TEXT NOT NULL,
                        bio TEXT DEFAULT '',
                        avatar TEXT DEFAULT '',
                        cover_image TEXT DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                // Posts Table
                await run(`
                    CREATE TABLE IF NOT EXISTS posts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        image_url TEXT DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);

                // Comments Table
                await run(`
                    CREATE TABLE IF NOT EXISTS comments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        post_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);

                // Likes Table
                await run(`
                    CREATE TABLE IF NOT EXISTS likes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        post_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, post_id),
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
                    )
                `);

                // Follows Table
                await run(`
                    CREATE TABLE IF NOT EXISTS follows (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        follower_id INTEGER NOT NULL,
                        following_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(follower_id, following_id),
                        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);

                console.log('Database tables initialized successfully.');
                await seedDB();
                resolve();
            } catch (err) {
                console.error('Error initializing database:', err);
                reject(err);
            }
        });
    });
}

// Seed Database with Initial Data if empty
async function seedDB() {
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    if (userCount.count > 0) return; // Already seeded

    console.log('Seeding demo data into database...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // Insert Demo Users
    const user1 = await run(
        `INSERT INTO users (username, email, password_hash, full_name, bio, avatar, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['alex_dev', 'alex@example.com', passwordHash, 'Alex Rivers', 'Full-Stack Developer & Open Source Enthusiast 🚀 | Building the future of web apps.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800']
    );

    const user2 = await run(
        `INSERT INTO users (username, email, password_hash, full_name, bio, avatar, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['sophia_design', 'sophia@example.com', passwordHash, 'Sophia Lin', 'UI/UX Designer ✨ Crafting delight into every pixel. Design system lover.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800']
    );

    const user3 = await run(
        `INSERT INTO users (username, email, password_hash, full_name, bio, avatar, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['marcus_tech', 'marcus@example.com', passwordHash, 'Marcus Vance', 'Tech Founder, AI Explorer & Coffee Lover ☕. Always learning new things.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800']
    );

    const user4 = await run(
        `INSERT INTO users (username, email, password_hash, full_name, bio, avatar, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['emma_travel', 'emma@example.com', passwordHash, 'Emma Watson', 'Travel photographer 📸 Capturing moments around the globe 🌍', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800']
    );

    const u1 = user1.id, u2 = user2.id, u3 = user3.id, u4 = user4.id;

    // Follow relationships
    await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [u1, u2]); // Alex follows Sophia
    await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [u1, u3]); // Alex follows Marcus
    await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [u2, u1]); // Sophia follows Alex
    await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [u2, u4]); // Sophia follows Emma
    await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [u3, u1]); // Marcus follows Alex
    await run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [u4, u2]); // Emma follows Sophia

    // Insert Posts
    const p1 = await run(
        `INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, datetime('now', '-2 hours'))`,
        [u1, 'Just launched my brand new project using Express.js, SQLite, and modern JavaScript! Clean architecture and blazingly fast. What do you think? #coding #webdev #express', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=700']
    );

    const p2 = await run(
        `INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, datetime('now', '-5 hours'))`,
        [u2, 'Designing a new dark mode interface today! Color palette choices make or break user experience. Dark blues vs pure obsidian blacks — which one do you prefer? 🎨💻 #design #uiux #webdesign', 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=700']
    );

    const p3 = await run(
        `INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, datetime('now', '-1 day'))`,
        [u3, 'Morning coffee + reading research papers on LLM agents. The progress in AI-driven pair programming is incredible. Excited for what’s next! ☕🤖 #ai #tech #future', 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=700']
    );

    const p4 = await run(
        `INSERT INTO posts (user_id, content, image_url, created_at) VALUES (?, ?, ?, datetime('now', '-2 days'))`,
        [u4, 'Golden hour in the mountains. Nothing brings peace like nature after a long week of work. 🏔️✨ #nature #photography #travel', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=700']
    );

    // Likes
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u2, p1.id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u3, p1.id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u4, p1.id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u1, p2.id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u3, p2.id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u1, p3.id]);
    await run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [u2, p4.id]);

    // Comments
    await run(
        `INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now', '-1 hour'))`,
        [p1.id, u2, 'Looks awesome Alex! The clean UI and responsiveness look super smooth! 🔥']
    );
    await run(
        `INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now', '-30 minutes'))`,
        [p1.id, u3, 'Great stack choice. SQLite is underrated for speed and simplicity.']
    );
    await run(
        `INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now', '-4 hours'))`,
        [p2.id, u1, 'Team dark blue here! Deep slate grey (#0f172a) reduces eye strain so much better than #000000.']
    );
    await run(
        `INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, datetime('now', '-1 day'))`,
        [p4.id, u2, 'Stunning photo Emma! What lens were you using here?']
    );

    console.log('Seed data successfully created!');
}

module.exports = {
    db,
    run,
    get,
    all,
    initDB
};
