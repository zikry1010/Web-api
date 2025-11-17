from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
import hashlib
import secrets
import json
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)
app.secret_key = 'phone-store-secret-key-2024'



def init_db():
    print("🔧 Starting database initialization...")
    
    db_exists = os.path.exists('phone_store.db')
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    try:
        # Create phones table only if it doesn't exist
        c.execute('''CREATE TABLE IF NOT EXISTS phones
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      brand TEXT NOT NULL,
                      model TEXT NOT NULL,
                      price REAL NOT NULL,
                      storage TEXT NOT NULL,
                      color TEXT NOT NULL,
                      stock_quantity INTEGER NOT NULL,
                      description TEXT,
                      image_url TEXT,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        print("✅ Phones table checked/created")
        
        # Create orders table only if it doesn't exist
        c.execute('''CREATE TABLE IF NOT EXISTS orders
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      phone_id INTEGER,
                      customer_name TEXT NOT NULL,
                      customer_email TEXT NOT NULL,
                      customer_phone TEXT NOT NULL,
                      quantity INTEGER NOT NULL,
                      total_price REAL NOT NULL,
                      status TEXT DEFAULT 'pending',
                      house_number TEXT,
                      street_address TEXT,
                      delivery_city TEXT,
                      delivery_state TEXT,
                      delivery_zip TEXT,
                      delivery_country TEXT,
                      delivery_notes TEXT,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      FOREIGN KEY (phone_id) REFERENCES phones (id))''')
        print("✅ Orders table checked/created")
        
        # Create users table only if it doesn't exist
        c.execute('''CREATE TABLE IF NOT EXISTS users
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      username TEXT UNIQUE NOT NULL,
                      email TEXT UNIQUE NOT NULL,
                      password_hash TEXT NOT NULL,
                      is_admin BOOLEAN DEFAULT FALSE,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        print("✅ Users table checked/created")
        
        # Create sessions table only if it doesn't exist
        c.execute('''CREATE TABLE IF NOT EXISTS sessions
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      user_id INTEGER,
                      session_token TEXT UNIQUE NOT NULL,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      expires_at DATETIME,
                      FOREIGN KEY (user_id) REFERENCES users (id))''')
        print("✅ Sessions table checked/created")
        
        # Only insert sample data if database is newly created
        if not db_exists:
            print("📝 Inserting sample data...")
            
            # Insert sample phones data
            sample_phones = [
                ('iPhone', '15 Pro', 999.99, '128GB', 'Titanium Blue', 50, 
                 'Latest iPhone with A17 Pro chip', 
                 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692846359318'),
                
                ('Samsung', 'Galaxy S24', 799.99, '256GB', 'Phantom Black', 30, 
                 'Samsung flagship with advanced AI features', 
                 'https://images.samsung.com/is/image/samsung/p6pim/levant/2401/gallery/levant-galaxy-s24-s928-sm-s928bzkgmea-539638641'),
                
                ('Google', 'Pixel 8 Pro', 899.99, '128GB', 'Obsidian', 25, 
                 'Google AI-powered smartphone with best-in-class camera', 
                 'https://store.google.com/product/pixel_8_pro?hl=en-US'),
                
                ('OnePlus', '12', 699.99, '256GB', 'Silky Black', 40, 
                 'Flagship killer with Hasselblad camera', 
                 'https://image01.oneplus.net/ebp/202310/13/1-m00-3c-19-cpgm7wujpz-afhveaajxqgac3bw976.png')
            ]
            
            c.executemany('''INSERT INTO phones 
                            (brand, model, price, storage, color, stock_quantity, description, image_url) 
                            VALUES (?,?,?,?,?,?,?,?)''', sample_phones)
            print(f"✅ Added {len(sample_phones)} sample phones")
            
            # Create default admin user
            admin_password = "admin123"
            password_hash = hashlib.sha256(admin_password.encode()).hexdigest()
            c.execute('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                      ('admin', 'admin@phonestore.com', password_hash, True))
            
            # Create a sample regular user
            user_password = hashlib.sha256("user123".encode()).hexdigest()
            c.execute('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)',
                      ('user', 'user@example.com', user_password, False))
            
            # Create sample orders with address information including house number
            c.execute('''INSERT INTO orders (phone_id, customer_name, customer_email, customer_phone, quantity, total_price, status, 
                          house_number, street_address, delivery_city, delivery_state, delivery_zip, delivery_country) 
                         VALUES (1, 'John Doe', 'user@example.com', '123-456-7890', 1, 999.99, 'completed',
                                 '123', 'Main Street', 'New York', 'NY', '10001', 'USA')''')
            c.execute('''INSERT INTO orders (phone_id, customer_name, customer_email, customer_phone, quantity, total_price, status,
                          house_number, street_address, delivery_city, delivery_state, delivery_zip, delivery_country) 
                         VALUES (2, 'Jane Smith', 'admin@phonestore.com', '098-765-4321', 2, 1599.98, 'pending',
                                 '456', 'Oak Avenue', 'Los Angeles', 'CA', '90210', 'USA')''')
            
            print("✅ Admin user created")
            print("=== DEFAULT ADMIN ACCOUNT ===")
            print("Username: admin")
            print("Password: admin123")
            print("=============================")
            
            print("=== SAMPLE USER ACCOUNT ===")
            print("Username: user")
            print("Password: user123")
            print("=============================")
        else:
            print("📊 Using existing database with preserved data")
        
        conn.commit()
        print("🎉 Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Database initialization failed: {str(e)}")
        conn.rollback()
        raise e
    finally:
        conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def authenticate_user():
    token = request.headers.get('Authorization')
    if not token or not token.startswith('Bearer '):
        return None
    
    token = token[7:]  # Remove 'Bearer ' prefix
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute('''SELECT u.id, u.username, u.email, u.is_admin 
                 FROM users u 
                 JOIN sessions s ON u.id = s.user_id 
                 WHERE s.session_token = ? AND s.expires_at > datetime('now')''', (token,))
    user = c.fetchone()
    conn.close()
    
    if user:
        return {'id': user[0], 'username': user[1], 'email': user[2], 'is_admin': bool(user[3])}
    return None

def require_admin():
    user = authenticate_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401
    if not user['is_admin']:
        return jsonify({'error': 'Admin privileges required'}), 403
    return user

# ========== AUTHENTICATION ENDPOINTS ==========

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    password_hash = hash_password(password)
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    try:
        c.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                  (username, email, password_hash))
        user_id = c.lastrowid
        
        session_token = secrets.token_hex(32)
        c.execute('INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))',
                  (user_id, session_token))
        
        conn.commit()
        
        return jsonify({
            'message': 'Registration successful',
            'session_token': session_token,
            'user': {
                'id': user_id, 
                'username': username, 
                'email': email,
                'is_admin': False
            }
        }), 201
        
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 400
    finally:
        conn.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
    
    password_hash = hash_password(password)
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute('SELECT id, username, email, is_admin FROM users WHERE username = ? AND password_hash = ?', 
              (username, password_hash))
    user = c.fetchone()
    
    if user:
        user_id, username, email, is_admin = user
        
        # Clear existing sessions
        c.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
        
        session_token = secrets.token_hex(32)
        c.execute('INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))',
                  (user_id, session_token))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Login successful',
            'session_token': session_token,
            'user': {
                'id': user_id, 
                'username': username, 
                'email': email,
                'is_admin': bool(is_admin)
            }
        }), 200
    else:
        conn.close()
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    token = request.headers.get('Authorization')
    if token and token.startswith('Bearer '):
        token = token[7:]
        conn = sqlite3.connect('phone_store.db')
        c = conn.cursor()
        c.execute('DELETE FROM sessions WHERE session_token = ?', (token,))
        conn.commit()
        conn.close()
    
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/user', methods=['GET'])
def get_current_user():
    user = authenticate_user()
    if user:
        return jsonify({'user': user}), 200
    return jsonify({'error': 'Not authenticated'}), 401

# ========== USER PROFILE UPDATE ENDPOINTS ==========

@app.route('/api/user/profile', methods=['PUT'])
def update_user_profile():
    user = authenticate_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401
    
    data = request.json
    new_username = data.get('username')
    new_email = data.get('email')
    
    if not new_username or not new_email:
        return jsonify({'error': 'Username and email are required'}), 400
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    try:
        # Check if new username or email already exists (excluding current user)
        c.execute('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', 
                  (new_username, new_email, user['id']))
        existing_user = c.fetchone()
        
        if existing_user:
            conn.close()
            return jsonify({'error': 'Username or email already exists'}), 400
        
        # Update user profile
        c.execute('UPDATE users SET username = ?, email = ? WHERE id = ?', 
                  (new_username, new_email, user['id']))
        
        # Update session user data
        c.execute('UPDATE sessions SET expires_at = datetime("now") WHERE user_id = ?', (user['id'],))
        
        # Create new session
        session_token = secrets.token_hex(32)
        c.execute('INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))',
                  (user['id'], session_token))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'session_token': session_token,
            'user': {
                'id': user['id'],
                'username': new_username,
                'email': new_email,
                'is_admin': user['is_admin']
            }
        }), 200
        
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

# ========== USER ORDER HISTORY ENDPOINT ==========

@app.route('/api/user/orders', methods=['GET'])
def get_user_orders():
    user = authenticate_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    if user['is_admin']:
        # Admin sees all orders with full address
        c.execute('''SELECT o.*, p.brand, p.model, p.storage, p.color 
                     FROM orders o 
                     JOIN phones p ON o.phone_id = p.id 
                     ORDER BY o.created_at DESC''')
    else:
        # Regular users see only their orders (filter by username/email) with limited address info
        c.execute('''SELECT o.id, o.phone_id, o.customer_name, o.customer_email, o.customer_phone, 
                            o.quantity, o.total_price, o.status, o.created_at,
                            p.brand, p.model, p.storage, p.color 
                     FROM orders o 
                     JOIN phones p ON o.phone_id = p.id 
                     WHERE o.customer_name = ? OR o.customer_email = ?
                     ORDER BY o.created_at DESC''', 
                  (user['username'], user['username']))
    
    orders = []
    for row in c.fetchall():
        if user['is_admin']:
            # Admin gets full address details
            orders.append({
                'id': row[0],
                'phone_id': row[1],
                'customer_name': row[2],
                'customer_email': row[3],
                'customer_phone': row[4],
                'quantity': row[5],
                'total_price': row[6],
                'status': row[7],
                'house_number': row[8],
                'street_address': row[9],
                'delivery_city': row[10],
                'delivery_state': row[11],
                'delivery_zip': row[12],
                'delivery_country': row[13],
                'delivery_notes': row[14],
                'created_at': row[15],
                'brand': row[16],
                'model': row[17],
                'storage': row[18],
                'color': row[19]
            })
        else:
            # Regular users only get city and state
            orders.append({
                'id': row[0],
                'phone_id': row[1],
                'customer_name': row[2],
                'customer_email': row[3],
                'customer_phone': row[4],
                'quantity': row[5],
                'total_price': row[6],
                'status': row[7],
                'created_at': row[8],
                'brand': row[9],
                'model': row[10],
                'storage': row[11],
                'color': row[12],
                'delivery_city': '***',  # Masked for privacy
                'delivery_state': '***'  # Masked for privacy
            })
    conn.close()
    return jsonify({'orders': orders})

# ========== ADMIN CRUD ENDPOINTS ==========

@app.route('/api/admin/phones', methods=['POST'])
def add_phone():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    data = request.json
    
    required_fields = ['brand', 'model', 'price', 'storage', 'color', 'stock_quantity']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'Field "{field}" is required'}), 400
    
    try:
        price = float(data['price'])
        stock_quantity = int(data['stock_quantity'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid price or stock quantity format'}), 400
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    try:
        c.execute('''INSERT INTO phones 
                    (brand, model, price, storage, color, stock_quantity, description, image_url) 
                    VALUES (?,?,?,?,?,?,?,?)''',
                  (data['brand'], data['model'], price, data['storage'], 
                   data['color'], stock_quantity, 
                   data.get('description', ''), data.get('image_url', '')))
        
        phone_id = c.lastrowid
        conn.commit()
        
        return jsonify({
            'message': 'Phone added successfully',
            'phone_id': phone_id
        }), 201
        
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/admin/phones/<int:phone_id>', methods=['PUT'])
def update_phone(phone_id):
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    data = request.json
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    # Check if phone exists
    c.execute('SELECT id FROM phones WHERE id = ?', (phone_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Phone not found'}), 404
    
    update_fields = []
    update_values = []
    
    allowed_fields = ['brand', 'model', 'price', 'storage', 'color', 'stock_quantity', 'description', 'image_url']
    
    for field in allowed_fields:
        if field in data:
            update_fields.append(f"{field} = ?")
            update_values.append(data[field])
    
    if not update_fields:
        conn.close()
        return jsonify({'error': 'No valid fields to update'}), 400
    
    update_values.append(phone_id)
    
    try:
        query = f"UPDATE phones SET {', '.join(update_fields)} WHERE id = ?"
        c.execute(query, update_values)
        conn.commit()
        
        return jsonify({'message': 'Phone updated successfully'}), 200
        
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/admin/phones/<int:phone_id>', methods=['DELETE'])
def delete_phone(phone_id):
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    # Check if phone exists
    c.execute('SELECT id FROM phones WHERE id = ?', (phone_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Phone not found'}), 404
    
    try:
        c.execute("DELETE FROM phones WHERE id = ?", (phone_id,))
        conn.commit()
        return jsonify({'message': 'Phone deleted successfully'}), 200
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    finally:
        conn.close()

# ========== ADMIN USER MANAGEMENT ENDPOINTS ==========

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute('SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC')
    
    users = []
    for row in c.fetchall():
        users.append({
            'id': row[0],
            'username': row[1],
            'email': row[2],
            'is_admin': bool(row[3]),
            'created_at': row[4]
        })
    conn.close()
    return jsonify({'users': users})

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    # Prevent admin from deleting themselves
    if admin['id'] == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    # Check if user exists
    c.execute('SELECT id FROM users WHERE id = ?', (user_id,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    # Delete user sessions first
    c.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
    # Delete user
    c.execute('DELETE FROM users WHERE id = ?', (user_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User deleted successfully'})

# ========== ADMIN DASHBOARD STATS ==========

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    # Total users
    c.execute('SELECT COUNT(*) FROM users')
    total_users = c.fetchone()[0]
    
    # Total orders
    c.execute('SELECT COUNT(*) FROM orders')
    total_orders = c.fetchone()[0]
    
    # Total revenue
    c.execute('SELECT SUM(total_price) FROM orders WHERE status != "cancelled"')
    total_revenue = c.fetchone()[0] or 0
    
    # Low stock items
    c.execute('SELECT COUNT(*) FROM phones WHERE stock_quantity <= 10 AND stock_quantity > 0')
    low_stock = c.fetchone()[0]
    
    # Out of stock items
    c.execute('SELECT COUNT(*) FROM phones WHERE stock_quantity = 0')
    out_of_stock = c.fetchone()[0]
    
    # Recent orders (last 7 days)
    c.execute('''SELECT COUNT(*) FROM orders 
                 WHERE created_at >= datetime('now', '-7 days')''')
    recent_orders = c.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_users': total_users,
        'total_orders': total_orders,
        'total_revenue': float(total_revenue),
        'low_stock_items': low_stock,
        'out_of_stock_items': out_of_stock,
        'recent_orders_7days': recent_orders
    })

# ========== ADMIN REPORTS ENDPOINTS ==========

@app.route('/api/reports/sales', methods=['GET'])
def get_sales_report():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute('''SELECT p.brand, p.model, COUNT(o.id) as orders_count, 
                        SUM(o.quantity) as total_quantity, SUM(o.total_price) as total_revenue 
                 FROM phones p LEFT JOIN orders o ON p.id = o.phone_id 
                 GROUP BY p.id''')
    
    sales = []
    for row in c.fetchall():
        sales.append({
            'brand': row[0],
            'model': row[1],
            'orders_count': row[2],
            'total_quantity': row[3] or 0,
            'total_revenue': float(row[4] or 0)
        })
    conn.close()
    return jsonify({'sales': sales})

@app.route('/api/reports/stock', methods=['GET'])
def get_stock_report():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute("SELECT id, brand, model, stock_quantity, price FROM phones ORDER BY stock_quantity ASC")
    
    stock = []
    for row in c.fetchall():
        stock.append({
            'id': row[0],
            'brand': row[1],
            'model': row[2],
            'stock_quantity': row[3],
            'price': row[4]
        })
    conn.close()
    return jsonify({'stock': stock})

@app.route('/api/reports/orders', methods=['GET'])
def get_orders_report():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute('''SELECT o.*, p.brand, p.model, p.storage, p.color 
                 FROM orders o 
                 JOIN phones p ON o.phone_id = p.id 
                 ORDER BY o.created_at DESC''')
    
    orders = []
    for row in c.fetchall():
        orders.append({
            'id': row[0],
            'phone_id': row[1],
            'customer_name': row[2],
            'customer_email': row[3],
            'customer_phone': row[4],
            'quantity': row[5],
            'total_price': row[6],
            'status': row[7],
            'house_number': row[8],
            'street_address': row[9],
            'delivery_city': row[10],
            'delivery_state': row[11],
            'delivery_zip': row[12],
            'delivery_country': row[13],
            'delivery_notes': row[14],
            'created_at': row[15],
            'brand': row[16],
            'model': row[17],
            'storage': row[18],
            'color': row[19]
        })
    conn.close()
    return jsonify({'orders': orders})

# ========== ORDER STATUS MANAGEMENT ==========

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    data = request.json
    new_status = data.get('status')
    
    if not new_status:
        return jsonify({'error': 'Status is required'}), 400
    
    valid_statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
    if new_status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    # Check if order exists
    c.execute('SELECT id FROM orders WHERE id = ?', (order_id,))
    order = c.fetchone()
    
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found'}), 404
    
    # Update order status
    c.execute('UPDATE orders SET status = ? WHERE id = ?', (new_status, order_id))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Order status updated successfully'})

@app.route('/api/orders/<int:order_id>', methods=['DELETE'])
def delete_order(order_id):
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    # Check if order exists
    c.execute('SELECT id FROM orders WHERE id = ?', (order_id,))
    order = c.fetchone()
    
    if not order:
        conn.close()
        return jsonify({'error': 'Order not found'}), 404
    
    # Delete the order
    c.execute('DELETE FROM orders WHERE id = ?', (order_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Order deleted successfully'})

# ========== PUBLIC ENDPOINTS ==========

@app.route('/api/phones', methods=['GET'])
def get_phones():
    try:
        conn = sqlite3.connect('phone_store.db')
        c = conn.cursor()
        c.execute("SELECT * FROM phones ORDER BY id DESC")
        phones = []
        for row in c.fetchall():
            phones.append({
                'id': row[0],
                'brand': row[1],
                'model': row[2],
                'price': row[3],
                'storage': row[4],
                'color': row[5],
                'stock_quantity': row[6],
                'description': row[7],
                'image_url': row[8]
            })
        conn.close()
        return jsonify({'phones': phones})
    except Exception as e:
        return jsonify({'error': f'Failed to load phones: {str(e)}'}), 500

@app.route('/api/phones/<int:phone_id>', methods=['GET'])
def get_phone(phone_id):
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute("SELECT * FROM phones WHERE id=?", (phone_id,))
    phone = c.fetchone()
    conn.close()
    
    if phone:
        return jsonify({
            'id': phone[0],
            'brand': phone[1],
            'model': phone[2],
            'price': phone[3],
            'storage': phone[4],
            'color': phone[5],
            'stock_quantity': phone[6],
            'description': phone[7],
            'image_url': phone[8]
        })
    return jsonify({'error': 'Phone not found'}), 404

@app.route('/api/orders', methods=['POST'])
def add_order():
    user = authenticate_user()
    if not user:
        return jsonify({'error': 'Please login to place orders'}), 401
    
    data = request.json
    
    required_fields = ['phone_id', 'customer_name', 'customer_email', 'customer_phone', 'quantity',
                      'house_number', 'street_address', 'delivery_city', 'delivery_state', 'delivery_zip', 'delivery_country']
    
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'Field "{field}" is required'}), 400
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    
    c.execute("SELECT price, stock_quantity FROM phones WHERE id=?", (data['phone_id'],))
    phone = c.fetchone()
    if not phone:
        return jsonify({'error': 'Phone not found'}), 404
    
    price, stock = phone
    quantity = data['quantity']
    
    if stock < quantity:
        return jsonify({'error': 'Insufficient stock'}), 400
    
    total_price = price * quantity
    
    c.execute('''INSERT INTO orders 
                (phone_id, customer_name, customer_email, customer_phone, quantity, total_price,
                 house_number, street_address, delivery_city, delivery_state, delivery_zip, delivery_country, delivery_notes) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
              (data['phone_id'], data['customer_name'], data['customer_email'], data['customer_phone'], 
               quantity, total_price, data['house_number'], data['street_address'], data['delivery_city'], 
               data['delivery_state'], data['delivery_zip'], data['delivery_country'], data.get('delivery_notes', '')))
    
    c.execute("UPDATE phones SET stock_quantity = stock_quantity - ? WHERE id = ?", (quantity, data['phone_id']))
    
    order_id = c.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        'message': 'Order placed successfully',
        'order_id': order_id
    }), 201

@app.route('/api/orders', methods=['GET'])
def get_orders():
    admin = require_admin()
    if isinstance(admin, tuple):
        return admin
    
    conn = sqlite3.connect('phone_store.db')
    c = conn.cursor()
    c.execute('''SELECT o.*, p.brand, p.model, p.storage, p.color 
                 FROM orders o 
                 JOIN phones p ON o.phone_id = p.id 
                 ORDER BY o.created_at DESC''')
    
    orders = []
    for row in c.fetchall():
        orders.append({
            'id': row[0],
            'phone_id': row[1],
            'customer_name': row[2],
            'customer_email': row[3],
            'customer_phone': row[4],
            'quantity': row[5],
            'total_price': row[6],
            'status': row[7],
            'house_number': row[8],
            'street_address': row[9],
            'delivery_city': row[10],
            'delivery_state': row[11],
            'delivery_zip': row[12],
            'delivery_country': row[13],
            'delivery_notes': row[14],
            'created_at': row[15],
            'brand': row[16],
            'model': row[17],
            'storage': row[18],
            'color': row[19]
        })
    conn.close()
    return jsonify({'orders': orders})

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Server is running'})

# Database check endpoint
@app.route('/api/db-check', methods=['GET'])
def db_check():
    try:
        conn = sqlite3.connect('phone_store.db')
        c = conn.cursor()
        
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='phones'")
        phones_table_exists = c.fetchone() is not None
        
        if phones_table_exists:
            c.execute("SELECT COUNT(*) FROM phones")
            phone_count = c.fetchone()[0]
        else:
            phone_count = 0
            
        conn.close()
        
        return jsonify({
            'phones_table_exists': phones_table_exists,
            'phone_count': phone_count,
            'database_file': 'phone_store.db',
            'file_exists': os.path.exists('phone_store.db')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting PhoneTech Server...")
    print("📊 Initializing database...")
    
    try:
        init_db()
        print("\n✅ PhoneTech Server running on http://localhost:5000")
        print("📱 Frontend: Open index.html in your browser")
        print("🔑 Admin Login: username='admin', password='admin123'")
        print("👤 User Login: username='user', password='user123'")
        print("🔧 Health Check: http://localhost:5000/api/health")
        print("📊 DB Check: http://localhost:5000/api/db-check")
        print("===============================================\n")
        app.run(debug=True, port=5000)
    except Exception as e:
        print(f"❌ Failed to start server: {str(e)}")
        
        # ------------------------------
# UPDATE ORDER STATUS (ADMIN ONLY)
# ------------------------------
@app.route('/api/orders/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    # Check if admin session exists
    session_token = request.headers.get('Authorization', '').replace('Bearer ', '').strip()
    if not session_token:
        return jsonify({"error": "Missing Authorization token"}), 401

    # Verify session belongs to an admin
    cursor.execute("""
        SELECT users.is_admin
        FROM sessions
        JOIN users ON sessions.user_id = users.id
        WHERE sessions.session_token = ?
    """, (session_token,))
    session_data = cursor.fetchone()

    if not session_data or session_data[0] == 0:
        return jsonify({"error": "Admin access required"}), 403

    # Get new status from JSON
    data = request.json
    new_status = data.get('status')

    if not new_status:
        return jsonify({"error": "Missing 'status' field"}), 400

    # Update order status in DB
    cursor.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    conn.commit()

    return jsonify({"message": "Order updated successfully", "order_id": order_id, "status": new_status})