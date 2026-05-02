import React, { useState } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Button,
} from '@mui/material';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import PendingIcon from '@mui/icons-material/Pending';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useSupportStore } from '../../hooks/useSupportStore';
import { getAllSupportUsers, setAgentName, findSupportUser } from '../../store/authStore';
import { getTicketStats, getTicketsForRole, getTicketsForUser } from '../../store/supportStore';
import { SeverityBadge, StatusBadge } from '../../components/support/StatusBadge';

const AdminDashboard: React.FC = () => {
  const auth = useAuthStore();
  const supportState = useSupportStore();
  const session = auth.session!;

  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState(session.agentName);

  // Check if this user needs to configure agent name
  const isEngineer = session.role !== 'super_admin';
  const currentUser = isEngineer ? findSupportUser(session.userId) : null;
  const needsAgentSetup = isEngineer && currentUser && !currentUser.agentConfigured;

  const stats = getTicketStats();
  const allUsers = getAllSupportUsers();

  const handleSetAgentName = () => {
    if (!newAgentName.trim()) return;
    setAgentName(session.userId, newAgentName.trim());
    setAgentDialogOpen(false);
  };

  // For engineers — show their assigned tickets
  const myTickets = isEngineer
    ? getTicketsForUser(session.userId).length > 0
      ? getTicketsForUser(session.userId)
      : getTicketsForRole(session.role)
    : [];

  const statCards = session.role === 'super_admin'
    ? [
        { label: 'Total Cases', value: stats.total, icon: <ConfirmationNumberIcon />, color: '#1a73e8' },
        { label: 'Awaiting Approval', value: stats.waitingApproval, icon: <PendingIcon />, color: '#f9ab00' },
        { label: 'In Progress', value: stats.inProgress, icon: <WarningIcon />, color: '#e37400' },
        { label: 'Resolved', value: stats.resolved + stats.closed, icon: <CheckCircleIcon />, color: '#1e8e3e' },
        { label: 'Support Engineers', value: allUsers.length, icon: <PeopleIcon />, color: '#7b1fa2' },
        { label: 'Escalated', value: stats.escalated, icon: <WarningIcon />, color: '#c5221f' },
      ]
    : [
        { label: 'My Assigned', value: myTickets.length, icon: <AssignmentIcon />, color: '#1a73e8' },
        { label: 'In Progress', value: myTickets.filter(t => t.status === 'in_progress').length, icon: <WarningIcon />, color: '#e37400' },
        { label: 'Resolved', value: getTicketsForUser(session.userId).filter(t => t.status === 'resolved').length, icon: <CheckCircleIcon />, color: '#1e8e3e' },
      ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">
            {session.role === 'super_admin' ? 'Admin Dashboard' : 'My Dashboard'}
          </Typography>
          <Typography variant="subtitle1">
            Welcome, {session.displayName}
          </Typography>
        </Box>
        {isEngineer && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<SupportAgentIcon />}
            onClick={() => { setNewAgentName(session.agentName); setAgentDialogOpen(true); }}
          >
            Configure AI Agent
          </Button>
        )}
      </Box>

      {/* Prompt to set agent name on first login */}
      {needsAgentSetup && (
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#e8f0fe', border: '1px solid #1a73e8' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SupportAgentIcon sx={{ color: '#1a73e8' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Set up your AI Agent
              </Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                Give your personal AI assistant a name. Default: {session.username}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => { setNewAgentName(session.agentName); setAgentDialogOpen(true); }}
            >
              Configure
            </Button>
          </Box>
        </Paper>
      )}

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map(card => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.label}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ color: card.color, mr: 1.5 }}>{card.icon}</Box>
                  <Typography variant="body2" sx={{ color: '#5f6368' }}>{card.label}</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 400, color: card.color }}>
                  {card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent tickets preview */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {session.role === 'super_admin' ? 'Recent Cases' : 'Assigned to Me'}
        </Typography>
        {(session.role === 'super_admin' ? supportState.tickets : myTickets)
          .slice(-5)
          .reverse()
          .map(ticket => (
            <Box
              key={ticket.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 1,
                borderBottom: '1px solid #e8eaed',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', minWidth: 100 }}>
                {ticket.ticketNumber}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ticket.title}
              </Typography>
              <SeverityBadge severity={ticket.severity} />
              <StatusBadge status={ticket.status} />
            </Box>
          ))}
        {(session.role === 'super_admin' ? supportState.tickets : myTickets).length === 0 && (
          <Typography variant="body2" sx={{ color: '#80868b', textAlign: 'center', py: 2 }}>
            No cases yet
          </Typography>
        )}
      </Paper>

      {/* Agent Name Dialog */}
      <Dialog open={agentDialogOpen} onClose={() => setAgentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Configure AI Agent</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#5f6368', mb: 2 }}>
            Your personal AI assistant will use this name. It will learn from your resolved tickets to provide better suggestions.
          </Typography>
          <TextField
            label="Agent Name"
            value={newAgentName}
            onChange={e => setNewAgentName(e.target.value)}
            fullWidth
            placeholder={`CloudAssist-${session.username}`}
            helperText="e.g., CloudAssist-Rahul, SupportBot-Alex"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgentDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSetAgentName} disabled={!newAgentName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;
