import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import gcpTheme from './theme/gcpTheme';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import ResourceManager from './pages/ResourceManager';
import ComputeInstances from './pages/ComputeInstances';
import VpcNetworks from './pages/VpcNetworks';
import FirewallRules from './pages/FirewallRules';
import CloudStorage from './pages/CloudStorage';
import BigQuery from './pages/BigQuery';
import LoadBalancing from './pages/LoadBalancing';
import Billing from './pages/Billing';

function App() {
  return (
    <ThemeProvider theme={gcpTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
