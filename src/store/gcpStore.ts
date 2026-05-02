import { v4 as uuidv4 } from 'uuid';

// ─── Types ──────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  folders: Folder[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string; // org id or folder id
  parentType: 'organization' | 'folder';
  createdAt: string;
  folders: Folder[];
  projects: Project[];
}

export interface Project {
  id: string;
  projectId: string;   // user-facing id like "my-project-12345"
  name: string;
  number: number;
  parentId: string;
  parentType: 'organization' | 'folder';
  createdAt: string;
  labels: Record<string, string>;
  // Resources
  vpcNetworks: VpcNetwork[];
  vmInstances: VmInstance[];
  storageBuckets: StorageBucket[];
  bigqueryDatasets: BigQueryDataset[];
  loadBalancers: LoadBalancer[];
  firewallRules: FirewallRule[];
}

export interface VpcNetwork {
  id: string;
  name: string;
  subnetMode: 'Auto' | 'Custom';
  subnets: Subnet[];
  createdAt: string;
}

export interface Subnet {
  id: string;
  name: string;
  region: string;
  ipCidrRange: string;
  createdAt: string;
}

export interface VmInstance {
  id: string;
  name: string;
  zone: string;
  machineType: string;
  status: 'RUNNING' | 'STOPPED' | 'TERMINATED' | 'STAGING';
  bootDisk: {
    image: string;
    sizeGb: number;
    type: string;
  };
  networkInterface: {
    network: string;
    subnet: string;
    externalIp: boolean;
  };
  labels: Record<string, string>;
  createdAt: string;
}

export interface StorageBucket {
  id: string;
  name: string;
  location: string;
  storageClass: string;
  labels: Record<string, string>;
  sizeGb: number;
  createdAt: string;
}

export interface BigQueryDataset {
  id: string;
  name: string;
  location: string;
  tables: BigQueryTable[];
  createdAt: string;
}

export interface BigQueryTable {
  id: string;
  name: string;
  sizeGb: number;
  rowCount: number;
  createdAt: string;
}

export interface LoadBalancer {
  id: string;
  name: string;
  type: string;
  region: string;
  backends: string[]; // VM instance ids
  createdAt: string;
}

export interface FirewallRule {
  id: string;
  name: string;
  network: string;
  direction: 'INGRESS' | 'EGRESS';
  priority: number;
  action: 'ALLOW' | 'DENY';
  protocol: string;
  ports: string;
  sourceRanges: string;
  createdAt: string;
}

// ─── State ──────────────────────────────────────────────────────

export interface GcpState {
  organizations: Organization[];
  // Currently selected context
  currentOrgId: string | null;
  currentFolderId: string | null;
  currentProjectId: string | null;
}

const STORAGE_KEY = 'cloudops_gcp_state';

function loadState(): GcpState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { organizations: [], currentOrgId: null, currentFolderId: null, currentProjectId: null };
}

function saveState(state: GcpState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Store (simple pub/sub) ──────────────────────────────────────

type Listener = () => void;
let _state: GcpState = loadState();
const _listeners = new Set<Listener>();

function notify() {
  saveState(_state);
  _listeners.forEach(fn => fn());
}

export function getState(): GcpState {
  return _state;
}

export function subscribe(fn: Listener) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// ─── Helpers ────────────────────────────────────────────────────

function generateProjectId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 20);
  return `${slug}-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateProjectNumber(): number {
  return Math.floor(100000000000 + Math.random() * 900000000000);
}

function now(): string {
  return new Date().toISOString();
}

// ─── Find helpers ───────────────────────────────────────────────

export function findOrg(orgId: string): Organization | undefined {
  return _state.organizations.find(o => o.id === orgId);
}

function findFolderRecursive(folders: Folder[], folderId: string): Folder | undefined {
  for (const f of folders) {
    if (f.id === folderId) return f;
    const child = findFolderRecursive(f.folders, folderId);
    if (child) return child;
  }
  return undefined;
}

export function findFolder(folderId: string): Folder | undefined {
  for (const org of _state.organizations) {
    const f = findFolderRecursive(org.folders, folderId);
    if (f) return f;
  }
  return undefined;
}

export function findProject(projectId: string): Project | undefined {
  for (const org of _state.organizations) {
    const p = findProjectInFolders(org.folders, projectId);
    if (p) return p;
  }
  return undefined;
}

function findProjectInFolders(folders: Folder[], projectId: string): Project | undefined {
  for (const f of folders) {
    const p = f.projects.find(p => p.id === projectId);
    if (p) return p;
    const child = findProjectInFolders(f.folders, projectId);
    if (child) return child;
  }
  return undefined;
}

export function getAllProjectsInOrg(orgId: string): Project[] {
  const org = findOrg(orgId);
  if (!org) return [];
  const result: Project[] = [];
  function collect(folders: Folder[]) {
    for (const f of folders) {
      result.push(...f.projects);
      collect(f.folders);
    }
  }
  collect(org.folders);
  return result;
}

// ─── Actions ────────────────────────────────────────────────────

export function createOrganization(name: string, displayName: string) {
  const org: Organization = {
    id: uuidv4(),
    name,
    displayName,
    createdAt: now(),
    folders: [],
  };
  _state = { ..._state, organizations: [..._state.organizations, org], currentOrgId: org.id };
  notify();
  return org;
}

export function createFolder(name: string, parentId: string, parentType: 'organization' | 'folder') {
  const folder: Folder = {
    id: uuidv4(),
    name,
    parentId,
    parentType,
    createdAt: now(),
    folders: [],
    projects: [],
  };

  _state = { ..._state, organizations: _state.organizations.map(org => {
    if (parentType === 'organization' && org.id === parentId) {
      return { ...org, folders: [...org.folders, folder] };
    }
    return { ...org, folders: addFolderToParent(org.folders, parentId, folder) };
  })};
  notify();
  return folder;
}

function addFolderToParent(folders: Folder[], parentId: string, newFolder: Folder): Folder[] {
  return folders.map(f => {
    if (f.id === parentId) {
      return { ...f, folders: [...f.folders, newFolder] };
    }
    return { ...f, folders: addFolderToParent(f.folders, parentId, newFolder) };
  });
}

export function createProject(name: string, parentId: string, parentType: 'organization' | 'folder') {
  const project: Project = {
    id: uuidv4(),
    projectId: generateProjectId(name),
    name,
    number: generateProjectNumber(),
    parentId,
    parentType,
    createdAt: now(),
    labels: {},
    vpcNetworks: [],
    vmInstances: [],
    storageBuckets: [],
    bigqueryDatasets: [],
    loadBalancers: [],
    firewallRules: [],
  };

  // A project must be inside a folder
  _state = { ..._state, organizations: _state.organizations.map(org => ({
    ...org,
    folders: addProjectToFolder(org.folders, parentId, project),
  }))};
  _state.currentProjectId = project.id;
  notify();
  return project;
}

function addProjectToFolder(folders: Folder[], folderId: string, project: Project): Folder[] {
  return folders.map(f => {
    if (f.id === folderId) {
      return { ...f, projects: [...f.projects, project] };
    }
    return { ...f, folders: addProjectToFolder(f.folders, folderId, project) };
  });
}

export function setCurrentProject(projectId: string | null) {
  _state = { ..._state, currentProjectId: projectId };
  notify();
}

export function setCurrentOrg(orgId: string | null) {
  _state = { ..._state, currentOrgId: orgId, currentFolderId: null, currentProjectId: null };
  notify();
}

// ─── Resource mutations (operate on current project) ──────────

function updateCurrentProject(updater: (p: Project) => Project) {
  const pid = _state.currentProjectId;
  if (!pid) return;

  _state = {
    ..._state,
    organizations: _state.organizations.map(org => ({
      ...org,
      folders: updateProjectInFolders(org.folders, pid, updater),
    })),
  };
  notify();
}

function updateProjectInFolders(folders: Folder[], projectId: string, updater: (p: Project) => Project): Folder[] {
  return folders.map(f => ({
    ...f,
    projects: f.projects.map(p => p.id === projectId ? updater(p) : p),
    folders: updateProjectInFolders(f.folders, projectId, updater),
  }));
}

// VPC
export function createVpc(name: string, subnetMode: 'Auto' | 'Custom') {
  const vpc: VpcNetwork = { id: uuidv4(), name, subnetMode, subnets: [], createdAt: now() };
  if (subnetMode === 'Auto') {
    // Auto mode creates default subnets in all regions
    const regions = ['us-central1', 'us-east1', 'us-west1', 'europe-west1', 'asia-east1', 'asia-south1'];
    vpc.subnets = regions.map((region, i) => ({
      id: uuidv4(),
      name: `${name}-subnet-${region}`,
      region,
      ipCidrRange: `10.${128 + i}.0.0/20`,
      createdAt: now(),
    }));
  }
  updateCurrentProject(p => ({ ...p, vpcNetworks: [...p.vpcNetworks, vpc] }));
  return vpc;
}

export function createSubnet(vpcId: string, name: string, region: string, ipCidrRange: string) {
  const subnet: Subnet = { id: uuidv4(), name, region, ipCidrRange, createdAt: now() };
  updateCurrentProject(p => ({
    ...p,
    vpcNetworks: p.vpcNetworks.map(v =>
      v.id === vpcId ? { ...v, subnets: [...v.subnets, subnet] } : v
    ),
  }));
  return subnet;
}

// VM
export function createVmInstance(data: Omit<VmInstance, 'id' | 'createdAt' | 'status'>) {
  const vm: VmInstance = { ...data, id: uuidv4(), status: 'RUNNING', createdAt: now() };
  updateCurrentProject(p => ({ ...p, vmInstances: [...p.vmInstances, vm] }));
  return vm;
}

export function updateVmStatus(vmId: string, status: VmInstance['status']) {
  updateCurrentProject(p => ({
    ...p,
    vmInstances: p.vmInstances.map(vm => vm.id === vmId ? { ...vm, status } : vm),
  }));
}

export function deleteVm(vmId: string) {
  updateCurrentProject(p => ({
    ...p,
    vmInstances: p.vmInstances.filter(vm => vm.id !== vmId),
  }));
}

// Storage Bucket
export function createBucket(data: Omit<StorageBucket, 'id' | 'createdAt'>) {
  const bucket: StorageBucket = { ...data, id: uuidv4(), createdAt: now() };
  updateCurrentProject(p => ({ ...p, storageBuckets: [...p.storageBuckets, bucket] }));
  return bucket;
}

export function deleteBucket(bucketId: string) {
  updateCurrentProject(p => ({
    ...p,
    storageBuckets: p.storageBuckets.filter(b => b.id !== bucketId),
  }));
}

// BigQuery
export function createDataset(name: string, location: string) {
  const ds: BigQueryDataset = { id: uuidv4(), name, location, tables: [], createdAt: now() };
  updateCurrentProject(p => ({ ...p, bigqueryDatasets: [...p.bigqueryDatasets, ds] }));
  return ds;
}

export function createBqTable(datasetId: string, name: string, sizeGb: number, rowCount: number) {
  const table: BigQueryTable = { id: uuidv4(), name, sizeGb, rowCount, createdAt: now() };
  updateCurrentProject(p => ({
    ...p,
    bigqueryDatasets: p.bigqueryDatasets.map(ds =>
      ds.id === datasetId ? { ...ds, tables: [...ds.tables, table] } : ds
    ),
  }));
  return table;
}

// Load Balancer
export function createLoadBalancer(data: Omit<LoadBalancer, 'id' | 'createdAt'>) {
  const lb: LoadBalancer = { ...data, id: uuidv4(), createdAt: now() };
  updateCurrentProject(p => ({ ...p, loadBalancers: [...p.loadBalancers, lb] }));
  return lb;
}

// Firewall
export function createFirewallRule(data: Omit<FirewallRule, 'id' | 'createdAt'>) {
  const rule: FirewallRule = { ...data, id: uuidv4(), createdAt: now() };
  updateCurrentProject(p => ({ ...p, firewallRules: [...p.firewallRules, rule] }));
  return rule;
}

export function deleteFirewallRule(ruleId: string) {
  updateCurrentProject(p => ({
    ...p,
    firewallRules: p.firewallRules.filter(r => r.id !== ruleId),
  }));
}

// Delete project
export function deleteProject(projectId: string) {
  function removeFromFolders(folders: Folder[]): Folder[] {
    return folders.map(f => ({
      ...f,
      projects: f.projects.filter(p => p.id !== projectId),
      folders: removeFromFolders(f.folders),
    }));
  }
  _state = {
    ..._state,
    organizations: _state.organizations.map(org => ({
      ...org,
      folders: removeFromFolders(org.folders),
    })),
    currentProjectId: _state.currentProjectId === projectId ? null : _state.currentProjectId,
  };
  notify();
}
