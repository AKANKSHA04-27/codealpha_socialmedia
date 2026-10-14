import urllib.request
import json

def req(url, method='GET', data=None, headers={}):
    body = json.dumps(data).encode('utf-8') if data else None
    if data:
        headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode('utf-8'))

def test_api():
    print("--- 1. Fetching Feed Posts ---")
    posts = req('http://localhost:5000/api/posts')
    print(f"Initial Feed Posts Count: {len(posts)}")
    print(f"Post 1 Author: @{posts[0]['username']}, Content: {posts[0]['content'][:50]}...")

    print("\n--- 2. User Authentication (Login) ---")
    login_res = req('http://localhost:5000/api/auth/login', 'POST', {'usernameOrEmail': 'alex_dev', 'password': 'password123'})
    token = login_res['token']
    print(f"Logged in successfully. User: @{login_res['user']['username']}")
    headers = {'Authorization': f'Bearer {token}'}

    print("\n--- 3. Creating a Post ---")
    new_post = req('http://localhost:5000/api/posts', 'POST', {'content': 'Testing Pulse Social API integration! #coding #express #sqlite', 'image_url': ''}, headers)
    print(f"New Post Created! ID: {new_post['post']['id']}, Content: {new_post['post']['content']}")

    print("\n--- 4. Liking Post #2 ---")
    like_res = req('http://localhost:5000/api/posts/2/like', 'POST', None, headers)
    print(f"Like Status for Post #2: Is Liked = {like_res['is_liked']}, Total Likes = {like_res['likes_count']}")

    print("\n--- 5. Adding Comment on Post #2 ---")
    comment_res = req('http://localhost:5000/api/comments/post/2', 'POST', {'content': 'Awesome design choices!'}, headers)
    print(f"Comment added! ID: {comment_res['comment']['id']}, Content: {comment_res['comment']['content']}")

    print("\n--- 6. Following User #4 (emma_travel) ---")
    follow_res = req('http://localhost:5000/api/users/4/follow', 'POST', None, headers)
    print(f"Follow Status: {follow_res['message']}, Followers Count: {follow_res['followers_count']}")

    print("\n--- 7. Fetching Updated Profile for @alex_dev ---")
    profile = req('http://localhost:5000/api/users/profile/alex_dev', 'GET', None, headers)
    print(f"Profile: {profile['full_name']} (@{profile['username']})")
    print(f"Stats -> Posts: {profile['posts_count']}, Followers: {profile['followers_count']}, Following: {profile['following_count']}")

if __name__ == '__main__':
    test_api()
