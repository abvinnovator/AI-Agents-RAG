// GCP Regions, Zones, Machine Types, and Pricing Data

export interface GcpRegion {
  name: string;
  location: string;
  zones: string[];
}

export interface MachineType {
  name: string;
  vCPUs: number;
  memoryGb: number;
  pricePerHour: number;
  category: string;
}

export interface DiskType {
  name: string;
  label: string;
  pricePerGbMonth: number;
}

export interface StorageClass {
  name: string;
  label: string;
  pricePerGbMonth: number;
}

export const GCP_REGIONS: GcpRegion[] = [
  { name: 'us-central1', location: 'Iowa, USA', zones: ['us-central1-a', 'us-central1-b', 'us-central1-c', 'us-central1-f'] },
  { name: 'us-east1', location: 'South Carolina, USA', zones: ['us-east1-b', 'us-east1-c', 'us-east1-d'] },
  { name: 'us-west1', location: 'Oregon, USA', zones: ['us-west1-a', 'us-west1-b', 'us-west1-c'] },
  { name: 'europe-west1', location: 'Belgium', zones: ['europe-west1-b', 'europe-west1-c', 'europe-west1-d'] },
  { name: 'europe-west2', location: 'London, UK', zones: ['europe-west2-a', 'europe-west2-b', 'europe-west2-c'] },
  { name: 'asia-east1', location: 'Taiwan', zones: ['asia-east1-a', 'asia-east1-b', 'asia-east1-c'] },
  { name: 'asia-south1', location: 'Mumbai, India', zones: ['asia-south1-a', 'asia-south1-b', 'asia-south1-c'] },
  { name: 'asia-southeast1', location: 'Singapore', zones: ['asia-southeast1-a', 'asia-southeast1-b', 'asia-southeast1-c'] },
  { name: 'australia-southeast1', location: 'Sydney, Australia', zones: ['australia-southeast1-a', 'australia-southeast1-b', 'australia-southeast1-c'] },
  { name: 'southamerica-east1', location: 'São Paulo, Brazil', zones: ['southamerica-east1-a', 'southamerica-east1-b', 'southamerica-east1-c'] },
];

export const MACHINE_TYPES: MachineType[] = [
  // General purpose
  { name: 'e2-micro', vCPUs: 0.25, memoryGb: 1, pricePerHour: 0.0084, category: 'General Purpose' },
  { name: 'e2-small', vCPUs: 0.5, memoryGb: 2, pricePerHour: 0.0168, category: 'General Purpose' },
  { name: 'e2-medium', vCPUs: 1, memoryGb: 4, pricePerHour: 0.0335, category: 'General Purpose' },
  { name: 'e2-standard-2', vCPUs: 2, memoryGb: 8, pricePerHour: 0.067, category: 'General Purpose' },
  { name: 'e2-standard-4', vCPUs: 4, memoryGb: 16, pricePerHour: 0.134, category: 'General Purpose' },
  { name: 'e2-standard-8', vCPUs: 8, memoryGb: 32, pricePerHour: 0.268, category: 'General Purpose' },
  { name: 'n2-standard-2', vCPUs: 2, memoryGb: 8, pricePerHour: 0.0971, category: 'General Purpose' },
  { name: 'n2-standard-4', vCPUs: 4, memoryGb: 16, pricePerHour: 0.1942, category: 'General Purpose' },
  { name: 'n2-standard-8', vCPUs: 8, memoryGb: 32, pricePerHour: 0.3884, category: 'General Purpose' },
  // Compute optimized
  { name: 'c2-standard-4', vCPUs: 4, memoryGb: 16, pricePerHour: 0.2088, category: 'Compute Optimized' },
  { name: 'c2-standard-8', vCPUs: 8, memoryGb: 32, pricePerHour: 0.4176, category: 'Compute Optimized' },
  // Memory optimized
  { name: 'm1-megamem-96', vCPUs: 96, memoryGb: 1433.6, pricePerHour: 10.6740, category: 'Memory Optimized' },
  // GPU
  { name: 'a2-highgpu-1g', vCPUs: 12, memoryGb: 85, pricePerHour: 3.6732, category: 'Accelerator Optimized' },
];

export const DISK_TYPES: DiskType[] = [
  { name: 'pd-standard', label: 'Standard persistent disk', pricePerGbMonth: 0.04 },
  { name: 'pd-balanced', label: 'Balanced persistent disk', pricePerGbMonth: 0.10 },
  { name: 'pd-ssd', label: 'SSD persistent disk', pricePerGbMonth: 0.17 },
  { name: 'pd-extreme', label: 'Extreme persistent disk', pricePerGbMonth: 0.125 },
];

export const STORAGE_CLASSES: StorageClass[] = [
  { name: 'STANDARD', label: 'Standard', pricePerGbMonth: 0.020 },
  { name: 'NEARLINE', label: 'Nearline', pricePerGbMonth: 0.010 },
  { name: 'COLDLINE', label: 'Coldline', pricePerGbMonth: 0.004 },
  { name: 'ARCHIVE', label: 'Archive', pricePerGbMonth: 0.0012 },
];

export const OS_IMAGES = [
  { name: 'debian-11', label: 'Debian GNU/Linux 11 (bullseye)', family: 'Debian' },
  { name: 'debian-12', label: 'Debian GNU/Linux 12 (bookworm)', family: 'Debian' },
  { name: 'ubuntu-2004-lts', label: 'Ubuntu 20.04 LTS', family: 'Ubuntu' },
  { name: 'ubuntu-2204-lts', label: 'Ubuntu 22.04 LTS', family: 'Ubuntu' },
  { name: 'centos-stream-9', label: 'CentOS Stream 9', family: 'CentOS' },
  { name: 'rhel-9', label: 'Red Hat Enterprise Linux 9', family: 'RHEL' },
  { name: 'windows-2022', label: 'Windows Server 2022', family: 'Windows' },
];

export const VPC_SUBNET_MODES = ['Auto', 'Custom'] as const;

export const FIREWALL_PROTOCOLS = ['tcp', 'udp', 'icmp', 'all'] as const;

export const LOAD_BALANCER_TYPES = [
  { name: 'HTTP(S)', description: 'Global HTTP(S) Load Balancer', pricePerHour: 0.025 },
  { name: 'TCP/UDP', description: 'Regional TCP/UDP Load Balancer', pricePerHour: 0.025 },
  { name: 'Internal', description: 'Internal TCP/UDP Load Balancer', pricePerHour: 0.025 },
] as const;

export const BIGQUERY_PRICING = {
  storagePerGbMonth: 0.02,       // Active storage
  queryPerTb: 5.00,              // On-demand query pricing
};
