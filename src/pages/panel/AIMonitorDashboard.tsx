import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Card, CardContent, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, CircularProgress, Alert, Tooltip, LinearProgress,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SpeedIcon from '@mui/icons-material/Speed';
import TimelineIcon from '@mui/icons-material/Timeline';
import InsightsIcon from '@mui/icons-material/Insights';
import PendingIcon from '@mui/icons-material/Pending';
import {
  getDashboardMetrics, getDashboardSuggestions,
  type DashboardMetrics, type SuggestionEntry,
} from '../../services/aiApi';

// ─── Color Palette ──────────────────────────────────────────────

const COLORS = {
  approved: '#2e7d32',
  rejected: '#c62828',
  edited: '#e65100',
  pending: '#757575',
  primary: '#7b1fa2',
  primaryLight: '#e8def8',
  bg: '#1a1a2e',
  bgCard: '#16213e',
  bgGlass: 'rgba(255,255,255,0.05)',
  text: '#e0e0e0',
  textMuted: '#9e9e9e',
  gradientStart: '#7b1fa2',
  gradientEnd: '#1a73e8',
  success: '#00c853',
  warning: '#ff9100',
  danger: '#ff1744',
};

const SOURCE_COLORS: Record<string, string> = {
  past_tickets: '#7b1fa2',
  shared_tickets: '#9c27b0',
  gcp_docs: '#1a73e8',
  'gcp_docs+web': '#0097a7',
  web_search: '#e65100',
  none: '#757575',
};

const CONFIDENCE_COLORS = ['#ff1744', '#ff9100', '#ffd600', '#00c853'];

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    past_tickets: 'Past Tickets',
    shared_tickets: 'Shared Tickets',
    gcp_docs: 'GCP Docs',
    'gcp_docs+web': 'Docs + Web',
    web_search: 'Web Search',
    none: 'No Match',
  };
  return labels[source] || source;
}

function getFeedbackIcon(action: string | null) {
  switch (action) {
    case 'approved': return <CheckCircleIcon sx={{ color: COLORS.approved, fontSize: 18 }} />;
    case 'rejected': return <CancelIcon sx={{ color: COLORS.rejected, fontSize: 18 }} />;
    case 'edited': return <EditIcon sx={{ color: COLORS.edited, fontSize: 18 }} />;
    default: return <PendingIcon sx={{ color: COLORS.pending, fontSize: 18 }} />;
  }
}

function getFeedbackLabel(action: string | null): string {
  switch (action) {
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'edited': return 'Edited';
    default: return 'Pending';
  }
}

// ─── Stat Card Component ────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, subtitle }) => (
  <Card sx={{
    background: `linear-gradient(135deg, ${COLORS.bgCard} 0%, ${COLORS.bg} 100%)`,
    border: `1px solid rgba(255,255,255,0.08)`,
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: `linear-gradient(90deg, ${color}, transparent)`,
    },
  }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 600, mt: 0.5, fontSize: '1.75rem' }}>
            {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.65rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ color, opacity: 0.4, fontSize: 40 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// ─── Confidence Bar ─────────────────────────────────────────────

const ConfidenceBar: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.danger;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          flex: 1, height: 6, borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
      <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.65rem', minWidth: 28 }}>
        {pct}%
      </Typography>
    </Box>
  );
};

// ─── Custom Simple Visualisations (No Recharts) ─────────────────

const SimpleBarChart: React.FC<{ data: { name: string; value: number; fill: string }[], height?: number }> = ({ data, height = 180 }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height, pt: 2, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      {data.map((item, idx) => (
        <Tooltip key={idx} title={`${item.name}: ${item.value}`}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Box sx={{ 
              width: '80%', 
              maxWidth: 40,
              height: `${(item.value / maxVal) * 100}%`, 
              bgcolor: item.fill, 
              borderTopLeftRadius: 4, 
              borderTopRightRadius: 4,
              transition: 'height 0.3s ease'
            }} />
            <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.65rem', mt: 1, textAlign: 'center', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', whiteSpace: 'nowrap' }}>
              {item.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

const SimpleHorizontalBarChart: React.FC<{ data: { name: string; value: number; fill: string }[] }> = ({ data }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
      {data.map((item, idx) => (
        <Box key={idx}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.7rem' }}>{item.name}</Typography>
            <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.7rem' }}>{item.value}</Typography>
          </Box>
          <Box sx={{ width: '100%', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 8 }}>
            <Box sx={{ width: `${(item.value / maxVal) * 100}%`, bgcolor: item.fill, height: '100%', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

const SimpleStackedBar: React.FC<{ data: { name: string; value: number; fill: string }[] }> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', width: '100%', height: 24, borderRadius: 4, overflow: 'hidden', mb: 2 }}>
        {data.map((item, idx) => (
          item.value > 0 ? (
            <Tooltip key={idx} title={`${item.name}: ${item.value} (${Math.round(item.value / total * 100)}%)`}>
              <Box sx={{ width: `${(item.value / total) * 100}%`, bgcolor: item.fill, height: '100%', transition: 'width 0.3s ease' }} />
            </Tooltip>
          ) : null
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
        {data.map((item, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.fill }} />
            <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.7rem' }}>
              {item.name} ({item.value})
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const SimpleLineChart: React.FC<{ data: { date: string; value: number; tooltip: string }[] }> = ({ data }) => {
  const maxVal = 100; // Since it's a percentage
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 220, pt: 2, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: 'auto', flexWrap: 'nowrap' }}>
      {data.map((item, idx) => (
        <Tooltip key={idx} title={item.tooltip}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, flex: 1 }}>
            <Box sx={{ 
              width: 8, 
              height: `${(item.value / maxVal) * 100}%`, 
              bgcolor: COLORS.success, 
              borderRadius: 4,
              transition: 'height 0.3s ease',
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0, left: -4, right: -4, height: 16,
                background: 'radial-gradient(circle, rgba(0,200,83,0.4) 0%, transparent 70%)',
                borderRadius: '50%'
              }
            }} />
            <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.6rem', mt: 1, whiteSpace: 'nowrap' }}>
              {item.date.split(',')[0]}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────────

const AIMonitorDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [m, s] = await Promise.all([
      getDashboardMetrics(),
      getDashboardSuggestions(page, 15),
    ]);
    setMetrics(m);
    if (s) {
      setSuggestions(s.suggestions);
      setTotalPages(s.total_pages);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !metrics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: COLORS.primary }} />
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        AI monitoring service is not available. Make sure the AI server is running on port 8000.
      </Alert>
    );
  }

  // Prepare chart data
  const confidenceChartData = Object.entries(metrics.confidence_distribution).map(([name, value], index) => ({
    name, value, fill: CONFIDENCE_COLORS[index]
  }));

  const sourceChartData = Object.entries(metrics.source_distribution).map(([name, value]) => ({
    name: getSourceLabel(name), value, fill: SOURCE_COLORS[name] || '#757575',
  })).sort((a, b) => b.value - a.value);

  const timeSeriesData = metrics.accuracy_over_time.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: d.approval_rate,
    tooltip: `${d.date}: ${d.approval_rate}% approved (${d.approved}/${d.total} total)`
  }));

  const feedbackPieData = [
    { name: 'Approved', value: metrics.approved_count, fill: COLORS.approved },
    { name: 'Rejected', value: metrics.rejected_count, fill: COLORS.rejected },
    { name: 'Edited', value: metrics.edited_count, fill: COLORS.edited },
    { name: 'Pending', value: metrics.pending_feedback, fill: COLORS.pending },
  ].filter(d => d.value > 0);

  return (
    <Box sx={{
      minHeight: '100vh',
      background: `linear-gradient(180deg, ${COLORS.bg} 0%, #0f0f23 100%)`,
      mx: -3, mt: -3, mb: -3, px: 3, pt: 3, pb: 4,
    }}>
      {/* ─── Header ──────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InsightsIcon sx={{ color: COLORS.primary, fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600, fontSize: '1.25rem' }}>
              AI Monitoring Dashboard
            </Typography>
            <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
              Track AI suggestion quality, accuracy, and human feedback
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(_, v) => v && setTimeRange(v)}
            size="small"
            sx={{ '& .MuiToggleButton-root': { color: COLORS.textMuted, borderColor: 'rgba(255,255,255,0.1)', fontSize: '0.65rem', px: 1.5, py: 0.3, '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(123,31,162,0.3)' } } }}
          >
            <ToggleButton value="7d">7D</ToggleButton>
            <ToggleButton value="30d">30D</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} size="small" sx={{ color: COLORS.textMuted }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* ─── Hero Stat Cards ─────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Total Suggestions"
            value={metrics.total_suggestions}
            icon={<SmartToyIcon sx={{ fontSize: 'inherit' }} />}
            color={COLORS.primary}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Approval Rate"
            value={`${metrics.approval_rate}%`}
            icon={<TrendingUpIcon sx={{ fontSize: 'inherit' }} />}
            color={COLORS.success}
            subtitle={`${metrics.approved_count} approved`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Avg Confidence"
            value={`${Math.round(metrics.avg_confidence * 100)}%`}
            icon={<SpeedIcon sx={{ fontSize: 'inherit' }} />}
            color={COLORS.warning}
            subtitle={`Approved avg: ${Math.round(metrics.avg_confidence_approved * 100)}%`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            label="Rejection Rate"
            value={`${metrics.rejection_rate}%`}
            icon={<CancelIcon sx={{ fontSize: 'inherit' }} />}
            color={COLORS.danger}
            subtitle={`${metrics.rejected_count} rejected`}
          />
        </Grid>
      </Grid>

      {/* ─── Charts Row ──────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Accuracy Over Time */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{
            p: 2, borderRadius: 3,
            background: COLORS.bgCard,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TimelineIcon sx={{ color: COLORS.primary, fontSize: 18 }} />
              <Typography variant="subtitle2" sx={{ color: '#fff', fontSize: '0.8rem' }}>
                Approval Rate Over Time
              </Typography>
            </Box>
            {timeSeriesData.length > 0 ? (
              <SimpleLineChart data={timeSeriesData} />
            ) : (
              <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: COLORS.textMuted }}>
                  No data yet. AI suggestions will appear here as they're tracked.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Feedback Distribution */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{
            p: 2, borderRadius: 3, height: '100%',
            background: COLORS.bgCard,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontSize: '0.8rem', mb: 1 }}>
              Feedback Distribution
            </Typography>
            {feedbackPieData.length > 0 ? (
              <Box sx={{ mt: 4, mb: 4 }}>
                <SimpleStackedBar data={feedbackPieData} />
              </Box>
            ) : (
              <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" sx={{ color: COLORS.textMuted }}>No feedback data yet</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ─── Charts Row 2 ────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Confidence Distribution */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{
            p: 2, borderRadius: 3, height: '100%',
            background: COLORS.bgCard,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontSize: '0.8rem', mb: 1 }}>
              Confidence Score Distribution
            </Typography>
            <SimpleBarChart data={confidenceChartData} />
          </Paper>
        </Grid>

        {/* Source Distribution */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{
            p: 2, borderRadius: 3, height: '100%',
            background: COLORS.bgCard,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontSize: '0.8rem', mb: 1 }}>
              Knowledge Source Distribution
            </Typography>
            <SimpleHorizontalBarChart data={sourceChartData} />
          </Paper>
        </Grid>
      </Grid>

      {/* ─── High Confidence Rejections Alert ────────────────── */}
      {metrics.high_confidence_rejections.length > 0 && (
        <Paper sx={{
          p: 2, mb: 3, borderRadius: 3,
          background: 'rgba(255,23,68,0.08)',
          border: '1px solid rgba(255,23,68,0.2)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <WarningAmberIcon sx={{ color: COLORS.danger, fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ color: COLORS.danger, fontSize: '0.8rem' }}>
              ⚠ High-Confidence Rejections — Potential Hallucinations
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: COLORS.textMuted, display: 'block', mb: 1 }}>
            These suggestions had high confidence (&ge;70%) but were rejected by engineers. Review for quality issues.
          </Typography>
          {metrics.high_confidence_rejections.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <CancelIcon sx={{ color: COLORS.danger, fontSize: 14 }} />
              <Typography variant="caption" sx={{ color: '#fff', flex: 1 }}>
                {r.ticket_title}
              </Typography>
              <Chip
                label={`${Math.round(r.confidence * 100)}% conf`}
                size="small"
                sx={{ fontSize: '0.6rem', bgcolor: 'rgba(255,23,68,0.2)', color: COLORS.danger, height: 20 }}
              />
              <Chip
                label={getSourceLabel(r.source)}
                size="small"
                sx={{ fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)', color: COLORS.textMuted, height: 20 }}
              />
            </Box>
          ))}
        </Paper>
      )}

      {/* ─── Suggestions Table ───────────────────────────────── */}
      <Paper sx={{
        borderRadius: 3,
        background: COLORS.bgCard,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ color: '#fff', fontSize: '0.8rem' }}>
            Recent AI Suggestions
          </Typography>
          <Typography variant="caption" sx={{ color: COLORS.textMuted }}>
            {metrics.total_suggestions} total • Page {page}/{totalPages}
          </Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['Time', 'Ticket', 'Category', 'Source', 'Confidence', 'Feedback', 'Response Time'].map(h => (
                  <TableCell key={h} sx={{
                    bgcolor: COLORS.bg,
                    color: COLORS.textMuted,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    py: 1,
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ color: COLORS.textMuted, textAlign: 'center', py: 4, borderBottom: 'none' }}>
                    No suggestions tracked yet. Ask AI for help on a ticket to start tracking.
                  </TableCell>
                </TableRow>
              ) : suggestions.map((s) => (
                <TableRow key={s.suggestion_id} sx={{
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                  '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                }}>
                  <TableCell sx={{ color: COLORS.textMuted, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {new Date(s.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={s.suggestion_preview || 'No suggestion generated'}>
                      <Typography variant="caption" sx={{ color: '#fff', fontSize: '0.7rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {s.ticket_title}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.ticket_category}
                      size="small"
                      sx={{ fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.08)', color: COLORS.textMuted, height: 20 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getSourceLabel(s.source)}
                      size="small"
                      sx={{
                        fontSize: '0.6rem', height: 20,
                        bgcolor: `${SOURCE_COLORS[s.source] || '#757575'}20`,
                        color: SOURCE_COLORS[s.source] || COLORS.textMuted,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <ConfidenceBar value={s.confidence} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getFeedbackIcon(s.feedback_action)}
                      <Typography variant="caption" sx={{
                        color: s.feedback_action === 'approved' ? COLORS.approved
                          : s.feedback_action === 'rejected' ? COLORS.rejected
                          : s.feedback_action === 'edited' ? COLORS.edited
                          : COLORS.pending,
                        fontSize: '0.65rem',
                      }}>
                        {getFeedbackLabel(s.feedback_action)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: COLORS.textMuted, fontSize: '0.7rem' }}>
                    {formatTime(s.time_to_feedback_sec)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, p: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <Chip
                key={p}
                label={p}
                size="small"
                onClick={() => setPage(p)}
                sx={{
                  cursor: 'pointer', fontSize: '0.65rem', height: 24,
                  bgcolor: p === page ? COLORS.primary : 'rgba(255,255,255,0.05)',
                  color: p === page ? '#fff' : COLORS.textMuted,
                  '&:hover': { bgcolor: p === page ? COLORS.primary : 'rgba(255,255,255,0.1)' },
                }}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* ─── Footer Stats ────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 3 }}>
        <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.6rem' }}>
          Avg Response Time: {formatTime(metrics.avg_time_to_feedback_sec)}
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.6rem' }}>
          Last Updated: {new Date(metrics.last_updated).toLocaleTimeString()}
        </Typography>
        <Typography variant="caption" sx={{ color: COLORS.textMuted, fontSize: '0.6rem' }}>
          Auto-refresh: 30s
        </Typography>
      </Box>
    </Box>
  );
};

export default AIMonitorDashboard;
