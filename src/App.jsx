import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';

function App() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState('login');

  if (isAuthenticated) {
    return <ChatPage />;
  }

  if (page === 'signup') {
    return <SignupPage onSwitchToLogin={() => setPage('login')} />;
  }

  return <LoginPage onSwitchToSignup={() => setPage('signup')} />;
}

export default App;
