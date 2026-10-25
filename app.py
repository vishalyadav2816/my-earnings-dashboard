import sqlite3
import os
from datetime import datetime, date
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'freelance-earnings-super-secret-key-2026')
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'earnings.db')

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                title TEXT DEFAULT 'Freelance Developer & Designer',
                currency TEXT DEFAULT '$',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Earnings / Projects table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS earnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                client TEXT NOT NULL,
                income_type TEXT NOT NULL CHECK(income_type IN ('project', 'freelance')),
                platform TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue')),
                date TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        # Leads / Pitch CRM table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                client_name TEXT NOT NULL,
                company TEXT,
                contact_info TEXT,
                channel TEXT DEFAULT 'Direct',
                call_status TEXT DEFAULT 'new',
                call_date TEXT,
                estimated_fee REAL DEFAULT 0,
                pitch_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        conn.commit()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access your dashboard.', 'info')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM users WHERE LOWER(email) = ?', (email,))
            user = cursor.fetchone()
            
            if user and check_password_hash(user['password_hash'], password):
                session['user_id'] = user['id']
                session['user_name'] = user['full_name']
                session['user_email'] = user['email']
                session['user_title'] = user['title']
                session['currency'] = user['currency']
                flash(f"Welcome back, {user['full_name']}!", 'success')
                return redirect(url_for('dashboard'))
            else:
                flash('Invalid email or password. Please try again.', 'danger')
                
    return render_template('login.html')

@app.route('/register', methods=['POST'])
def register():
    full_name = request.form.get('full_name', '').strip()
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    title = request.form.get('title', 'Freelancer / Contractor').strip()
    currency = request.form.get('currency', '$').strip()
    
    if not full_name or not email or not password:
        flash('All fields marked * are required.', 'danger')
        return redirect(url_for('login'))
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM users WHERE LOWER(email) = ?', (email,))
        if cursor.fetchone():
            flash('An account with this email already exists. Please log in.', 'warning')
            return redirect(url_for('login'))
            
        hashed = generate_password_hash(password)
        cursor.execute(
            'INSERT INTO users (email, password_hash, full_name, title, currency) VALUES (?, ?, ?, ?, ?)',
            (email, hashed, full_name, title, currency)
        )
        conn.commit()
        
        # Log user in directly
        user_id = cursor.lastrowid
        session['user_id'] = user_id
        session['user_name'] = full_name
        session['user_email'] = email
        session['user_title'] = title
        session['currency'] = currency
        
        flash('Account created successfully! Welcome to your Earnings Dashboard.', 'success')
        return redirect(url_for('dashboard'))

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM earnings WHERE user_id = ? ORDER BY date DESC, id DESC', (user_id,))
        records = [dict(row) for row in cursor.fetchall()]
        
        # Calculate summary statistics
        total_earned = sum(r['amount'] for r in records if r['status'] == 'paid')
        pending_amount = sum(r['amount'] for r in records if r['status'] == 'pending')
        
        project_earned = sum(r['amount'] for r in records if r['income_type'] == 'project' and r['status'] == 'paid')
        freelance_earned = sum(r['amount'] for r in records if r['income_type'] == 'freelance' and r['status'] == 'paid')
        
        project_pending = sum(r['amount'] for r in records if r['income_type'] == 'project' and r['status'] == 'pending')
        freelance_pending = sum(r['amount'] for r in records if r['income_type'] == 'freelance' and r['status'] == 'pending')
        
        # Counts
        project_count = len([r for r in records if r['income_type'] == 'project'])
        freelance_count = len([r for r in records if r['income_type'] == 'freelance'])
        
        # This Month's earnings
        current_year_month = datetime.now().strftime('%Y-%m')
        this_month_earned = sum(
            r['amount'] for r in records 
            if r['status'] == 'paid' and r['date'].startswith(current_year_month)
        )
        
        stats = {
            'total_earned': total_earned,
            'pending_amount': pending_amount,
            'project_earned': project_earned,
            'freelance_earned': freelance_earned,
            'project_pending': project_pending,
            'freelance_pending': freelance_pending,
            'project_count': project_count,
            'freelance_count': freelance_count,
            'this_month_earned': this_month_earned,
            'total_entries': len(records)
        }
        
    return render_template('dashboard.html', records=records, stats=stats)

# API Endpoints for dynamic operations
@app.route('/api/earnings', methods=['GET'])
@login_required
def api_get_earnings():
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM earnings WHERE user_id = ? ORDER BY date DESC, id DESC', (user_id,))
        records = [dict(row) for row in cursor.fetchall()]
    return jsonify({'success': True, 'records': records})

@app.route('/api/earnings/add', methods=['POST'])
@login_required
def api_add_earning():
    user_id = session['user_id']
    data = request.get_json() or request.form
    
    title = data.get('title', '').strip()
    client = data.get('client', '').strip()
    income_type = data.get('income_type', 'project')
    platform = data.get('platform', 'Direct Client').strip()
    try:
        amount = float(data.get('amount', 0))
    except (ValueError, TypeError):
        amount = 0.0
    status = data.get('status', 'paid')
    date_val = data.get('date', datetime.now().strftime('%Y-%m-%d')).strip()
    notes = data.get('notes', '').strip()
    
    if not title or not client or amount <= 0:
        return jsonify({'success': False, 'message': 'Please provide title, client, and a valid amount.'}), 400
        
    if income_type not in ('project', 'freelance'):
        income_type = 'project'
    if status not in ('paid', 'pending', 'overdue'):
        status = 'paid'
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO earnings (user_id, title, client, income_type, platform, amount, status, date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, title, client, income_type, platform, amount, status, date_val, notes))
        conn.commit()
        new_id = cursor.lastrowid
        
        cursor.execute('SELECT * FROM earnings WHERE id = ?', (new_id,))
        new_record = dict(cursor.fetchone())
        
    return jsonify({'success': True, 'message': 'Entry added successfully!', 'record': new_record})

@app.route('/api/earnings/<int:record_id>/status', methods=['POST'])
@login_required
def api_update_status(record_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ('paid', 'pending', 'overdue'):
        return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE earnings SET status = ? WHERE id = ? AND user_id = ?', (new_status, record_id, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'message': 'Record not found'}), 404
            
    return jsonify({'success': True, 'status': new_status})

@app.route('/api/earnings/<int:record_id>/delete', methods=['POST', 'DELETE'])
@login_required
def api_delete_earning(record_id):
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM earnings WHERE id = ? AND user_id = ?', (record_id, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'message': 'Record not found'}), 404
            
    return jsonify({'success': True, 'message': 'Entry deleted'})

@app.route('/api/analytics', methods=['GET'])
@login_required
def api_analytics():
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM earnings WHERE user_id = ? ORDER BY date ASC', (user_id,))
        records = [dict(row) for row in cursor.fetchall()]
        
    # Group by Month
    monthly_data = {}
    platform_data = {}
    type_data = {'project': 0.0, 'freelance': 0.0}
    status_data = {'paid': 0.0, 'pending': 0.0, 'overdue': 0.0}
    
    for r in records:
        # Month string YYYY-MM
        m = r['date'][:7] if len(r['date']) >= 7 else 'Unknown'
        if m not in monthly_data:
            monthly_data[m] = {'project': 0.0, 'freelance': 0.0, 'total': 0.0}
            
        amt = r['amount']
        if r['status'] == 'paid':
            monthly_data[m][r['income_type']] += amt
            monthly_data[m]['total'] += amt
            type_data[r['income_type']] += amt
            
        status_data[r['status']] = status_data.get(r['status'], 0.0) + amt
        platform_data[r['platform']] = platform_data.get(r['platform'], 0.0) + amt

    # Sort months
    sorted_months = sorted(monthly_data.keys())
    # Keep last 6 or 12 months
    recent_months = sorted_months[-6:] if len(sorted_months) > 6 else sorted_months
    
    chart_months = []
    chart_project = []
    chart_freelance = []
    for m in recent_months:
        # Format month like 'Oct 2026'
        try:
            dt = datetime.strptime(m, '%Y-%m')
            label = dt.strftime('%b %Y')
        except Exception:
            label = m
        chart_months.append(label)
        chart_project.append(round(monthly_data[m]['project'], 2))
        chart_freelance.append(round(monthly_data[m]['freelance'], 2))
        
    return jsonify({
        'success': True,
        'monthly': {
            'labels': chart_months,
            'project': chart_project,
            'freelance': chart_freelance
        },
        'platforms': {
            'labels': list(platform_data.keys()),
            'values': [round(v, 2) for v in platform_data.values()]
        },
        'types': {
            'project': round(type_data['project'], 2),
            'freelance': round(type_data['freelance'], 2)
        },
        'statuses': {
            'labels': ['Paid', 'Pending', 'Overdue'],
            'values': [
                round(status_data.get('paid', 0), 2),
                round(status_data.get('pending', 0), 2),
                round(status_data.get('overdue', 0), 2)
            ]
        }
    })

# ==========================================
# Client Pitching & Outreach CRM Routes
# ==========================================
@app.route('/pitches')
@login_required
def pitches():
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM leads WHERE user_id = ? ORDER BY id DESC', (user_id,))
        leads = [dict(row) for row in cursor.fetchall()]
        
        total_leads = len(leads)
        pipeline_val = sum(l['estimated_fee'] for l in leads if l['call_status'] not in ('lost',))
        calls_scheduled = len([l for l in leads if l['call_status'] == 'call_scheduled'])
        won_leads = len([l for l in leads if l['call_status'] == 'won'])
        won_val = sum(l['estimated_fee'] for l in leads if l['call_status'] == 'won')
        conversion_rate = round((won_leads / total_leads * 100), 1) if total_leads > 0 else 0.0

        pitch_stats = {
            'total_leads': total_leads,
            'pipeline_val': pipeline_val,
            'calls_scheduled': calls_scheduled,
            'won_leads': won_leads,
            'won_val': won_val,
            'conversion_rate': conversion_rate
        }
        
    return render_template('pitches.html', leads=leads, stats=pitch_stats)

@app.route('/api/leads/add', methods=['POST'])
@login_required
def api_add_lead():
    user_id = session['user_id']
    data = request.get_json() or request.form
    
    client_name = data.get('client_name', '').strip()
    company = data.get('company', '').strip()
    contact_info = data.get('contact_info', '').strip()
    channel = data.get('channel', 'Direct Email').strip()
    call_status = data.get('call_status', 'new').strip()
    call_date = data.get('call_date', '').strip()
    try:
        estimated_fee = float(data.get('estimated_fee', 0))
    except (ValueError, TypeError):
        estimated_fee = 0.0
    pitch_notes = data.get('pitch_notes', '').strip()
    
    if not client_name:
        return jsonify({'success': False, 'message': 'Client or prospect name is required.'}), 400
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO leads (user_id, client_name, company, contact_info, channel, call_status, call_date, estimated_fee, pitch_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, client_name, company, contact_info, channel, call_status, call_date, estimated_fee, pitch_notes))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.execute('SELECT * FROM leads WHERE id = ?', (new_id,))
        new_lead = dict(cursor.fetchone())
        
    return jsonify({'success': True, 'message': 'Prospect pitch saved successfully!', 'lead': new_lead})

@app.route('/api/leads/<int:lead_id>/status', methods=['POST'])
@login_required
def api_update_lead_status(lead_id):
    user_id = session['user_id']
    data = request.get_json() or {}
    new_status = data.get('status', '').strip()
    
    valid_statuses = ('new', 'contacted', 'call_scheduled', 'call_done', 'proposal_sent', 'won', 'lost')
    if new_status not in valid_statuses:
        return jsonify({'success': False, 'message': 'Invalid lead status'}), 400
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('UPDATE leads SET call_status = ? WHERE id = ? AND user_id = ?', (new_status, lead_id, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'message': 'Lead not found'}), 404
            
    return jsonify({'success': True, 'status': new_status})

@app.route('/api/leads/<int:lead_id>/convert', methods=['POST'])
@login_required
def api_convert_lead(lead_id):
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM leads WHERE id = ? AND user_id = ?', (lead_id, user_id))
        lead = cursor.fetchone()
        if not lead:
            return jsonify({'success': False, 'message': 'Lead not found'}), 404
            
        lead = dict(lead)
        # Add to earnings as an active project
        title = f"Project for {lead['client_name']}"
        if lead['company']:
            title = f"{lead['company']} - Client Project"
        client = lead['company'] or lead['client_name']
        amount = lead['estimated_fee'] if lead['estimated_fee'] > 0 else 1000.0
        today_str = datetime.now().strftime('%Y-%m-%d')
        notes = f"Converted from Pitch CRM. Notes: {lead['pitch_notes'] or ''}"
        
        cursor.execute('''
            INSERT INTO earnings (user_id, title, client, income_type, platform, amount, status, date, notes)
            VALUES (?, ?, ?, 'project', ?, ?, 'pending', ?, ?)
        ''', (user_id, title, client, lead['channel'], amount, today_str, notes))
        
        # Mark lead as won
        cursor.execute("UPDATE leads SET call_status = 'won' WHERE id = ?", (lead_id,))
        conn.commit()
        
    return jsonify({'success': True, 'message': 'Lead converted to active project earning!'})

@app.route('/api/leads/<int:lead_id>/delete', methods=['POST', 'DELETE'])
@login_required
def api_delete_lead(lead_id):
    user_id = session['user_id']
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM leads WHERE id = ? AND user_id = ?', (lead_id, user_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({'success': False, 'message': 'Lead not found'}), 404
            
    return jsonify({'success': True, 'message': 'Lead deleted'})

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    print(f"Freelancer & Project Earnings Dashboard running on port {port}")
    app.run(debug=True, port=port, host='0.0.0.0')

