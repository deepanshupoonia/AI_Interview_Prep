import { useState } from 'react';
import { apiUrl, readApiResponse } from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await readApiResponse(res);
      
      if (res.ok) {
        localStorage.setItem('token', data.token);
        window.location.href = '/dashboard'; 
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Cannot connect to server');
    }
  };

  return (
    <div className="auth-container">
      <div className="card">
        <p className="eyebrow">Interview Prep Workspace</p>
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue practicing with focused interview sessions.</p>
        {error && <div className="error-text">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input 
              id="login-email"
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <label htmlFor="login-password">Password</label>
            <input 
              id="login-password"
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            <button type="submit" className="btn">Sign In</button>
          </div>
        </form>
        <div className="auth-footer">
          Don't have an account? <a href="/register">Create one here</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
