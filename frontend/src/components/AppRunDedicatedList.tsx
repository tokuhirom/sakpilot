import { useState, useEffect, useCallback } from 'react';
import {
  GetAppRunClusters,
  GetAppRunApplications,
  GetAppRunCertificates,
  GetAppRunApplicationVersions,
  GetAppRunApplicationVersion,
  GetAppRunASGs,
  GetAppRunLoadBalancers,
  GetAppRunWorkerNodes,
  GetAppRunLBNodes,
  ClearAppRunActiveVersion,
  SetAppRunActiveVersion,
  CreateAppRunApplicationVersion,
  CreateAppRunApplication,
  CreateAppRunCluster,
  CreateAppRunASG,
  CreateAppRunLoadBalancer,
  CreateAppRunCertificate,
  UpdateAppRunCertificate,
  DeleteAppRunCertificate,
  UpdateAppRunWorkerNodeDraining,
  DeleteAppRunCluster,
  DeleteAppRunApplication,
  DeleteAppRunASG,
  DeleteAppRunLoadBalancer,
  DeleteAppRunApplicationVersion,
} from '../../wailsjs/go/main/App';
import { apprun } from '../../wailsjs/go/models';
import { useGlobalReload } from '../hooks/useGlobalReload';

interface AppRunDedicatedListProps {
  profile: string;
}

type View =
  | { type: 'clusters' }
  | { type: 'cluster'; clusterId: string; clusterName: string }
  | { type: 'asg'; clusterId: string; clusterName: string; asgId: string; asgName: string }
  | { type: 'lb'; clusterId: string; clusterName: string; asgId: string; asgName: string; lbId: string; lbName: string }
  | { type: 'app'; clusterId: string; clusterName: string; appId: string; appName: string; activeVersion: number }
  | { type: 'version'; clusterId: string; clusterName: string; appId: string; appName: string; activeVersion: number; version: number };

type DeleteTarget =
  | { kind: 'cluster'; id: string; name: string }
  | { kind: 'application'; id: string; name: string; clusterId: string }
  | { kind: 'asg'; id: string; name: string; clusterId: string }
  | { kind: 'lb'; id: string; name: string; clusterId: string; asgId: string }
  | { kind: 'certificate'; id: string; name: string; clusterId: string }
  | { kind: 'version'; id: string; name: string; appId: string; version: number };

type ExposedPortFormRow = {
  targetPort: string;
  loadBalancerPort: string;
  useLetsEncrypt: boolean;
  host: string;
  healthCheckPath: string;
  healthCheckIntervalSeconds: string;
  healthCheckTimeoutSeconds: string;
};

type EnvVarFormRow = {
  key: string;
  value: string;
  secret: boolean;
};

type DeployForm = {
  image: string;
  cpu: string;
  memory: string;
  scalingMode: 'manual' | 'cpu';
  fixedScale: string;
  minScale: string;
  maxScale: string;
  scaleInThreshold: string;
  scaleOutThreshold: string;
  cmd: string;
  exposedPorts: ExposedPortFormRow[];
  envVars: EnvVarFormRow[];
};

type CreateClusterPortFormRow = {
  port: string;
  protocol: 'http' | 'https' | 'tcp';
};

type CreateClusterForm = {
  name: string;
  letsEncryptEmail: string;
  servicePrincipalID: string;
  ports: CreateClusterPortFormRow[];
};

function emptyCreateClusterForm(): CreateClusterForm {
  return {
    name: '',
    letsEncryptEmail: '',
    servicePrincipalID: '',
    ports: [{ port: '443', protocol: 'https' }],
  };
}

const WORKER_SERVICE_CLASS_PATHS = [
  { value: 'cloud/apprun/dedicated/worker/1vcpu_2gb', label: '1vCPU / 2GB' },
  { value: 'cloud/apprun/dedicated/worker/2vcpu_2gb', label: '2vCPU / 2GB' },
  { value: 'cloud/apprun/dedicated/worker/4vcpu_4gb', label: '4vCPU / 4GB' },
  { value: 'cloud/apprun/dedicated/worker/8vcpu_8gb', label: '8vCPU / 8GB' },
];

const APPRUN_ZONES = ['is1a', 'is1b', 'tk1a', 'tk1b', 'tk1v'];

// クラスタ/アプリ/ASG/LB名の共通パターン(OpenAPI仕様: apprun-dedicated openapi.json)
const RESOURCE_NAME_PATTERN = '^[a-zA-Z0-9_-]+$';
// 証明書名のみドットも許可
const CERTIFICATE_NAME_PATTERN = '^[a-zA-Z0-9_.-]+$';
const SERVICE_PRINCIPAL_ID_PATTERN = '^[0-9]{12}$';
const IPV4_PATTERN = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$';

type CreateASGInterfaceFormRow = {
  upstream: string;
  connectsToLB: boolean;
  ipPoolStart: string;
  ipPoolEnd: string;
  netmaskLen: string;
  defaultGateway: string;
  packetFilterID: string;
};

type CreateASGForm = {
  name: string;
  zone: string;
  nameServers: string[];
  workerServiceClassPath: string;
  minNodes: string;
  maxNodes: string;
  interfaces: CreateASGInterfaceFormRow[];
};

function emptyCreateASGForm(): CreateASGForm {
  return {
    name: '',
    zone: 'is1a',
    nameServers: ['133.242.0.3'],
    workerServiceClassPath: WORKER_SERVICE_CLASS_PATHS[0].value,
    minNodes: '1',
    maxNodes: '1',
    interfaces: [{ upstream: 'shared', connectsToLB: true, ipPoolStart: '', ipPoolEnd: '', netmaskLen: '', defaultGateway: '', packetFilterID: '' }],
  };
}

const LB_SERVICE_CLASS_PATHS = [
  { value: 'cloud/apprun/dedicated/lb/1vcpu_2gb', label: '1vCPU / 2GB' },
  { value: 'cloud/apprun/dedicated/lb/2vcpu_2gb', label: '2vCPU / 2GB' },
  { value: 'cloud/apprun/dedicated/lb-ha/1vcpu_2gb', label: '1vCPU / 2GB（冗長構成）' },
  { value: 'cloud/apprun/dedicated/lb-ha/2vcpu_2gb', label: '2vCPU / 2GB（冗長構成）' },
];

type CreateLBInterfaceFormRow = {
  upstream: string;
  ipPoolStart: string;
  ipPoolEnd: string;
  netmaskLen: string;
  defaultGateway: string;
  vip: string;
  virtualRouterID: string;
  packetFilterID: string;
};

type CreateLBForm = {
  name: string;
  serviceClassPath: string;
  nameServers: string[];
  interfaces: CreateLBInterfaceFormRow[];
};

function emptyCreateLBForm(): CreateLBForm {
  return {
    name: '',
    serviceClassPath: LB_SERVICE_CLASS_PATHS[0].value,
    nameServers: ['133.242.0.3'],
    interfaces: [{ upstream: 'shared', ipPoolStart: '', ipPoolEnd: '', netmaskLen: '', defaultGateway: '', vip: '', virtualRouterID: '', packetFilterID: '' }],
  };
}

type CertificateForm = {
  editingId: string | null;
  name: string;
  certificatePEM: string;
  privateKeyPEM: string;
  intermediateCertificatePEM: string;
};

function emptyCertificateForm(): CertificateForm {
  return { editingId: null, name: '', certificatePEM: '', privateKeyPEM: '', intermediateCertificatePEM: '' };
}

function emptyDeployForm(): DeployForm {
  return {
    image: '',
    cpu: '0.1',
    memory: '256',
    scalingMode: 'manual',
    fixedScale: '1',
    minScale: '1',
    maxScale: '3',
    scaleInThreshold: '30',
    scaleOutThreshold: '80',
    cmd: '',
    exposedPorts: [{ targetPort: '8080', loadBalancerPort: '', useLetsEncrypt: false, host: '', healthCheckPath: '', healthCheckIntervalSeconds: '', healthCheckTimeoutSeconds: '' }],
    envVars: [],
  };
}

export function AppRunDedicatedList({ profile }: AppRunDedicatedListProps) {
  const [view, setView] = useState<View>({ type: 'clusters' });
  const [clusters, setClusters] = useState<apprun.ClusterInfo[]>([]);
  const [apps, setApps] = useState<apprun.AppInfo[]>([]);
  const [versions, setVersions] = useState<apprun.AppVersionInfo[]>([]);
  const [asgs, setAsgs] = useState<apprun.ASGInfo[]>([]);
  const [certificates, setCertificates] = useState<apprun.CertificateInfo[]>([]);
  const [lbs, setLbs] = useState<apprun.LBInfo[]>([]);
  const [workerNodes, setWorkerNodes] = useState<apprun.WorkerNodeInfo[]>([]);
  const [lbNodes, setLbNodes] = useState<apprun.LBNodeInfo[]>([]);
  const [lbNodesMap, setLbNodesMap] = useState<Record<string, apprun.LBNodeInfo[]>>({});
  const [versionDetail, setVersionDetail] = useState<apprun.AppVersionDetailInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearingActiveVersion, setClearingActiveVersion] = useState(false);
  const [settingActiveVersion, setSettingActiveVersion] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deployForm, setDeployForm] = useState<DeployForm | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [createAppName, setCreateAppName] = useState<string | null>(null);
  const [creatingApp, setCreatingApp] = useState(false);
  const [createAppError, setCreateAppError] = useState<string | null>(null);
  const [updatingDrainingId, setUpdatingDrainingId] = useState<string | null>(null);
  const [createClusterForm, setCreateClusterForm] = useState<CreateClusterForm | null>(null);
  const [creatingCluster, setCreatingCluster] = useState(false);
  const [createClusterError, setCreateClusterError] = useState<string | null>(null);
  const [createASGForm, setCreateASGForm] = useState<CreateASGForm | null>(null);
  const [creatingASG, setCreatingASG] = useState(false);
  const [createASGError, setCreateASGError] = useState<string | null>(null);
  const [createLBForm, setCreateLBForm] = useState<CreateLBForm | null>(null);
  const [creatingLB, setCreatingLB] = useState(false);
  const [createLBError, setCreateLBError] = useState<string | null>(null);
  const [certificateForm, setCertificateForm] = useState<CertificateForm | null>(null);
  const [savingCertificate, setSavingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);

  const loadClusters = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await GetAppRunClusters(profile);
      setClusters(list || []);
    } catch (err) {
      console.error('[AppRunList] loadClusters error:', err);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadClusterDetails = useCallback(async (clusterId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const [appList, asgList, certList] = await Promise.all([
        GetAppRunApplications(profile, clusterId),
        GetAppRunASGs(profile, clusterId),
        GetAppRunCertificates(profile, clusterId),
      ]);
      setApps(appList || []);
      setAsgs(asgList || []);
      setCertificates(certList || []);
    } catch (err) {
      console.error('[AppRunList] loadClusterDetails error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadAppVersions = useCallback(async (appId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await GetAppRunApplicationVersions(profile, appId);
      setVersions(list || []);
    } catch (err) {
      console.error('[AppRunList] loadAppVersions error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadASGDetails = useCallback(async (clusterId: string, asgId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const [lbList, nodeList] = await Promise.all([
        GetAppRunLoadBalancers(profile, clusterId, asgId),
        GetAppRunWorkerNodes(profile, clusterId, asgId),
      ]);
      setLbs(lbList || []);
      setWorkerNodes(nodeList || []);

      // 各LBのノード情報も取得
      const nodesMap: Record<string, apprun.LBNodeInfo[]> = {};
      if (lbList && lbList.length > 0) {
        const nodePromises = lbList.map(async (lb) => {
          try {
            const nodes = await GetAppRunLBNodes(profile, clusterId, asgId, lb.id);
            return { lbId: lb.id, nodes: nodes || [] };
          } catch {
            return { lbId: lb.id, nodes: [] };
          }
        });
        const results = await Promise.all(nodePromises);
        for (const { lbId, nodes } of results) {
          nodesMap[lbId] = nodes;
        }
      }
      setLbNodesMap(nodesMap);
    } catch (err) {
      console.error('[AppRunList] loadASGDetails error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadLBNodes = useCallback(async (clusterId: string, asgId: string, lbId: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const list = await GetAppRunLBNodes(profile, clusterId, asgId, lbId);
      setLbNodes(list || []);
    } catch (err) {
      console.error('[AppRunList] loadLBNodes error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const loadVersionDetail = useCallback(async (appId: string, version: number) => {
    if (!profile) return;
    setLoading(true);
    try {
      const detail = await GetAppRunApplicationVersion(profile, appId, version);
      setVersionDetail(detail);
    } catch (err) {
      console.error('[AppRunList] loadVersionDetail error:', err);
      setVersionDetail(null);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleClearActiveVersion = async (appId: string, clusterId: string, clusterName: string, appName: string) => {
    if (!profile) return;
    setClearingActiveVersion(true);
    try {
      await ClearAppRunActiveVersion(profile, appId);
      // 成功したらビューを更新（activeVersionを0に）
      setView({
        type: 'app',
        clusterId,
        clusterName,
        appId,
        appName,
        activeVersion: 0
      });
      // バージョン一覧を再読み込み
      await loadAppVersions(appId);
    } catch (err) {
      console.error('[AppRunList] handleClearActiveVersion error:', err);
      alert('アクティブバージョンのクリアに失敗しました');
    } finally {
      setClearingActiveVersion(false);
    }
  };

  const handleSetActiveVersion = async (appId: string, clusterId: string, clusterName: string, appName: string, version: number) => {
    if (!profile) return;
    setSettingActiveVersion(true);
    setShowVersionMenu(false);
    try {
      await SetAppRunActiveVersion(profile, appId, version);
      // 成功したらビューを更新
      setView({
        type: 'version',
        clusterId,
        clusterName,
        appId,
        appName,
        activeVersion: version,
        version
      });
    } catch (err) {
      console.error('[AppRunList] handleSetActiveVersion error:', err);
      alert('アクティブバージョンの設定に失敗しました');
    } finally {
      setSettingActiveVersion(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, target: DeleteTarget) => {
    e.stopPropagation();
    setConfirmDelete(target);
  };

  const handleDeleteCancel = () => {
    setConfirmDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete || !profile) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(target.id);
    try {
      switch (target.kind) {
        case 'cluster':
          await DeleteAppRunCluster(profile, target.id);
          await loadClusters();
          break;
        case 'application':
          await DeleteAppRunApplication(profile, target.id);
          await loadClusterDetails(target.clusterId);
          break;
        case 'asg':
          await DeleteAppRunASG(profile, target.clusterId, target.id);
          await loadClusterDetails(target.clusterId);
          break;
        case 'lb':
          await DeleteAppRunLoadBalancer(profile, target.clusterId, target.asgId, target.id);
          await loadASGDetails(target.clusterId, target.asgId);
          break;
        case 'certificate':
          await DeleteAppRunCertificate(profile, target.clusterId, target.id);
          await loadClusterDetails(target.clusterId);
          break;
        case 'version':
          await DeleteAppRunApplicationVersion(profile, target.appId, target.version);
          if (view.type === 'version' && view.appId === target.appId && view.version === target.version) {
            setView({
              type: 'app',
              clusterId: view.clusterId,
              clusterName: view.clusterName,
              appId: view.appId,
              appName: view.appName,
              activeVersion: view.activeVersion,
            });
          } else {
            await loadAppVersions(target.appId);
          }
          break;
      }
    } catch (err) {
      console.error('[AppRunList] delete error:', err);
      alert(`削除に失敗しました: ${err}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeployOpen = () => {
    setDeployError(null);
    setDeployForm(emptyDeployForm());
  };

  const handleDeployCancel = () => {
    setDeployForm(null);
    setDeployError(null);
  };

  const handleExposedPortAdd = () => {
    if (!deployForm) return;
    setDeployForm({
      ...deployForm,
      exposedPorts: [...deployForm.exposedPorts, { targetPort: '', loadBalancerPort: '', useLetsEncrypt: false, host: '', healthCheckPath: '', healthCheckIntervalSeconds: '', healthCheckTimeoutSeconds: '' }],
    });
  };

  const handleExposedPortRemove = (index: number) => {
    if (!deployForm) return;
    setDeployForm({
      ...deployForm,
      exposedPorts: deployForm.exposedPorts.filter((_, i) => i !== index),
    });
  };

  const handleExposedPortChange = (index: number, field: keyof ExposedPortFormRow, value: string | boolean) => {
    if (!deployForm) return;
    setDeployForm({
      ...deployForm,
      exposedPorts: deployForm.exposedPorts.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    });
  };

  const handleEnvVarAdd = () => {
    if (!deployForm) return;
    setDeployForm({
      ...deployForm,
      envVars: [...deployForm.envVars, { key: '', value: '', secret: false }],
    });
  };

  const handleEnvVarRemove = (index: number) => {
    if (!deployForm) return;
    setDeployForm({
      ...deployForm,
      envVars: deployForm.envVars.filter((_, i) => i !== index),
    });
  };

  const handleEnvVarChange = (index: number, field: keyof EnvVarFormRow, value: string | boolean) => {
    if (!deployForm) return;
    setDeployForm({
      ...deployForm,
      envVars: deployForm.envVars.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    });
  };

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployForm || view.type !== 'app') return;

    const cpuVCPU = parseFloat(deployForm.cpu);
    const memory = parseInt(deployForm.memory, 10);
    // APIはCPUをミリvCPU単位(1000 = 1vCPU)の整数で受け取る
    const cpu = Math.round(cpuVCPU * 1000);

    const exposedPorts: apprun.CreateExposedPortParams[] = deployForm.exposedPorts.map((p) => {
      const targetPort = parseInt(p.targetPort, 10);
      const loadBalancerPort = p.loadBalancerPort ? parseInt(p.loadBalancerPort, 10) : undefined;
      let healthCheck: apprun.CreateHealthCheckParams | undefined;
      if (p.healthCheckPath) {
        const intervalSeconds = parseInt(p.healthCheckIntervalSeconds || '10', 10);
        const timeoutSeconds = parseInt(p.healthCheckTimeoutSeconds || '5', 10);
        healthCheck = new apprun.CreateHealthCheckParams({ path: p.healthCheckPath, intervalSeconds, timeoutSeconds });
      }
      return new apprun.CreateExposedPortParams({
        targetPort,
        loadBalancerPort,
        useLetsEncrypt: p.useLetsEncrypt,
        host: p.host ? p.host.split(',').map((h) => h.trim()).filter(Boolean) : [],
        healthCheck,
      });
    });

    const envVars: apprun.CreateEnvVarParams[] = deployForm.envVars.map((e) => new apprun.CreateEnvVarParams({
      key: e.key,
      value: e.value || undefined,
      secret: e.secret,
    }));

    const params: Record<string, unknown> = {
      cpu,
      memory,
      scalingMode: deployForm.scalingMode,
      image: deployForm.image.trim(),
      cmd: deployForm.cmd.trim() ? deployForm.cmd.trim().split(/\s+/) : [],
      exposedPorts,
      envVars,
    };
    if (deployForm.scalingMode === 'manual') {
      params.fixedScale = parseInt(deployForm.fixedScale, 10);
    } else {
      params.minScale = parseInt(deployForm.minScale, 10);
      params.maxScale = parseInt(deployForm.maxScale, 10);
      params.scaleInThreshold = parseInt(deployForm.scaleInThreshold, 10);
      params.scaleOutThreshold = parseInt(deployForm.scaleOutThreshold, 10);
    }

    setDeploying(true);
    setDeployError(null);
    try {
      await CreateAppRunApplicationVersion(profile, view.appId, new apprun.CreateAppVersionParams(params));
      setDeployForm(null);
      await loadAppVersions(view.appId);
    } catch (e) {
      setDeployError(String(e));
    } finally {
      setDeploying(false);
    }
  };

  const handleCreateAppOpen = () => {
    setCreateAppError(null);
    setCreateAppName('');
  };

  const handleCreateAppCancel = () => {
    setCreateAppName(null);
    setCreateAppError(null);
  };

  const handleCreateAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createAppName === null || view.type !== 'cluster') return;

    setCreatingApp(true);
    setCreateAppError(null);
    try {
      await CreateAppRunApplication(profile, view.clusterId, createAppName.trim());
      setCreateAppName(null);
      await loadClusterDetails(view.clusterId);
    } catch (e) {
      setCreateAppError(String(e));
    } finally {
      setCreatingApp(false);
    }
  };

  const handleCreateClusterOpen = () => {
    setCreateClusterError(null);
    setCreateClusterForm(emptyCreateClusterForm());
  };

  const handleCreateClusterCancel = () => {
    setCreateClusterForm(null);
    setCreateClusterError(null);
  };

  const handleAddClusterPort = () => {
    if (!createClusterForm) return;
    setCreateClusterForm({
      ...createClusterForm,
      ports: [...createClusterForm.ports, { port: '', protocol: 'https' }],
    });
  };

  const handleRemoveClusterPort = (index: number) => {
    if (!createClusterForm) return;
    setCreateClusterForm({
      ...createClusterForm,
      ports: createClusterForm.ports.filter((_, i) => i !== index),
    });
  };

  const handleClusterPortChange = (index: number, field: 'port' | 'protocol', value: string) => {
    if (!createClusterForm) return;
    const ports = createClusterForm.ports.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    setCreateClusterForm({ ...createClusterForm, ports } as CreateClusterForm);
  };

  const handleCreateClusterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createClusterForm) return;

    setCreatingCluster(true);
    setCreateClusterError(null);
    try {
      await CreateAppRunCluster(profile, new apprun.CreateClusterParams({
        name: createClusterForm.name.trim(),
        letsEncryptEmail: createClusterForm.letsEncryptEmail.trim() || undefined,
        servicePrincipalID: createClusterForm.servicePrincipalID.trim(),
        ports: createClusterForm.ports.map((p) => new apprun.CreateClusterPortParams({
          port: Number(p.port),
          protocol: p.protocol,
        })),
      }));
      setCreateClusterForm(null);
      await loadClusters();
    } catch (e) {
      setCreateClusterError(String(e));
    } finally {
      setCreatingCluster(false);
    }
  };

  const handleCreateASGOpen = () => {
    setCreateASGError(null);
    setCreateASGForm(emptyCreateASGForm());
  };

  const handleCreateASGCancel = () => {
    setCreateASGForm(null);
    setCreateASGError(null);
  };

  const handleAddASGNameServer = () => {
    if (!createASGForm) return;
    setCreateASGForm({ ...createASGForm, nameServers: [...createASGForm.nameServers, ''] });
  };

  const handleRemoveASGNameServer = (index: number) => {
    if (!createASGForm) return;
    setCreateASGForm({ ...createASGForm, nameServers: createASGForm.nameServers.filter((_, i) => i !== index) });
  };

  const handleASGNameServerChange = (index: number, value: string) => {
    if (!createASGForm) return;
    const nameServers = createASGForm.nameServers.map((v, i) => (i === index ? value : v));
    setCreateASGForm({ ...createASGForm, nameServers });
  };

  const handleAddASGInterface = () => {
    if (!createASGForm) return;
    setCreateASGForm({
      ...createASGForm,
      interfaces: [...createASGForm.interfaces, { upstream: '', connectsToLB: false, ipPoolStart: '', ipPoolEnd: '', netmaskLen: '', defaultGateway: '', packetFilterID: '' }],
    });
  };

  const handleRemoveASGInterface = (index: number) => {
    if (!createASGForm) return;
    setCreateASGForm({ ...createASGForm, interfaces: createASGForm.interfaces.filter((_, i) => i !== index) });
  };

  const handleASGInterfaceChange = (index: number, field: keyof CreateASGInterfaceFormRow, value: string | boolean) => {
    if (!createASGForm) return;
    const interfaces = createASGForm.interfaces.map((iface, i) => (i === index ? { ...iface, [field]: value } : iface));
    setCreateASGForm({ ...createASGForm, interfaces });
  };

  const handleCreateASGSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createASGForm || view.type !== 'cluster') return;
    const minNodes = Number(createASGForm.minNodes);
    const maxNodes = Number(createASGForm.maxNodes);
    // min/maxの大小関係はHTML5のmin/max属性だけでは表現できないクロスフィールドの制約なので引き続きJSでチェックする
    if (minNodes > maxNodes) {
      setCreateASGError('最小ノード数は最大ノード数以下で指定してください');
      return;
    }

    setCreatingASG(true);
    setCreateASGError(null);
    try {
      await CreateAppRunASG(profile, view.clusterId, new apprun.CreateASGParams({
        name: createASGForm.name.trim(),
        zone: createASGForm.zone,
        nameServers: createASGForm.nameServers.map((ns) => ns.trim()),
        workerServiceClassPath: createASGForm.workerServiceClassPath,
        minNodes,
        maxNodes,
        interfaces: createASGForm.interfaces.map((iface, i) => new apprun.CreateASGInterfaceParams({
          interfaceIndex: i,
          upstream: iface.upstream.trim(),
          connectsToLB: iface.connectsToLB,
          ipPool: iface.upstream.trim() === 'shared' || (!iface.ipPoolStart.trim() && !iface.ipPoolEnd.trim())
            ? undefined
            : [new apprun.CreateIPRangeParams({ start: iface.ipPoolStart.trim(), end: iface.ipPoolEnd.trim() })],
          netmaskLen: iface.netmaskLen.trim() ? Number(iface.netmaskLen) : undefined,
          defaultGateway: iface.defaultGateway.trim() || undefined,
          packetFilterID: iface.packetFilterID.trim() || undefined,
        })),
      }));
      setCreateASGForm(null);
      await loadClusterDetails(view.clusterId);
    } catch (e) {
      setCreateASGError(String(e));
    } finally {
      setCreatingASG(false);
    }
  };

  const handleCreateLBOpen = () => {
    setCreateLBError(null);
    setCreateLBForm(emptyCreateLBForm());
  };

  const handleCreateLBCancel = () => {
    setCreateLBForm(null);
    setCreateLBError(null);
  };

  const handleAddLBNameServer = () => {
    if (!createLBForm) return;
    setCreateLBForm({ ...createLBForm, nameServers: [...createLBForm.nameServers, ''] });
  };

  const handleRemoveLBNameServer = (index: number) => {
    if (!createLBForm) return;
    setCreateLBForm({ ...createLBForm, nameServers: createLBForm.nameServers.filter((_, i) => i !== index) });
  };

  const handleLBNameServerChange = (index: number, value: string) => {
    if (!createLBForm) return;
    const nameServers = createLBForm.nameServers.map((v, i) => (i === index ? value : v));
    setCreateLBForm({ ...createLBForm, nameServers });
  };

  const handleAddLBInterface = () => {
    if (!createLBForm) return;
    setCreateLBForm({
      ...createLBForm,
      interfaces: [...createLBForm.interfaces, { upstream: '', ipPoolStart: '', ipPoolEnd: '', netmaskLen: '', defaultGateway: '', vip: '', virtualRouterID: '', packetFilterID: '' }],
    });
  };

  const handleRemoveLBInterface = (index: number) => {
    if (!createLBForm) return;
    setCreateLBForm({ ...createLBForm, interfaces: createLBForm.interfaces.filter((_, i) => i !== index) });
  };

  const handleLBInterfaceChange = (index: number, field: keyof CreateLBInterfaceFormRow, value: string) => {
    if (!createLBForm) return;
    const interfaces = createLBForm.interfaces.map((iface, i) => (i === index ? { ...iface, [field]: value } : iface));
    setCreateLBForm({ ...createLBForm, interfaces });
  };

  const handleCreateLBSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createLBForm || view.type !== 'asg') return;

    setCreatingLB(true);
    setCreateLBError(null);
    try {
      await CreateAppRunLoadBalancer(profile, view.clusterId, view.asgId, new apprun.CreateLBParams({
        name: createLBForm.name.trim(),
        serviceClassPath: createLBForm.serviceClassPath,
        nameServers: createLBForm.nameServers.map((ns) => ns.trim()),
        interfaces: createLBForm.interfaces.map((iface, i) => new apprun.CreateLBInterfaceParams({
          interfaceIndex: i,
          upstream: iface.upstream.trim(),
          ipPool: iface.upstream.trim() === 'shared' || (!iface.ipPoolStart.trim() && !iface.ipPoolEnd.trim())
            ? undefined
            : [new apprun.CreateIPRangeParams({ start: iface.ipPoolStart.trim(), end: iface.ipPoolEnd.trim() })],
          netmaskLen: iface.netmaskLen.trim() ? Number(iface.netmaskLen) : undefined,
          defaultGateway: iface.defaultGateway.trim() || undefined,
          vip: iface.vip.trim() || undefined,
          virtualRouterID: iface.virtualRouterID.trim() ? Number(iface.virtualRouterID) : undefined,
          packetFilterID: iface.packetFilterID.trim() || undefined,
        })),
      }));
      setCreateLBForm(null);
      await loadASGDetails(view.clusterId, view.asgId);
    } catch (e) {
      setCreateLBError(String(e));
    } finally {
      setCreatingLB(false);
    }
  };

  const handleCreateCertificateOpen = () => {
    setCertificateError(null);
    setCertificateForm(emptyCertificateForm());
  };

  const handleEditCertificateOpen = (cert: apprun.CertificateInfo) => {
    setCertificateError(null);
    setCertificateForm({ editingId: cert.id, name: cert.name, certificatePEM: '', privateKeyPEM: '', intermediateCertificatePEM: '' });
  };

  const handleCertificateCancel = () => {
    setCertificateForm(null);
    setCertificateError(null);
  };

  const handleCertificateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certificateForm || view.type !== 'cluster') return;

    setSavingCertificate(true);
    setCertificateError(null);
    try {
      const params = new apprun.CreateCertificateParams({
        name: certificateForm.name.trim(),
        certificatePem: certificateForm.certificatePEM.trim(),
        privateKeyPem: certificateForm.privateKeyPEM.trim(),
        intermediateCertificatePem: certificateForm.intermediateCertificatePEM.trim() || undefined,
      });
      if (certificateForm.editingId) {
        await UpdateAppRunCertificate(profile, view.clusterId, certificateForm.editingId, params);
      } else {
        await CreateAppRunCertificate(profile, view.clusterId, params);
      }
      setCertificateForm(null);
      await loadClusterDetails(view.clusterId);
    } catch (e) {
      setCertificateError(String(e));
    } finally {
      setSavingCertificate(false);
    }
  };

  const handleToggleDraining = async (nodeId: string, draining: boolean) => {
    if (!profile || view.type !== 'asg') return;
    setUpdatingDrainingId(nodeId);
    try {
      await UpdateAppRunWorkerNodeDraining(profile, view.clusterId, view.asgId, nodeId, draining);
      await loadASGDetails(view.clusterId, view.asgId);
    } catch (err) {
      console.error('[AppRunList] handleToggleDraining error:', err);
      alert(`Draining状態の変更に失敗しました: ${err}`);
    } finally {
      setUpdatingDrainingId(null);
    }
  };

  const handleGlobalReload = useCallback(() => {
    if (view.type === 'clusters') {
      loadClusters();
    } else if (view.type === 'cluster') {
      loadClusterDetails(view.clusterId);
    } else if (view.type === 'app') {
      loadAppVersions(view.appId);
    } else if (view.type === 'asg') {
      loadASGDetails(view.clusterId, view.asgId);
    } else if (view.type === 'lb') {
      loadLBNodes(view.clusterId, view.asgId, view.lbId);
    } else if (view.type === 'version') {
      loadVersionDetail(view.appId, view.version);
    }
  }, [view, loadClusters, loadClusterDetails, loadAppVersions, loadASGDetails, loadLBNodes, loadVersionDetail]);

  useGlobalReload(handleGlobalReload);

  useEffect(() => {
    handleGlobalReload();
  }, [handleGlobalReload]);

  const renderBreadcrumb = () => {
    const items: { label: string; onClick?: () => void }[] = [];

    items.push({
      label: 'クラスタ',
      onClick: view.type !== 'clusters' ? () => setView({ type: 'clusters' }) : undefined,
    });

    if (view.type === 'cluster' || view.type === 'asg' || view.type === 'lb' || view.type === 'app' || view.type === 'version') {
      const clusterName = view.clusterName;
      const clusterId = view.clusterId;
      items.push({
        label: clusterName,
        onClick: view.type !== 'cluster' ? () => setView({ type: 'cluster', clusterId, clusterName }) : undefined,
      });
    }

    if (view.type === 'asg' || view.type === 'lb') {
      items.push({
        label: view.asgName,
        onClick: view.type !== 'asg' ? () => setView({
          type: 'asg',
          clusterId: view.clusterId,
          clusterName: view.clusterName,
          asgId: view.asgId,
          asgName: view.asgName
        }) : undefined,
      });
    }

    if (view.type === 'lb') {
      items.push({ label: view.lbName });
    }

    if (view.type === 'app' || view.type === 'version') {
      items.push({
        label: view.appName,
        onClick: view.type === 'version' ? () => setView({
          type: 'app',
          clusterId: view.clusterId,
          clusterName: view.clusterName,
          appId: view.appId,
          appName: view.appName,
          activeVersion: view.activeVersion
        }) : undefined,
      });
    }

    if (view.type === 'version') {
      items.push({ label: `v${view.version}` });
    }

    return (
      <div className="breadcrumb">
        {items.map((item, idx) => (
          <span key={idx}>
            {idx > 0 && <span className="breadcrumb-separator"> / </span>}
            <span
              className={`breadcrumb-item ${!item.onClick ? 'active' : ''}`}
              onClick={item.onClick}
            >
              {item.label}
            </span>
          </span>
        ))}
      </div>
    );
  };

  const renderConfirmDialog = () => {
    if (!confirmDelete) return null;
    return (
      <div className="confirm-overlay" onClick={handleDeleteCancel}>
        <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
          <p>「{confirmDelete.name}」を削除しますか？</p>
          <p className="confirm-warning">この操作は取り消せません。</p>
          <div className="confirm-actions">
            <button className="btn btn-secondary" onClick={handleDeleteCancel}>キャンセル</button>
            <button className="btn btn-danger" onClick={handleDeleteConfirm}>削除する</button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateClusterModal = () => {
    if (!createClusterForm) return null;
    return (
      <div className="modal-overlay" onClick={handleCreateClusterCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '420px', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>クラスタを作成</h3>
          <form onSubmit={handleCreateClusterSubmit}>
          <div className="form-group">
            <label>クラスタ名<span className="required-mark">*</span></label>
            <input
              type="text"
              value={createClusterForm.name}
              onChange={(e) => setCreateClusterForm({ ...createClusterForm, name: e.target.value })}
              placeholder="my-cluster"
              pattern={RESOURCE_NAME_PATTERN}
              title="半角英数字、アンダースコア、ハイフンのみ使用できます"
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>サービスプリンシパルID<span className="required-mark">*</span></label>
            <input
              type="text"
              value={createClusterForm.servicePrincipalID}
              onChange={(e) => setCreateClusterForm({ ...createClusterForm, servicePrincipalID: e.target.value })}
              placeholder="123456789012"
              pattern={SERVICE_PRINCIPAL_ID_PATTERN}
              title="12桁の数字を入力してください"
              maxLength={12}
              required
            />
          </div>
          <div className="form-group">
            <label>Let's Encryptメールアドレス（任意）</label>
            <input
              type="email"
              value={createClusterForm.letsEncryptEmail}
              onChange={(e) => setCreateClusterForm({ ...createClusterForm, letsEncryptEmail: e.target.value })}
              placeholder="admin@example.com"
            />
          </div>
          <div className="form-group">
            <label>待ち受けポート<span className="required-mark">*</span></label>
            {createClusterForm.ports.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  value={p.port}
                  onChange={(e) => handleClusterPortChange(i, 'port', e.target.value)}
                  placeholder="443"
                  min={1}
                  max={65535}
                  required
                  style={{ width: '100px' }}
                />
                <select
                  value={p.protocol}
                  onChange={(e) => handleClusterPortChange(i, 'protocol', e.target.value)}
                >
                  <option value="http">http</option>
                  <option value="https">https</option>
                  <option value="tcp">tcp</option>
                </select>
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => handleRemoveClusterPort(i)}
                  disabled={createClusterForm.ports.length <= 1}
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleAddClusterPort}
              disabled={createClusterForm.ports.length >= 5}
            >
              + ポート追加
            </button>
          </div>
          {createClusterError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {createClusterError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCreateClusterCancel}>キャンセル</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingCluster}
            >
              {creatingCluster ? '作成中...' : '作成する'}
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  };

  const renderCreateASGModal = () => {
    if (!createASGForm) return null;
    return (
      <div className="modal-overlay" onClick={handleCreateASGCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '480px', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Auto Scaling Groupを作成</h3>
          <form onSubmit={handleCreateASGSubmit}>
          <div className="form-group">
            <label>ASG名<span className="required-mark">*</span></label>
            <input
              type="text"
              value={createASGForm.name}
              onChange={(e) => setCreateASGForm({ ...createASGForm, name: e.target.value })}
              placeholder="my-asg"
              pattern={RESOURCE_NAME_PATTERN}
              title="半角英数字、アンダースコア、ハイフンのみ使用できます"
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>ゾーン</label>
              <select
                value={createASGForm.zone}
                onChange={(e) => setCreateASGForm({ ...createASGForm, zone: e.target.value })}
              >
                {APPRUN_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>ワーカープラン</label>
              <select
                value={createASGForm.workerServiceClassPath}
                onChange={(e) => setCreateASGForm({ ...createASGForm, workerServiceClassPath: e.target.value })}
              >
                {WORKER_SERVICE_CLASS_PATHS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>最小ノード数<span className="required-mark">*</span></label>
              <input
                type="number"
                value={createASGForm.minNodes}
                onChange={(e) => setCreateASGForm({ ...createASGForm, minNodes: e.target.value })}
                min={1}
                max={10}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>最大ノード数<span className="required-mark">*</span></label>
              <input
                type="number"
                value={createASGForm.maxNodes}
                onChange={(e) => setCreateASGForm({ ...createASGForm, maxNodes: e.target.value })}
                min={1}
                max={10}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>ネームサーバー</label>
            {createASGForm.nameServers.map((ns, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={ns}
                  onChange={(e) => handleASGNameServerChange(i, e.target.value)}
                  placeholder="133.242.0.3 *"
                  pattern={IPV4_PATTERN}
                  title="IPv4アドレスの形式で入力してください"
                  required
                />
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => handleRemoveASGNameServer(i)}
                  disabled={createASGForm.nameServers.length <= 1}
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleAddASGNameServer}
              disabled={createASGForm.nameServers.length >= 3}
            >
              + ネームサーバー追加
            </button>
          </div>
          <div className="form-group">
            <label>ネットワークインターフェース</label>
            {createASGForm.interfaces.map((iface, i) => {
              const isShared = iface.upstream.trim() === 'shared';
              return (
              <div key={i} style={{ border: '1px solid #333', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#999' }}>eth{i}</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => handleRemoveASGInterface(i)}
                    disabled={createASGForm.interfaces.length <= 1}
                  >
                    削除
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={iface.upstream}
                    onChange={(e) => handleASGInterfaceChange(i, 'upstream', e.target.value)}
                    placeholder="shared またはスイッチID *"
                    required
                    style={{ flex: 1 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={iface.connectsToLB}
                      onChange={(e) => handleASGInterfaceChange(i, 'connectsToLB', e.target.checked)}
                    />
                    LBに接続
                  </label>
                </div>
                {!isShared && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={iface.ipPoolStart}
                      onChange={(e) => handleASGInterfaceChange(i, 'ipPoolStart', e.target.value)}
                      placeholder="IPプール開始 *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '130px' }}
                    />
                    <input
                      type="text"
                      value={iface.ipPoolEnd}
                      onChange={(e) => handleASGInterfaceChange(i, 'ipPoolEnd', e.target.value)}
                      placeholder="IPプール終了 *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '130px' }}
                    />
                    <input
                      type="number"
                      value={iface.netmaskLen}
                      onChange={(e) => handleASGInterfaceChange(i, 'netmaskLen', e.target.value)}
                      placeholder="ネットマスク長 *"
                      min={8}
                      max={29}
                      required
                      style={{ width: '110px' }}
                    />
                    <input
                      type="text"
                      value={iface.defaultGateway}
                      onChange={(e) => handleASGInterfaceChange(i, 'defaultGateway', e.target.value)}
                      placeholder="デフォルトゲートウェイ *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '150px' }}
                    />
                    <input
                      type="text"
                      value={iface.packetFilterID}
                      onChange={(e) => handleASGInterfaceChange(i, 'packetFilterID', e.target.value)}
                      placeholder="パケットフィルタID(任意)"
                      style={{ width: '160px' }}
                    />
                  </div>
                )}
              </div>
              );
            })}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleAddASGInterface}
              disabled={createASGForm.interfaces.length >= 5}
            >
              + インターフェース追加
            </button>
          </div>
          {createASGError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {createASGError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCreateASGCancel}>キャンセル</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingASG}
            >
              {creatingASG ? '作成中...' : '作成する'}
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  };

  const renderCertificateModal = () => {
    if (!certificateForm) return null;
    return (
      <div className="modal-overlay" onClick={handleCertificateCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '480px', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>
            {certificateForm.editingId ? '証明書を更新' : '証明書を作成'}
          </h3>
          <form onSubmit={handleCertificateSubmit}>
          <div className="form-group">
            <label>証明書名<span className="required-mark">*</span></label>
            <input
              type="text"
              value={certificateForm.name}
              onChange={(e) => setCertificateForm({ ...certificateForm, name: e.target.value })}
              placeholder="my-cert"
              pattern={CERTIFICATE_NAME_PATTERN}
              title="半角英数字、アンダースコア、ハイフン、ドットのみ使用できます"
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>証明書(PEM)<span className="required-mark">*</span></label>
            <textarea
              value={certificateForm.certificatePEM}
              onChange={(e) => setCertificateForm({ ...certificateForm, certificatePEM: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----"
              rows={5}
              required
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
          </div>
          <div className="form-group">
            <label>秘密鍵(PEM)<span className="required-mark">*</span></label>
            <textarea
              value={certificateForm.privateKeyPEM}
              onChange={(e) => setCertificateForm({ ...certificateForm, privateKeyPEM: e.target.value })}
              placeholder="-----BEGIN PRIVATE KEY-----"
              rows={5}
              required
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
          </div>
          <div className="form-group">
            <label>中間証明書(PEM、任意)</label>
            <textarea
              value={certificateForm.intermediateCertificatePEM}
              onChange={(e) => setCertificateForm({ ...certificateForm, intermediateCertificatePEM: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE----- (中間証明書)"
              rows={3}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
            />
          </div>
          {certificateForm.editingId && (
            <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              APIの仕様上、更新時も証明書・秘密鍵を再入力する必要があります(取得済みの内容は表示されません)。
            </div>
          )}
          {certificateError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {certificateError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCertificateCancel}>キャンセル</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingCertificate}
            >
              {savingCertificate ? '保存中...' : certificateForm.editingId ? '更新する' : '作成する'}
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  };

  const renderCreateLBModal = () => {
    if (!createLBForm) return null;
    return (
      <div className="modal-overlay" onClick={handleCreateLBCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '480px', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>ロードバランサーを作成</h3>
          <form onSubmit={handleCreateLBSubmit}>
          <div className="form-group">
            <label>LB名<span className="required-mark">*</span></label>
            <input
              type="text"
              value={createLBForm.name}
              onChange={(e) => setCreateLBForm({ ...createLBForm, name: e.target.value })}
              placeholder="my-lb"
              pattern={RESOURCE_NAME_PATTERN}
              title="半角英数字、アンダースコア、ハイフンのみ使用できます"
              maxLength={20}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>プラン</label>
            <select
              value={createLBForm.serviceClassPath}
              onChange={(e) => setCreateLBForm({ ...createLBForm, serviceClassPath: e.target.value })}
            >
              {LB_SERVICE_CLASS_PATHS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>ネームサーバー</label>
            {createLBForm.nameServers.map((ns, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={ns}
                  onChange={(e) => handleLBNameServerChange(i, e.target.value)}
                  placeholder="133.242.0.3 *"
                  pattern={IPV4_PATTERN}
                  title="IPv4アドレスの形式で入力してください"
                  required
                />
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => handleRemoveLBNameServer(i)}
                  disabled={createLBForm.nameServers.length <= 1}
                >
                  削除
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleAddLBNameServer}
              disabled={createLBForm.nameServers.length >= 3}
            >
              + ネームサーバー追加
            </button>
          </div>
          <div className="form-group">
            <label>ネットワークインターフェース</label>
            {createLBForm.interfaces.map((iface, i) => {
              const isShared = iface.upstream.trim() === 'shared';
              return (
              <div key={i} style={{ border: '1px solid #333', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#999' }}>eth{i}</span>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => handleRemoveLBInterface(i)}
                    disabled={createLBForm.interfaces.length <= 1}
                  >
                    削除
                  </button>
                </div>
                <input
                  type="text"
                  value={iface.upstream}
                  onChange={(e) => handleLBInterfaceChange(i, 'upstream', e.target.value)}
                  placeholder="shared またはスイッチID *"
                  required
                  style={{ marginTop: '0.5rem', width: '100%' }}
                />
                {!isShared && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={iface.ipPoolStart}
                      onChange={(e) => handleLBInterfaceChange(i, 'ipPoolStart', e.target.value)}
                      placeholder="IPプール開始 *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '130px' }}
                    />
                    <input
                      type="text"
                      value={iface.ipPoolEnd}
                      onChange={(e) => handleLBInterfaceChange(i, 'ipPoolEnd', e.target.value)}
                      placeholder="IPプール終了 *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '130px' }}
                    />
                    <input
                      type="number"
                      value={iface.netmaskLen}
                      onChange={(e) => handleLBInterfaceChange(i, 'netmaskLen', e.target.value)}
                      placeholder="ネットマスク長 *"
                      min={8}
                      max={29}
                      required
                      style={{ width: '110px' }}
                    />
                    <input
                      type="text"
                      value={iface.defaultGateway}
                      onChange={(e) => handleLBInterfaceChange(i, 'defaultGateway', e.target.value)}
                      placeholder="デフォルトゲートウェイ *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '150px' }}
                    />
                    <input
                      type="text"
                      value={iface.vip}
                      onChange={(e) => handleLBInterfaceChange(i, 'vip', e.target.value)}
                      placeholder="VIP *"
                      pattern={IPV4_PATTERN}
                      title="IPv4アドレスの形式で入力してください"
                      required
                      style={{ width: '130px' }}
                    />
                    <input
                      type="number"
                      value={iface.virtualRouterID}
                      onChange={(e) => handleLBInterfaceChange(i, 'virtualRouterID', e.target.value)}
                      placeholder="仮想ルータID *"
                      min={1}
                      max={255}
                      required
                      style={{ width: '110px' }}
                    />
                    <input
                      type="text"
                      value={iface.packetFilterID}
                      onChange={(e) => handleLBInterfaceChange(i, 'packetFilterID', e.target.value)}
                      placeholder="パケットフィルタID(任意)"
                      style={{ width: '160px' }}
                    />
                  </div>
                )}
              </div>
              );
            })}
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={handleAddLBInterface}
              disabled={createLBForm.interfaces.length >= 5}
            >
              + インターフェース追加
            </button>
          </div>
          {createLBError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {createLBError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCreateLBCancel}>キャンセル</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingLB}
            >
              {creatingLB ? '作成中...' : '作成する'}
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  };

  const renderCreateAppModal = () => {
    if (createAppName === null) return null;
    return (
      <div className="modal-overlay" onClick={handleCreateAppCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '360px',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>アプリケーションを作成</h3>
          <form onSubmit={handleCreateAppSubmit}>
          <div className="form-group">
            <label>アプリ名<span className="required-mark">*</span></label>
            <input
              type="text"
              value={createAppName}
              onChange={(e) => setCreateAppName(e.target.value)}
              placeholder="my-app"
              pattern={RESOURCE_NAME_PATTERN}
              title="半角英数字、アンダースコア、ハイフンのみ使用できます"
              maxLength={20}
              required
              autoFocus
            />
          </div>
          {createAppError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {createAppError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCreateAppCancel}>キャンセル</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingApp}
            >
              {creatingApp ? '作成中...' : '作成する'}
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  };

  const renderDeployModal = () => {
    if (!deployForm) return null;
    return (
      <div className="modal-overlay" onClick={handleDeployCancel} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
          padding: '20px', minWidth: '480px', maxWidth: '640px', maxHeight: '85vh', overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>新しいバージョンをデプロイ</h3>
          <form onSubmit={handleDeploySubmit}>

          <div className="form-group">
            <label>コンテナイメージ<span className="required-mark">*</span></label>
            <input
              type="text"
              value={deployForm.image}
              onChange={(e) => setDeployForm({ ...deployForm, image: e.target.value })}
              placeholder="docker.io/library/nginx:latest"
              maxLength={512}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>コマンド（任意、スペース区切り）</label>
            <input
              type="text"
              value={deployForm.cmd}
              onChange={(e) => setDeployForm({ ...deployForm, cmd: e.target.value })}
              placeholder="任意"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div className="form-group">
              <label>CPU (vCPU)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={deployForm.cpu}
                onChange={(e) => setDeployForm({ ...deployForm, cpu: e.target.value })}
                min={0.1}
                max={64}
                step={0.1}
                required
              />
            </div>
            <div className="form-group">
              <label>メモリ (MB)<span className="required-mark">*</span></label>
              <input
                type="number"
                value={deployForm.memory}
                onChange={(e) => setDeployForm({ ...deployForm, memory: e.target.value })}
                min={128}
                max={131072}
                step={1}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>スケーリングモード</label>
            <select
              value={deployForm.scalingMode}
              onChange={(e) => setDeployForm({ ...deployForm, scalingMode: e.target.value as 'manual' | 'cpu' })}
            >
              <option value="manual">固定 (manual)</option>
              <option value="cpu">CPU使用率に応じて自動 (cpu)</option>
            </select>
          </div>

          {deployForm.scalingMode === 'manual' ? (
            <div className="form-group">
              <label>固定スケール（インスタンス数）<span className="required-mark">*</span></label>
              <input
                type="number"
                value={deployForm.fixedScale}
                onChange={(e) => setDeployForm({ ...deployForm, fixedScale: e.target.value })}
                min={1}
                max={50}
                step={1}
                required
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label>最小スケール<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={deployForm.minScale}
                  onChange={(e) => setDeployForm({ ...deployForm, minScale: e.target.value })}
                  min={1}
                  max={50}
                  step={1}
                  required
                />
              </div>
              <div className="form-group">
                <label>最大スケール<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={deployForm.maxScale}
                  onChange={(e) => setDeployForm({ ...deployForm, maxScale: e.target.value })}
                  min={1}
                  max={50}
                  step={1}
                  required
                />
              </div>
              <div className="form-group">
                <label>スケールイン閾値 (%)<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={deployForm.scaleInThreshold}
                  onChange={(e) => setDeployForm({ ...deployForm, scaleInThreshold: e.target.value })}
                  min={30}
                  max={70}
                  step={1}
                  required
                />
              </div>
              <div className="form-group">
                <label>スケールアウト閾値 (%)<span className="required-mark">*</span></label>
                <input
                  type="number"
                  value={deployForm.scaleOutThreshold}
                  onChange={(e) => setDeployForm({ ...deployForm, scaleOutThreshold: e.target.value })}
                  min={50}
                  max={99}
                  step={1}
                  required
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>公開ポート</label>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleExposedPortAdd}
                disabled={deployForm.exposedPorts.length >= 5}
              >
                + ポート追加
              </button>
            </div>
            {deployForm.exposedPorts.length === 0 ? (
              <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>公開ポートなし</div>
            ) : (
              deployForm.exposedPorts.map((p, index) => (
                <div key={index} style={{ border: '1px solid #333', borderRadius: '6px', padding: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <input
                      type="number"
                      value={p.targetPort}
                      onChange={(e) => handleExposedPortChange(index, 'targetPort', e.target.value)}
                      placeholder="ターゲットポート *"
                      min={1}
                      max={65535}
                      required
                    />
                    <input
                      type="number"
                      value={p.loadBalancerPort}
                      onChange={(e) => handleExposedPortChange(index, 'loadBalancerPort', e.target.value)}
                      placeholder="LBポート（任意）"
                      min={1}
                      max={65535}
                    />
                  </div>
                  <input
                    type="text"
                    value={p.host}
                    onChange={(e) => handleExposedPortChange(index, 'host', e.target.value)}
                    placeholder="ホスト名（カンマ区切り、任意）"
                    style={{ marginTop: '0.5rem', width: '100%' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={p.useLetsEncrypt}
                      onChange={(e) => handleExposedPortChange(index, 'useLetsEncrypt', e.target.checked)}
                    />
                    Let's Encryptを使用
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input
                      type="text"
                      value={p.healthCheckPath}
                      onChange={(e) => handleExposedPortChange(index, 'healthCheckPath', e.target.value)}
                      placeholder="ヘルスチェックパス（任意）"
                      maxLength={200}
                    />
                    <input
                      type="number"
                      value={p.healthCheckIntervalSeconds}
                      onChange={(e) => handleExposedPortChange(index, 'healthCheckIntervalSeconds', e.target.value)}
                      placeholder="間隔(秒)"
                      min={3}
                      max={60}
                    />
                    <input
                      type="number"
                      value={p.healthCheckTimeoutSeconds}
                      onChange={(e) => handleExposedPortChange(index, 'healthCheckTimeoutSeconds', e.target.value)}
                      placeholder="タイムアウト(秒)"
                      max={60}
                    />
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                    <button type="button" className="btn btn-danger btn-small" onClick={() => handleExposedPortRemove(index)}>削除</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>環境変数</label>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleEnvVarAdd}
                disabled={deployForm.envVars.length >= 50}
              >
                + 環境変数追加
              </button>
            </div>
            {deployForm.envVars.length === 0 ? (
              <div style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>環境変数なし</div>
            ) : (
              deployForm.envVars.map((e, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    value={e.key}
                    onChange={(ev) => handleEnvVarChange(index, 'key', ev.target.value)}
                    placeholder="KEY *"
                    maxLength={255}
                    required
                    style={{ flex: 1 }}
                  />
                  <input
                    type={e.secret ? 'password' : 'text'}
                    value={e.value}
                    onChange={(ev) => handleEnvVarChange(index, 'value', ev.target.value)}
                    placeholder="値"
                    maxLength={4096}
                    style={{ flex: 1 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={e.secret}
                      onChange={(ev) => handleEnvVarChange(index, 'secret', ev.target.checked)}
                    />
                    secret
                  </label>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => handleEnvVarRemove(index)}>削除</button>
                </div>
              ))
            )}
          </div>

          {deployError && (
            <div style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.85rem' }}>
              エラー: {deployError}
            </div>
          )}
          <div className="confirm-actions" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleDeployCancel}>キャンセル</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={deploying}
            >
              {deploying ? 'デプロイ中...' : 'デプロイする'}
            </button>
          </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}
        <div className="loading">読み込み中...</div>
      </>
    );
  }

  // クラスタ一覧
  if (view.type === 'clusters') {
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-primary btn-small" onClick={handleCreateClusterOpen}>+ クラスタ作成</button>
        </div>
        {clusters.length === 0 ? (
          <div className="empty-state">クラスタがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setView({ type: 'cluster', clusterId: c.id, clusterName: c.name })}
                  style={{ cursor: 'pointer' }}
                  className="row-hover"
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{c.name}</td>
                  <td>{c.id}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => handleDeleteClick(e, { kind: 'cluster', id: c.id, name: c.name })}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {renderConfirmDialog()}
        {renderCreateClusterModal()}
      </>
    );
  }

  // クラスタ詳細（アプリ一覧 + ASG一覧）
  if (view.type === 'cluster') {
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <h3 style={{ color: '#00adb5', margin: 0 }}>アプリケーション</h3>
          <button className="btn btn-primary btn-small" onClick={handleCreateAppOpen}>+ アプリ作成</button>
        </div>
        {apps.length === 0 ? (
          <div className="empty-state">アプリケーションがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>アクティブバージョン</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setView({
                    type: 'app',
                    clusterId: view.clusterId,
                    clusterName: view.clusterName,
                    appId: app.id,
                    appName: app.name,
                    activeVersion: app.activeVersion
                  })}
                  style={{ cursor: 'pointer' }}
                  className="row-hover"
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{app.name}</td>
                  <td>{app.activeVersion || '-'}</td>
                  <td>{app.id}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => handleDeleteClick(e, { kind: 'application', id: app.id, name: app.name, clusterId: view.clusterId })}
                      disabled={deletingId === app.id}
                    >
                      {deletingId === app.id ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
          <h3 style={{ color: '#00adb5', margin: 0 }}>Auto Scaling Groups</h3>
          <button className="btn btn-primary btn-small" onClick={handleCreateASGOpen}>+ ASG作成</button>
        </div>
        {asgs.length === 0 ? (
          <div className="empty-state">ASGがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ゾーン</th>
                <th>ノード (min/max/current)</th>
                <th>ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {asgs.map((asg) => (
                <tr
                  key={asg.id}
                  onClick={() => setView({
                    type: 'asg',
                    clusterId: view.clusterId,
                    clusterName: view.clusterName,
                    asgId: asg.id,
                    asgName: asg.name
                  })}
                  style={{ cursor: 'pointer' }}
                  className="row-hover"
                >
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{asg.name}</td>
                  <td>{asg.zone}</td>
                  <td>{asg.minNodes} / {asg.maxNodes} / {asg.workerNodeCount}</td>
                  <td>{asg.id}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => handleDeleteClick(e, { kind: 'asg', id: asg.id, name: asg.name, clusterId: view.clusterId })}
                      disabled={deletingId === asg.id}
                    >
                      {deletingId === asg.id ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
          <h3 style={{ color: '#00adb5', margin: 0 }}>証明書</h3>
          <button className="btn btn-primary btn-small" onClick={handleCreateCertificateOpen}>+ 証明書作成</button>
        </div>
        {certificates.length === 0 ? (
          <div className="empty-state">証明書がありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>コモンネーム</th>
                <th>有効期限</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert) => (
                <tr key={cert.id}>
                  <td style={{ color: '#00adb5', fontWeight: 'bold' }}>{cert.name}</td>
                  <td>{cert.commonName || '-'}</td>
                  <td>{cert.notAfter || '-'}</td>
                  <td style={{ textAlign: 'left' }}>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleEditCertificateOpen(cert)}
                      style={{ marginRight: '0.5rem' }}
                    >
                      編集
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={(e) => handleDeleteClick(e, { kind: 'certificate', id: cert.id, name: cert.name, clusterId: view.clusterId })}
                      disabled={deletingId === cert.id}
                    >
                      {deletingId === cert.id ? '削除中...' : '削除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {renderCreateAppModal()}
        {renderCreateASGModal()}
        {renderCertificateModal()}
        {renderConfirmDialog()}
      </>
    );
  }

  // アプリ詳細（バージョン一覧）
  if (view.type === 'app') {
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <h3 style={{ color: '#00adb5', margin: 0 }}>バージョン</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-small" onClick={handleDeployOpen}>+ デプロイ</button>
            {view.activeVersion > 0 && (
              <button
                className="btn btn-danger btn-small"
                onClick={() => handleClearActiveVersion(view.appId, view.clusterId, view.clusterName, view.appName)}
                disabled={clearingActiveVersion}
              >
                {clearingActiveVersion ? '処理中...' : '非アクティブ化'}
              </button>
            )}
          </div>
        </div>
        {versions.length === 0 ? (
          <div className="empty-state">バージョンがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>バージョン</th>
                <th>状態</th>
                <th>イメージ</th>
                <th>アクティブノード数</th>
                <th>作成日時</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const isActive = v.version === view.activeVersion;
                const versionKey = `${view.appId}-v${v.version}`;
                return (
                  <tr
                    key={v.version}
                    onClick={() => setView({
                      type: 'version',
                      clusterId: view.clusterId,
                      clusterName: view.clusterName,
                      appId: view.appId,
                      appName: view.appName,
                      activeVersion: view.activeVersion,
                      version: v.version
                    })}
                    style={{ cursor: 'pointer' }}
                    className="row-hover"
                  >
                    <td style={{ fontWeight: 'bold', color: '#00adb5' }}>v{v.version}</td>
                    <td>
                      {isActive ? (
                        <span className="status up">Active</span>
                      ) : v.activeNodeCount > 0 ? (
                        <span className="status draining">Draining</span>
                      ) : (
                        <span className="status" style={{ background: '#666' }}>-</span>
                      )}
                    </td>
                    <td>{v.image || '-'}</td>
                    <td>
                      {!isActive && v.activeNodeCount > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          {v.activeNodeCount}
                          <span className="spinner-small" />
                        </span>
                      ) : (
                        v.activeNodeCount
                      )}
                    </td>
                    <td>{v.createdAt || '-'}</td>
                    <td style={{ textAlign: 'left' }}>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={(e) => handleDeleteClick(e, { kind: 'version', id: versionKey, name: `v${v.version}`, appId: view.appId, version: v.version })}
                        disabled={isActive || deletingId === versionKey}
                        title={isActive ? 'アクティブなバージョンは削除できません' : undefined}
                      >
                        {deletingId === versionKey ? '削除中...' : '削除'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {renderDeployModal()}
        {renderConfirmDialog()}
      </>
    );
  }

  // ASG詳細（LB一覧 + ワーカーノード一覧）
  if (view.type === 'asg') {
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <h3 style={{ color: '#00adb5', margin: 0 }}>ロードバランサー</h3>
          <button className="btn btn-primary btn-small" onClick={handleCreateLBOpen}>+ LB作成</button>
        </div>
        {lbs.length === 0 ? (
          <div className="empty-state">ロードバランサーがありません</div>
        ) : (
          lbs.map((lb) => {
            const nodes = lbNodesMap[lb.id] || [];
            return (
              <div key={lb.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#00adb5', fontWeight: 'bold', fontSize: '1.1rem' }}>{lb.name}</span>
                  <span style={{ color: '#888', fontSize: '0.9rem' }}>{lb.serviceClassPath}</span>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={(e) => handleDeleteClick(e, { kind: 'lb', id: lb.id, name: lb.name, clusterId: view.clusterId, asgId: view.asgId })}
                    disabled={deletingId === lb.id}
                  >
                    {deletingId === lb.id ? '削除中...' : '削除'}
                  </button>
                </div>
                {nodes.length === 0 ? (
                  <div style={{ color: '#888', marginLeft: '1rem' }}>ノードなし</div>
                ) : (
                  <table className="table" style={{ marginLeft: '1rem' }}>
                    <thead>
                      <tr>
                        <th>ノードID</th>
                        <th>状態</th>
                        <th>IPアドレス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodes.map((node) => {
                        const isHealthy = ['running', 'healthy'].includes(node.status.toLowerCase());
                        return (
                          <tr key={node.id}>
                            <td>{node.id.substring(0, 8)}...</td>
                            <td>
                              <span className={`status ${isHealthy ? 'up' : 'down'}`}>
                                {node.status}
                              </span>
                            </td>
                            <td>
                              {node.interfaces?.map((iface, idx) => (
                                <span key={idx}>
                                  eth{iface.index}: {iface.addresses?.join(', ') || '-'}
                                  {idx < (node.interfaces?.length || 0) - 1 && ' | '}
                                </span>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}

        <h3 style={{ marginTop: '2rem', color: '#00adb5' }}>ワーカーノード</h3>
        {workerNodes.length === 0 ? (
          <div className="empty-state">ワーカーノードがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>状態</th>
                <th>Draining</th>
                <th>IPアドレス</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workerNodes.map((node) => {
                const isHealthy = ['running', 'healthy'].includes(node.status.toLowerCase());
                return (
                  <tr key={node.id}>
                    <td>{node.id.substring(0, 8)}...</td>
                    <td>
                      <span className={`status ${isHealthy ? 'up' : 'down'}`}>
                        {node.status}
                      </span>
                    </td>
                    <td>{node.draining ? 'Yes' : 'No'}</td>
                    <td>
                      {node.interfaces?.map((iface, idx) => (
                        <div key={idx}>
                          eth{iface.index}: {iface.addresses?.join(', ') || '-'}
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => handleToggleDraining(node.id, !node.draining)}
                        disabled={updatingDrainingId === node.id}
                      >
                        {updatingDrainingId === node.id ? '処理中...' : node.draining ? 'Draining解除' : 'Draining開始'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {renderCreateLBModal()}
        {renderConfirmDialog()}
      </>
    );
  }

  // LB詳細（LBノード一覧）
  if (view.type === 'lb') {
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}

        <h3 style={{ marginTop: '1rem', color: '#00adb5' }}>ロードバランサーノード</h3>
        {lbNodes.length === 0 ? (
          <div className="empty-state">LBノードがありません</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>状態</th>
                <th>IPアドレス</th>
              </tr>
            </thead>
            <tbody>
              {lbNodes.map((node) => {
                const isHealthy = ['running', 'healthy'].includes(node.status.toLowerCase());
                return (
                  <tr key={node.id}>
                    <td>{node.id.substring(0, 8)}...</td>
                    <td>
                      <span className={`status ${isHealthy ? 'up' : 'down'}`}>
                        {node.status}
                      </span>
                    </td>
                    <td>
                      {node.interfaces?.map((iface, idx) => (
                        <div key={idx}>
                          eth{iface.index}: {iface.addresses?.join(', ') || '-'}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </>
    );
  }

  // バージョン詳細
  if (view.type === 'version') {
    const isActive = view.version === view.activeVersion;
    return (
      <>
        <div className="header">
          <h2>AppRun専有型</h2>
        </div>
        {renderBreadcrumb()}

        {versionDetail ? (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ color: '#00adb5', margin: 0 }}>バージョン {view.version}</h3>
                {isActive && <span className="status up">Active</span>}
                {settingActiveVersion && <span className="spinner-small" />}
              </div>
              {!isActive && (
                <div className="dropdown">
                  <button
                    className="btn-icon"
                    onClick={() => setShowVersionMenu(!showVersionMenu)}
                  >
                    ⋯
                  </button>
                  <div className={`dropdown-menu ${showVersionMenu ? 'show' : ''}`}>
                    <button
                      className="dropdown-item"
                      onClick={() => handleSetActiveVersion(
                        view.appId,
                        view.clusterId,
                        view.clusterName,
                        view.appName,
                        view.version
                      )}
                      disabled={settingActiveVersion}
                    >
                      このバージョンをアクティブにする
                    </button>
                    <button
                      className="dropdown-item"
                      onClick={(e) => {
                        setShowVersionMenu(false);
                        handleDeleteClick(e, { kind: 'version', id: `${view.appId}-v${view.version}`, name: `v${view.version}`, appId: view.appId, version: view.version });
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              {/* 基本情報 */}
              <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>基本情報</h4>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>イメージ</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.image || '-'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>CPU</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.cpu / 1000} vCPU</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>メモリ</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.memory} MB</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>アクティブノード数</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.activeNodeCount}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>作成日時</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.createdAt || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* スケーリング設定 */}
              <div className="card" style={{ padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>スケーリング設定</h4>
                <table style={{ borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>モード</td>
                      <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.scalingMode || '-'}</td>
                    </tr>
                    {versionDetail.scalingMode === 'manual' ? (
                      <tr>
                        <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>固定スケール</td>
                        <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.fixedScale}</td>
                      </tr>
                    ) : versionDetail.scalingMode === 'cpu' ? (
                      <>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>最小/最大スケール</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.minScale} / {versionDetail.maxScale}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スケールイン閾値</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.scaleInThreshold}%</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: '#888', textAlign: 'left' }}>スケールアウト閾値</td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>{versionDetail.scaleOutThreshold}%</td>
                        </tr>
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* コマンド */}
            {versionDetail.cmd && versionDetail.cmd.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>コマンド</h4>
                <code style={{ background: '#1a1a1a', padding: '0.5rem', borderRadius: '4px', display: 'block' }}>
                  {versionDetail.cmd.join(' ')}
                </code>
              </div>
            )}

            {/* 公開ポート */}
            {versionDetail.exposedPorts && versionDetail.exposedPorts.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>公開ポート</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ターゲットポート</th>
                      <th>LBポート</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionDetail.exposedPorts.map((port, idx) => (
                      <tr key={idx}>
                        <td>{port.targetPort}</td>
                        <td>{port.loadBalancerPort}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 環境変数 */}
            {versionDetail.env && versionDetail.env.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#2a2a2a', borderRadius: '8px' }}>
                <h4 style={{ color: '#00adb5', marginTop: 0, marginBottom: '1rem' }}>環境変数</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionDetail.env.map((env, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>
                          {env.key}
                          {env.secret && <span style={{ color: '#ff6b6b', marginLeft: '0.5rem', fontSize: '0.8em' }}>secret</span>}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: env.secret && !env.value ? '#888' : undefined }}>
                          {env.value || (env.secret ? '(hidden)' : '(empty)')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">バージョン情報を読み込めませんでした</div>
        )}
        {renderConfirmDialog()}
      </>
    );
  }

  return null;
}
