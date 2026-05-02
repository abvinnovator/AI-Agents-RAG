import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel,
  Select, MenuItem, IconButton, Chip, Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useAuthStore } from '../../hooks/useAuthStore';
import {
  createSupportUser, updateSupportUser, deleteSupportUser,
  SUPPORT_ROLES, getRoleLabel,
  type SupportRole,
} from '../../store/authStore';
import { RoleBadge } from '../../components/support/StatusBadge';

const TeamManagement: React.FC = () => {
  const auth = useAuthStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<SupportRole>('L1');

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setDisplayName('');
    setRole('L1');
    setError('');
  };

  const handleCreate = () => {
    if (!username.trim() || !password.trim() || !displayName.trim()) return;
    const result = createSupportUser(username.trim(), password.trim(), displayName.trim(), role);
    if (result.success) {
      setDialogOpen(false);
      resetForm();
    } else {
      setError(result.error || 'Failed to create user');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">Team Management</Typography>
          <Typography variant="subtitle1">Create and manage support engineers</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { resetForm(); setDialogOpen(true); }}
        >
          Add Support Engineer
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>AI Agent</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {auth.supportUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No support engineers yet. Click "Add Support Engineer" to create one.
                </TableCell>
              </TableRow>
            )}
            {auth.supportUsers.map(user => (
              <TableRow key={user.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{user.username}</TableCell>
                <TableCell>{user.displayName}</TableCell>
                <TableCell><RoleBadge role={user.role} /></TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SupportAgentIcon sx={{ fontSize: 16, color: user.agentConfigured ? '#1e8e3e' : '#80868b' }} />
                    <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                      {user.agentName}
                    </Typography>
                    {!user.agentConfigured && (
                      <Chip label="default" size="small" sx={{ fontSize: '0.625rem', height: 18 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Switch
                    size="small"
                    checked={user.active}
                    onChange={e => updateSupportUser(user.id, { active: e.target.checked })}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => deleteSupportUser(user.id)} sx={{ color: '#d93025' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Support Engineer</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Typography variant="body2" sx={{ color: '#d93025' }}>{error}</Typography>
            )}
            <TextField
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth
              helperText="Used for login"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
            />
            <TextField
              label="Display Name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              fullWidth
              placeholder="e.g., Rahul Sharma"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={role} label="Role" onChange={e => setRole(e.target.value as SupportRole)}>
                {SUPPORT_ROLES.map(r => (
                  <MenuItem key={r} value={r}>{getRoleLabel(r)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ color: '#5f6368' }}>
              Default AI agent name will be set to the username. The engineer can customize it on first login.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!username.trim() || !password.trim() || !displayName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamManagement;
