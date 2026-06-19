import { useState } from 'react';
import { apiUrl, readApiResponse } from '../api';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await readApiResponse(res);
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        window.location.href = '/dashboard';
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Cannot connect to server');
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <p className="eyebrow">Start Practicing</p>
        <h2>Create Account</h2>
        <p className="auth-subtitle">Build your profile and track mock interview progress over time.</p>
        {error && <div className="error-text">{error}</div>}
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="register-name">Full name</label>
            <input 
              id="register-name"
              type="text" 
              placeholder="Full Name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
            />
            <label htmlFor="register-email">Email address</label>
            <input 
              id="register-email"
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <label htmlFor="register-password">Password</label>
            <input 
              id="register-password"
              type="password" 
              placeholder="Create Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            <button type="submit" className="btn">Sign Up</button>
          </div>
        </form>
        <div className="auth-footer">
          Already have an account? <a href="/login">Login here</a>
        </div>
      </div>
    </div>
  );
};

export default Register;
