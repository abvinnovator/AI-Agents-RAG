import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import gcpTheme from './theme/gcpTheme';

// Layouts
import AppLayout from './components/layout/AppLayout';
import PanelLayout from './components/layout/PanelLayout';

// GCP Simulator pages
import Dashboard from './pages/Dashboard';
import ResourceManager from './pages/ResourceManager';
import ComputeInstances from './pages/ComputeInstances';
import VpcNetworks from './pages/VpcNetworks';
import FirewallRules from './pages/FirewallRules';
import CloudStorage from './pages/CloudStorage';
import BigQuery from './pages/BigQuery';
import LoadBalancing from './pages/LoadBalancing';
import Billing from './pages/Billing';

// End-user support pages (inside GCP simulator)
import RaiseTicket from './pages/support/RaiseTicket';
import MyTickets from './pages/support/MyTickets';

// Support Panel pages (separate login)
import PanelLogin from './pages/panel/PanelLogin';
import AdminDashboard from './pages/panel/AdminDashboard';
import TeamManagement from './pages/panel/TeamManagement';
import EscalationMatrix from './pages/panel/EscalationMatrix';
import TicketQueue from './pages/panel/TicketQueue';
import EngineerTickets from './pages/panel/EngineerTickets';
import AIMonitorDashboard from './pages/panel/AIMonitorDashboard';

function App() {
  return (
    <ThemeProvider theme={gcpTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* GCP Simulator (end user) */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/resource-manager" element={<ResourceManager />} />
            <Route path="/compute" element={<ComputeInstances />} />
            <Route path="/vpc" element={<VpcNetworks />} />
            <Route path="/firewall" element={<FirewallRules />} />
            <Route path="/storage" element={<CloudStorage />} />
            <Route path="/bigquery" element={<BigQuery />} />
            <Route path="/load-balancing" element={<LoadBalancing />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/support" element={<RaiseTicket />} />
            <Route path="/my-cases" element={<MyTickets />} />
          </Route>

          {/* Support Panel (admin/engineer login) */}
          <Route path="/support-panel/login" element={<PanelLogin />} />
          <Route path="/support-panel" element={<PanelLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="escalation" element={<EscalationMatrix />} />
            <Route path="tickets" element={<TicketQueue />} />
            <Route path="my-tickets" element={<EngineerTickets />} />
            <Route path="ai-monitor" element={<AIMonitorDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
