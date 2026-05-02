import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Chip, Divider, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useSupportStore } from '../../hooks/useSupportStore';
import { addMessage, type Ticket } from '../../store/supportStore';
import { SeverityBadge, StatusBadge, CategoryBadge } from '../../components/support/StatusBadge';

const MyTickets: React.FC = () => {
  const supportState = useSupportStore();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tickets = [...supportState.tickets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Live ticket from store
  const liveTicket = selectedTicket
    ? supportState.tickets.find(t => t.id === selectedTicket.id) || null
    : null;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTicket?.messages.length]);

  const handleSendReply = () => {
    if (!replyText.trim() || !liveTicket) return;
    addMessage(liveTicket.id, replyText.trim(), 'end_user', 'You', 'end_user');
    setReplyText('');
  };

  // Ticket detail / conversation view
  if (liveTicket) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <IconButton onClick={() => setSelectedTicket(null)} size="small">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5">{liveTicket.ticketNumber}</Typography>
          <SeverityBadge severity={liveTicket.severity} />
          <StatusBadge status={liveTicket.status} />
        </Box>

        {/* Ticket info */}
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
        </Paper>

        {/* Conversation */}
        <Paper sx={{ mb: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
            <Typography variant="subtitle2">Conversation</Typography>
          </Box>

          <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 2 }}>
            {/* Original description as first message */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <PersonIcon sx={{ color: '#1a73e8', mt: 0.5, fontSize: 20 }} />
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>You</Typography>
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

            {/* Messages */}
            {liveTicket.messages.map(msg => {
              const isEndUser = msg.authorRole === 'end_user';
              return (
                <Box key={msg.id} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                  {isEndUser
                    ? <PersonIcon sx={{ color: '#1a73e8', mt: 0.5, fontSize: 20 }} />
                    : <SupportAgentIcon sx={{ color: '#1e8e3e', mt: 0.5, fontSize: 20 }} />
                  }
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {isEndUser ? 'You' : `${msg.authorName} (Support)`}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#80868b' }}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: isEndUser ? '#e8f0fe' : '#e6f4ea',
                        borderColor: isEndUser ? '#c2d7f8' : '#a8dab5',
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

            {/* Resolution message */}
            {liveTicket.resolution && (
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                <SupportAgentIcon sx={{ color: '#137333', mt: 0.5, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#137333' }}>
                      Resolved by Support
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#80868b' }}>
                      {liveTicket.resolvedAt && new Date(liveTicket.resolvedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#e6f4ea', borderColor: '#a8dab5' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>Resolution:</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {liveTicket.resolution}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Reply input — only if ticket is not closed */}
          {!['closed', 'resolved'].includes(liveTicket.status) && (
            <Box sx={{ p: 2, borderTop: '1px solid #dadce0', display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type a reply..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendReply())}
                multiline
                maxRows={3}
              />
              <IconButton
                color="primary"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
              >
                <SendIcon />
              </IconButton>
            </Box>
          )}

          {liveTicket.status === 'resolved' && (
            <Box sx={{ p: 2, borderTop: '1px solid #dadce0', bgcolor: '#e6f4ea', textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#137333' }}>
                ✓ This case has been resolved. If you still need help, you can reply to reopen.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    );
  }

  // Ticket list view
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>My Support Cases</Typography>
      <Typography variant="subtitle1" sx={{ mb: 3 }}>
        Track the status of your support cases
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
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No support cases yet. Create one from the Support page.
                </TableCell>
              </TableRow>
            )}
            {tickets.map(ticket => (
              <TableRow
                key={ticket.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setSelectedTicket(ticket)}
              >
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 500 }}>
                  {ticket.ticketNumber}
                </TableCell>
                <TableCell sx={{ fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ticket.title}
                </TableCell>
                <TableCell><CategoryBadge category={ticket.category} /></TableCell>
                <TableCell><SeverityBadge severity={ticket.severity} /></TableCell>
                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                <TableCell>
                  <Chip
                    label={ticket.messages.length}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 28 }}
                  />
                </TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {tickets.length > 0 && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="body2" sx={{ color: '#5f6368' }}>
            {tickets.length} total case{tickets.length !== 1 ? 's' : ''} •{' '}
            {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length} resolved •{' '}
            {tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length} active
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default MyTickets;
