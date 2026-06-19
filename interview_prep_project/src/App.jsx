import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SectionPage from './pages/SectionPage';
import InterviewHistory from './pages/InterviewHistory';
import WeaknessAnalytics from './pages/WeaknessAnalytics';
import { apiUrl, readApiResponse } from './api';
import './App.css';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');
  const [profile, setProfile] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: ''
  });
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchProfile = async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/profile'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await readApiResponse(res);

        if (res.ok) {
          setProfile(data);
          setAccountForm((current) => ({
            ...current,
            name: data.name || '',
            email: data.email || ''
          }));
        }
      } catch {
        setAccountError('Unable to load account details.');
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  const updateAccount = async (event) => {
    event.preventDefault();
    setAccountMessage('');
    setAccountError('');

    try {
      const res = await fetch(apiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(accountForm)
      });
      const data = await readApiResponse(res);

      if (!res.ok) {
        setAccountError(data.message || 'Unable to update account.');
        return;
      }

      setProfile(data);
      setAccountForm({
        name: data.name || '',
        email: data.email || '',
        currentPassword: '',
        newPassword: ''
      });
      setAccountMessage('Account updated.');
    } catch {
      setAccountError('Cannot connect to server.');
    }
  };

  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-brand">
            <h2>AI Interview Prep</h2>
          </div>
          <div className="nav-links">
            {!isAuthenticated && <a href="/login">Login</a>}
            {!isAuthenticated && <a href="/register">Register</a>}
            {isAuthenticated && (
              <>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/history">History</Link>
                <Link to="/analytics">Analytics</Link>
                <span className="student-name">{profile?.name || 'Student'}</span>
                <button className="btn btn-secondary" type="button" onClick={() => setAccountOpen((open) => !open)}>
                  Account
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                  }}
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </nav>

        {isAuthenticated && accountOpen && (
          <div className="account-panel" role="dialog" aria-label="Account settings">
            <form onSubmit={updateAccount}>
              <div className="account-panel-header">
                <div>
                  <p className="eyebrow">Student Profile</p>
                  <h2>Account Settings</h2>
                </div>
                <button className="icon-button" type="button" onClick={() => setAccountOpen(false)} aria-label="Close account settings">
                  X
                </button>
              </div>

              {accountError && <div className="error-text">{accountError}</div>}
              {accountMessage && <div className="success-text">{accountMessage}</div>}

              <div className="form-group">
                <label htmlFor="account-name">Student name</label>
                <input
                  id="account-name"
                  value={accountForm.name}
                  onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
                />
                <label htmlFor="account-email">Email address</label>
                <input
                  id="account-email"
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
                />
                <label htmlFor="account-current-password">Current password</label>
                <input
                  id="account-current-password"
                  type="password"
                  placeholder="Required for email or password changes"
                  value={accountForm.currentPassword}
                  onChange={(event) => setAccountForm({ ...accountForm, currentPassword: event.target.value })}
                />
                <label htmlFor="account-new-password">New password</label>
                <input
                  id="account-new-password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={accountForm.newPassword}
                  onChange={(event) => setAccountForm({ ...accountForm, newPassword: event.target.value })}
                />
                <button className="btn" type="submit">Save Account</button>
              </div>
            </form>
          </div>
        )}
        
        <div className={isAuthenticated ? 'app-layout' : 'app-layout guest-layout'}>
          <main>
            <Routes>
              <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/dashboard" 
                element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
              />
              <Route
                path="/sections/:slug"
                element={isAuthenticated ? <SectionPage /> : <Navigate to="/login" />}
              />
              <Route
                path="/history"
                element={isAuthenticated ? <InterviewHistory /> : <Navigate to="/login" />}
              />
              <Route
                path="/analytics"
                element={isAuthenticated ? <WeaknessAnalytics /> : <Navigate to="/login" />}
              />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
