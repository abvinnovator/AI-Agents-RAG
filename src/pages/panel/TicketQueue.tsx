import React, { useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Chip, Tabs, Tab,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useSupportStore } from '../../hooks/useSupportStore';
import { useAuthStore } from '../../hooks/useAuthStore';
import {
  approveTicketRouting, overrideTicketRouting, assignTicket,
  type TicketSeverity, type TicketStatus, TICKET_SEVERITIES,
} from '../../store/supportStore';
import {
  getAllSupportUsers,
  SUPPORT_ROLES, getRoleLabel, type SupportRole,
} from '../../store/authStore';
import { SeverityBadge, StatusBadge, CategoryBadge, RoleBadge } from '../../components/support/StatusBadge';

const TicketQueue: React.FC = () => {
  const supportState = useSupportStore();
   useAuthStore();
  const [tabValue, setTabValue] = useState(0);

  // Override dialog state
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [overrideRole, setOverrideRole] = useState<SupportRole>('L1');
  const [overrideSeverity, setOverrideSeverity] = useState<TicketSeverity>('P3');

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');

  const tabs = [
    { label: 'Awaiting Approval', filter: (t: { status: TicketStatus }) => t.status === 'waiting_approval' },
    { label: 'Assigned', filter: (t: { status: TicketStatus }) => t.status === 'assigned' },
    { label: 'In Progress', filter: (t: { status: TicketStatus }) => t.status === 'in_progress' },
    { label: 'All', filter: () => true },
  ];

  const filteredTickets = supportState.tickets
    .filter(tabs[tabValue].filter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleApprove = (ticketId: string) => {
    approveTicketRouting(ticketId);
  };

  const openOverrideDialog = (ticketId: string, currentSeverity: TicketSeverity) => {
    setSelectedTicketId(ticketId);
    setOverrideSeverity(currentSeverity);
    setOverrideRole('L1');
    setOverrideDialogOpen(true);
  };

  const handleOverride = () => {
    if (!selectedTicketId) return;
    overrideTicketRouting(selectedTicketId, overrideRole, overrideSeverity);
    setOverrideDialogOpen(false);
  };

  const openAssignDialog = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setAssignUserId('');
    setAssignDialogOpen(true);
  };

  const handleAssign = () => {
    if (!selectedTicketId || !assignUserId) return;
    const user = getAllSupportUsers().find(u => u.id === assignUserId);
    if (user) {
      assignTicket(selectedTicketId, assignUserId, user.role);
    }
    setAssignDialogOpen(false);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>Ticket Queue</Typography>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Review, approve, and assign support cases
      </Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
        {tabs.map((tab, i) => {
          const count = supportState.tickets.filter(tab.filter).length;
          return (
            <Tab
              key={i}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {tab.label}
                  {count > 0 && (
                    <Chip label={count} size="small" sx={{ height: 18, fontSize: '0.625rem' }} />
                  )}
                </Box>
              }
            />
          );
        })}
      </Tabs>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Case #</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>AI Suggestion</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No tickets in this category
                </TableCell>
              </TableRow>
            )}
            {filteredTickets.map(ticket => (
              <TableRow key={ticket.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {ticket.ticketNumber}
                </TableCell>
                <TableCell sx={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ticket.title}
                </TableCell>
                <TableCell><CategoryBadge category={ticket.category} /></TableCell>
                <TableCell><SeverityBadge severity={ticket.severity} /></TableCell>
                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                <TableCell>
                  {ticket.aiRouting.suggestedRole ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <SmartToyIcon sx={{ fontSize: 14, color: '#1a73e8' }} />
                      <RoleBadge role={ticket.aiRouting.suggestedRole} />
                      {ticket.aiRouting.confidence && (
                        <Typography variant="caption" sx={{ color: '#80868b' }}>
                          {Math.round(ticket.aiRouting.confidence * 100)}%
                        </Typography>
                      )}
                    </Box>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {ticket.assignedRole ? <RoleBadge role={ticket.assignedRole} /> : '—'}
                </TableCell>
                <TableCell align="right">
                  {ticket.status === 'waiting_approval' && (
                    <>
                      <IconButton size="small" onClick={() => handleApprove(ticket.id)} title="Approve AI routing" sx={{ color: '#1e8e3e' }}>
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => openOverrideDialog(ticket.id, ticket.severity)} title="Override routing">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {(ticket.status === 'assigned' || ticket.status === 'waiting_approval') && (
                    <Button size="small" onClick={() => openAssignDialog(ticket.id)} sx={{ fontSize: '0.6875rem' }}>
                      Assign
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onClose={() => setOverrideDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Override AI Routing</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select value={overrideSeverity} label="Severity" onChange={e => setOverrideSeverity(e.target.value as TicketSeverity)}>
                {TICKET_SEVERITIES.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Assign to Role</InputLabel>
              <Select value={overrideRole} label="Assign to Role" onChange={e => setOverrideRole(e.target.value as SupportRole)}>
                {SUPPORT_ROLES.map(r => (
                  <MenuItem key={r} value={r}>{getRoleLabel(r)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleOverride}>Override & Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Assign to User Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign to Engineer</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Support Engineer</InputLabel>
            <Select value={assignUserId} label="Support Engineer" onChange={e => setAssignUserId(e.target.value)}>
              {getAllSupportUsers().filter(u => u.active).map(u => (
                <MenuItem key={u.id} value={u.id}>
                  {u.displayName} ({u.role})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssign} disabled={!assignUserId}>Assign</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TicketQueue;
