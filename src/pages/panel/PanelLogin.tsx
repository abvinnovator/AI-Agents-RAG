import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert,
} from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { login } from '../../store/authStore';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useNavigate } from 'react-router-dom';

const PanelLogin: React.FC = () => {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // If already logged in, redirect
  useEffect(() => {
    if (auth.session) {
      navigate('/support-panel/dashboard', { replace: true });
    }
  }, [auth.session, navigate]);

  if (auth.session) return null;

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) return;
    const result = login(username.trim(), password.trim());
    if (result.success) {
      navigate('/support-panel/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#f8f9fa',
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <CloudIcon sx={{ color: '#1a73e8', fontSize: 28 }} />
            <SupportAgentIcon sx={{ color: '#1a73e8', fontSize: 28 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 400 }}>
            Support Panel
          </Typography>
          <Typography variant="body2" sx={{ color: '#5f6368', mt: 0.5 }}>
            CloudOps AI Simulator
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Username"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(''); }}
            fullWidth
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            fullWidth
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleLogin}
            disabled={!username.trim() || !password.trim()}
            sx={{ mt: 1 }}
          >
            Sign In
          </Button>
        </Box>

        <Typography variant="caption" sx={{ display: 'block', mt: 2, textAlign: 'center', color: '#80868b' }}>
          Super Admin or Support Engineer credentials required
        </Typography>
      </Paper>
    </Box>
  );
};

export default PanelLogin;
