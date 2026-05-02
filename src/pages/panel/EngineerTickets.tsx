import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, Divider, Chip,
  IconButton,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSupportStore } from '../../hooks/useSupportStore';
import { useAuthStore } from '../../hooks/useAuthStore';
import {
  getTicketsForRole, getTicketsForUser,
  startWorkingOnTicket, resolveTicket, escalateTicket, addMessage,
  type Ticket,
} from '../../store/supportStore';
import { SUPPORT_ROLES, getRoleLabel, type SupportRole } from '../../store/authStore';
import { SeverityBadge, StatusBadge, CategoryBadge } from '../../components/support/StatusBadge';

const EngineerTickets: React.FC = () => {
  const supportState = useSupportStore();
  const auth = useAuthStore();
  const session = auth.session!;

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [escalateRole, setEscalateRole] = useState<SupportRole>('L3');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tickets assigned to this role or directly to this user
  const roleTickets = getTicketsForRole(session.role);
  const myTickets = getTicketsForUser(session.userId);
  const allTickets = [...new Map([...roleTickets, ...myTickets].map(t => [t.id, t])).values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Live ticket from store
  const liveTicket = selectedTicketId
    ? supportState.tickets.find(t => t.id === selectedTicketId) || null
    : null;

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTicket?.messages.length]);

  const handleSendReply = () => {
    if (!replyText.trim() || !liveTicket) return;
    addMessage(liveTicket.id, replyText.trim(), session.userId, session.displayName, session.role);
    setReplyText('');
  };

  const handleResolve = () => {
    if (!liveTicket || !resolution.trim()) return;
    resolveTicket(liveTicket.id, resolution.trim(), session.userId);
    setResolveDialogOpen(false);
    setResolution('');
  };

  const handleEscalate = () => {
    if (!liveTicket) return;
    escalateTicket(liveTicket.id, escalateRole);
    setEscalateDialogOpen(false);
    setSelectedTicketId(null);
  };

  // ──── Ticket conversation detail view ────
  if (liveTicket) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={() => setSelectedTicketId(null)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">{liveTicket.ticketNumber}</Typography>
          <SeverityBadge severity={liveTicket.severity} />
          <StatusBadge status={liveTicket.status} />
        </Box>

        {/* Ticket info card */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>{liveTicket.title}</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <CategoryBadge category={liveTicket.category} />
            <Chip label={`Project: ${liveTicket.projectName}`} size="small" variant="outlined" />
            {liveTicket.linkedResourceName && (
              <Chip label={`${liveTicket.linkedResourceType}: ${liveTicket.linkedResourceName}`} size="small" variant="outlined" />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: '#5f6368' }}>
            Opened {new Date(liveTicket.createdAt).toLocaleString()}
          </Typography>

          {/* AI Routing info */}
          {liveTicket.aiRouting.reasoning && (
            <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, bgcolor: '#f8f9fa' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <SupportAgentIcon sx={{ fontSize: 16, color: '#1a73e8' }} />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>AI Agent Analysis</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                {liveTicket.aiRouting.reasoning}
              </Typography>
              {liveTicket.aiRouting.suggestedTool && (
                <Box sx={{ mt: 0.5 }}>
                  <Chip label={`Tool: ${liveTicket.aiRouting.suggestedTool}`} size="small" sx={{ fontSize: '0.625rem' }} />
                </Box>
              )}
            </Paper>
          )}

          {/* Action buttons for the support engineer */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {liveTicket.status === 'assigned' && (
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={() => startWorkingOnTicket(liveTicket.id)}
              >
                Start Working
              </Button>
            )}
            {liveTicket.status === 'in_progress' && (
              <>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => { setResolution(''); setResolveDialogOpen(true); }}
                >
                  Mark Resolved
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  startIcon={<ArrowUpwardIcon />}
                  onClick={() => setEscalateDialogOpen(true)}
                >
                  Escalate
                </Button>
              </>
            )}
          </Box>
        </Paper>

        {/* Conversation thread */}
        <Paper sx={{ mb: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
            <Typography variant="subtitle2">Conversation</Typography>
          </Box>

          <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 2 }}>
            {/* Original description as first message from customer */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <PersonIcon sx={{ color: '#1a73e8', mt: 0.5, fontSize: 20 }} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>Customer</Typography>
                  <Typography variant="caption" sx={{ color: '#80868b' }}>
                    {new Date(liveTicket.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#e8f0fe', borderColor: '#c2d7f8' }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {liveTicket.description}
                  </Typography>
                </Paper>
              </Box>
            </Box>

            {/* All messages in the conversation */}
            {liveTicket.messages.map(msg => {
              const isCustomer = msg.authorRole === 'end_user';
              return (
                <Box key={msg.id} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                  {isCustomer
                    ? <PersonIcon sx={{ color: '#1a73e8', mt: 0.5, fontSize: 20 }} />
                    : <SupportAgentIcon sx={{ color: '#1e8e3e', mt: 0.5, fontSize: 20 }} />
                  }
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {isCustomer ? 'Customer' : `${msg.authorName} (${msg.authorRole})`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#80868b' }}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: isCustomer ? '#e8f0fe' : '#e6f4ea',
                        borderColor: isCustomer ? '#c2d7f8' : '#a8dab5',
                      }}
                    >
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </Typography>
                    </Paper>
                  </Box>
                </Box>
              );
            })}

            {/* Resolution */}
            {liveTicket.resolution && (
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <CheckCircleIcon sx={{ color: '#137333', mt: 0.5, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#e6f4ea', borderColor: '#a8dab5' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#137333', mb: 0.5 }}>
                      ✓ Case Resolved
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {liveTicket.resolution}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Reply input — only during in_progress */}
          {liveTicket.status === 'in_progress' && (
            <Box sx={{ p: 2, borderTop: '1px solid #dadce0', display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Reply to customer..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendReply())}
                multiline
                maxRows={3}
              />
              <IconButton color="primary" onClick={handleSendReply} disabled={!replyText.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          )}

          {liveTicket.status === 'assigned' && (
            <Box sx={{ p: 2, borderTop: '1px solid #dadce0', bgcolor: '#fef7e0', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#e37400' }}>
                Click "Start Working" to begin the conversation with the customer.
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Resolve Dialog */}
        <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Resolve Case</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#5f6368', mb: 2 }}>
              Provide a summary of the resolution. The customer will see this message.
              Only mark as resolved when the issue is truly fixed and the customer has confirmed.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Describe what was done to resolve the issue..."
              value={resolution}
              onChange={e => setResolution(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="success"
              onClick={handleResolve}
              disabled={!resolution.trim()}
            >
              Resolve Case
            </Button>
          </DialogActions>
        </Dialog>

        {/* Escalate Dialog */}
        <Dialog open={escalateDialogOpen} onClose={() => setEscalateDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Escalate Case</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 1 }}>
              <InputLabel>Escalate to</InputLabel>
              <Select value={escalateRole} label="Escalate to" onChange={e => setEscalateRole(e.target.value as SupportRole)}>
                {SUPPORT_ROLES.map(r => (
                  <MenuItem key={r} value={r}>{getRoleLabel(r)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEscalateDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="warning" onClick={handleEscalate}>Escalate</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // ──── Ticket list view ────
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>My Tickets</Typography>
      <Typography variant="subtitle1" sx={{ mb: 3 }}>
        Tickets assigned to you or your role ({getRoleLabel(session.role)})
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Case #</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Messages</TableCell>
              <TableCell>Project</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No tickets assigned to you
                </TableCell>
              </TableRow>
            )}
            {allTickets.map(ticket => (
              <TableRow
                key={ticket.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => { setSelectedTicketId(ticket.id); setReplyText(''); }}
              >
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{ticket.ticketNumber}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{ticket.title}</TableCell>
                <TableCell><CategoryBadge category={ticket.category} /></TableCell>
                <TableCell><SeverityBadge severity={ticket.severity} /></TableCell>
                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                <TableCell>
                  <Chip label={ticket.messages.length} size="small" variant="outlined" sx={{ minWidth: 28 }} />
                </TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{ticket.projectName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default EngineerTickets;
