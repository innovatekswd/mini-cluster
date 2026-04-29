package models

import (
	"time"

	"gorm.io/gorm"
)

// ─── Auth ──────────────────────────────────────────────────────────────────

type Role string

const (
	RoleAdmin    Role = "Admin"
	RoleOperator Role = "Operator"
	RoleViewer   Role = "Viewer"
)

type User struct {
	ID            string         `gorm:"type:text;primaryKey" json:"id"`
	Username      string         `gorm:"type:text;uniqueIndex;not null" json:"username"`
	Email         string         `gorm:"type:text" json:"email"`
	PasswordHash  string         `gorm:"type:text;not null" json:"-"`
	Role          Role           `gorm:"type:text;not null;default:'Viewer'" json:"role"`
	IsActive      bool           `gorm:"not null;default:true" json:"isActive"`
	CreatedAt     time.Time      `json:"createdAt"`
	LastLoginAt   *time.Time     `json:"lastLoginAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	RefreshTokens []RefreshToken `gorm:"foreignKey:UserID" json:"-"`
}

type RefreshToken struct {
	ID              string     `gorm:"type:text;primaryKey" json:"id"`
	UserID          string     `gorm:"type:text;not null;index" json:"userId"`
	Token           string     `gorm:"type:text;not null;uniqueIndex" json:"token"`
	ExpiresAt       time.Time  `json:"expiresAt"`
	CreatedAt       time.Time  `json:"createdAt"`
	IsActive        bool       `gorm:"not null;default:true" json:"isActive"`
	IsRevoked       bool       `gorm:"not null;default:false" json:"isRevoked"`
	RevokedAt       *time.Time `json:"revokedAt"`
	ReplacedByToken string     `gorm:"type:text" json:"replacedByToken"`
	ReplacedAt      *time.Time `json:"replacedAt"`
}

// ─── Apps ──────────────────────────────────────────────────────────────────

type App struct {
	ID          string    `gorm:"type:text;primaryKey" json:"id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Slug        string    `gorm:"type:text;not null;uniqueIndex" json:"slug"`
	Description string    `gorm:"type:text" json:"description"`
	Icon        string    `gorm:"type:text" json:"icon"`
	Color       string    `gorm:"type:text" json:"color"`
	ParentAppID *string   `gorm:"type:text;index" json:"parentAppId"`
	SortOrder   int       `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
	ModifiedAt  time.Time `json:"modifiedAt"`
	Services    []Service `gorm:"foreignKey:AppID" json:"services,omitempty"`
	ChildApps   []App     `gorm:"foreignKey:ParentAppID" json:"childApps,omitempty"`
}

// ─── Services ──────────────────────────────────────────────────────────────

type RestartPolicy string

const (
	RestartNever         RestartPolicy = "Never"
	RestartOnFailure     RestartPolicy = "OnFailure"
	RestartAlways        RestartPolicy = "Always"
	RestartUnlessStopped RestartPolicy = "UnlessStopped"
)

type HealthCheckType string

const (
	HealthCheckNone HealthCheckType = "None"
	HealthCheckHttp HealthCheckType = "Http"
	HealthCheckTcp  HealthCheckType = "Tcp"
	HealthCheckExec HealthCheckType = "Exec"
)

type CaptureMode string

const (
	CaptureModeNone   CaptureMode = "None"
	CaptureModeStdout CaptureMode = "Stdout"
	CaptureModeBoth   CaptureMode = "Both"
)

// ─── Container Support ─────────────────────────────────────────────────────

type ServiceType string

const (
	ServiceTypeProcess ServiceType = "Process"
	ServiceTypeDocker  ServiceType = "Docker"
	ServiceTypePodman  ServiceType = "Podman"
)

type PullPolicy string

const (
	PullAlways       PullPolicy = "Always"
	PullIfNotPresent PullPolicy = "IfNotPresent"
	PullNever        PullPolicy = "Never"
)

// ContainerConfig holds Docker/Podman configuration for a Service.
// It is a 1-to-1 optional extension of Service (uniqueIndex on ServiceID).
type ContainerConfig struct {
	ID        string `gorm:"type:text;primaryKey" json:"id"`
	ServiceID string `gorm:"type:text;not null;uniqueIndex" json:"serviceId"`

	// Image
	Image      string     `gorm:"type:text;not null" json:"image"`
	Tag        string     `gorm:"type:text;not null;default:'latest'" json:"tag"`
	Registry   string     `gorm:"type:text" json:"registry"`
	PullPolicy PullPolicy `gorm:"type:text;not null;default:'IfNotPresent'" json:"pullPolicy"`

	// Runtime state (written at execution time)
	ContainerID   string `gorm:"type:text" json:"containerId"`
	ContainerName string `gorm:"type:text" json:"containerName"`
	ImageID       string `gorm:"type:text" json:"imageId"`

	// Networking — JSON-encoded []PortMapping
	Ports       string `gorm:"type:text" json:"ports"`
	NetworkMode string `gorm:"type:text" json:"networkMode"`

	// Storage — JSON-encoded []VolumeMount
	Volumes string `gorm:"type:text" json:"volumes"`

	// Resource limits
	MemoryLimitBytes *int64   `json:"memoryLimitBytes"`
	CpuLimit         *float64 `json:"cpuLimit"`

	// Execution overrides
	Entrypoint   string `gorm:"type:text" json:"entrypoint"`
	Command      string `gorm:"type:text" json:"command"`
	User         string `gorm:"type:text" json:"user"`
	WorkingDir   string `gorm:"type:text" json:"workingDir"`
	Privileged   bool   `gorm:"not null;default:false" json:"privileged"`
	ReadOnly     bool   `gorm:"not null;default:false" json:"readOnly"`
	RemoveOnStop bool   `gorm:"not null;default:false" json:"removeOnStop"`

	// Labels — JSON-encoded map[string]string
	Labels string `gorm:"type:text" json:"labels"`

	CreatedAt  time.Time `json:"createdAt"`
	ModifiedAt time.Time `json:"modifiedAt"`

	Service *Service `gorm:"foreignKey:ServiceID" json:"-"`
}

// PortMapping represents a host→container port binding.
type PortMapping struct {
	HostPort      int    `json:"hostPort"`
	ContainerPort int    `json:"containerPort"`
	Protocol      string `json:"protocol"` // tcp | udp
	HostIP        string `json:"hostIp"`   // default 0.0.0.0
}

// VolumeMount represents a volume or bind-mount.
type VolumeMount struct {
	Type     string `json:"type"`     // bind | volume | tmpfs
	Source   string `json:"source"`
	Target   string `json:"target"`
	ReadOnly bool   `json:"readOnly"`
}

// ─── Service ───────────────────────────────────────────────────────────────

type Service struct {
	ID                   string          `gorm:"type:text;primaryKey" json:"id"`
	Name                 string          `gorm:"type:text;not null" json:"name"`
	Slug                 string          `gorm:"type:text;not null" json:"slug"`
	ServiceType          ServiceType     `gorm:"type:text;not null;default:'Process'" json:"serviceType"`
	ExecutablePath       string          `gorm:"type:text" json:"executablePath"`
	Arguments            string          `gorm:"type:text" json:"arguments"`
	EnvironmentVariables string          `gorm:"type:text" json:"environmentVariables"` // JSON map
	WorkingDirectory     string          `gorm:"type:text" json:"workingDirectory"`
	AutoStart            bool            `gorm:"not null;default:false" json:"autoStart"`
	AccessLink           string          `gorm:"type:text" json:"accessLink"`
	IsExternal           bool            `gorm:"not null;default:false" json:"isExternal"`
	CaptureOutput        CaptureMode     `gorm:"type:text;default:'Both'" json:"captureOutput"`
	RestartPolicy        RestartPolicy   `gorm:"type:text;default:'Never'" json:"restartPolicy"`
	HealthCheckType      HealthCheckType `gorm:"type:text;default:'None'" json:"healthCheckType"`
	HealthCheckUrl       string          `gorm:"type:text" json:"healthCheckUrl"`
	HealthCheckInterval  int             `gorm:"default:30" json:"healthCheckInterval"` // seconds
	HealthCheckTimeout   int             `gorm:"default:5" json:"healthCheckTimeout"`
	HealthCheckRetries   int             `gorm:"default:3" json:"healthCheckRetries"`
	HealthCheckCommand   string          `gorm:"type:text" json:"healthCheckCommand"`
	AppID                *string         `gorm:"type:text;index" json:"appId"`
	MachineID            *string         `gorm:"type:text;index" json:"machineId"`
	OrderIndex           int             `gorm:"not null;default:0" json:"orderIndex"`
	CreatedAt            time.Time       `json:"createdAt"`
	ModifiedAt           time.Time       `json:"modifiedAt"`

	ContainerConfig *ContainerConfig `gorm:"foreignKey:ServiceID" json:"containerConfig,omitempty"`
}

// ─── Environments ──────────────────────────────────────────────────────────

type Environment struct {
	ID          string    `gorm:"type:text;primaryKey" json:"id"`
	Name        string    `gorm:"type:text;not null;uniqueIndex" json:"name"`
	Slug        string    `gorm:"type:text;not null;uniqueIndex" json:"slug"`
	Description string    `gorm:"type:text" json:"description"`
	Variables   string    `gorm:"type:text" json:"variables"` // JSON map
	IsActive    bool      `gorm:"not null;default:false" json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	ModifiedAt  time.Time `json:"modifiedAt"`
}

// ─── Machines / Cluster ────────────────────────────────────────────────────

type MachineStatus string

const (
	MachineOnline   MachineStatus = "online"
	MachineOffline  MachineStatus = "offline"
	MachineDegraded MachineStatus = "degraded"
	MachineUnknown  MachineStatus = "unknown"
)

type ConnectionType string

const (
	ConnectionLocal ConnectionType = "local"
	ConnectionSSH   ConnectionType = "ssh"
	ConnectionAgent ConnectionType = "agent"
)

type Machine struct {
	ID               string         `gorm:"type:text;primaryKey" json:"id"`
	Name             string         `gorm:"type:text;not null" json:"name"`
	Host             string         `gorm:"type:text" json:"host"`
	Port             int            `gorm:"default:22" json:"port"`
	ConnectionType   ConnectionType `gorm:"type:text;default:'local'" json:"connectionType"`
	Status           MachineStatus  `gorm:"type:text;default:'unknown'" json:"status"`
	LastSeen         *time.Time     `json:"lastSeen"`
	SshUsername      string         `gorm:"type:text" json:"sshUsername"`
	SshKeyPath       string         `gorm:"type:text" json:"sshKeyPath"`
	SshPassword      string         `gorm:"type:text" json:"sshPassword"`
	IsLocal          bool           `gorm:"not null;default:false" json:"isLocal"`
	AgentEndpoint    string         `gorm:"type:text" json:"agentEndpoint"`
	AgentApiKey      string         `gorm:"type:text" json:"agentApiKey"` // hashed
	AgentVersion     string         `gorm:"type:text" json:"agentVersion"`
	CpuCores         int            `json:"cpuCores"`
	TotalMemoryBytes int64          `json:"totalMemoryBytes"`
	TotalDiskBytes   int64          `json:"totalDiskBytes"`
	Labels           string         `gorm:"type:text" json:"labels"`   // JSON map
	Metadata         string         `gorm:"type:text" json:"metadata"` // JSON
	OrderIndex       int            `gorm:"default:0" json:"orderIndex"`
	CreatedAt        time.Time      `json:"createdAt"`
	ModifiedAt       time.Time      `json:"modifiedAt"`
}

// ─── Cron ──────────────────────────────────────────────────────────────────

type CronTargetType string

const (
	CronTargetApp     CronTargetType = "App"
	CronTargetService CronTargetType = "Service"
	CronTargetGroup   CronTargetType = "Group"
	CronTargetScript  CronTargetType = "Script"
)

type CronAction string

const (
	CronActionStart   CronAction = "Start"
	CronActionRun     CronAction = "Run"
	CronActionRestart CronAction = "Restart"
	CronActionStop    CronAction = "Stop"
	CronActionScript  CronAction = "Script"
)

type CronMissedPolicy string

const (
	CronMissedSkip CronMissedPolicy = "Skip"
	CronMissedOnce CronMissedPolicy = "RunOnce"
	CronMissedAll  CronMissedPolicy = "RunAll"
)

type CronJob struct {
	ID                string           `gorm:"type:text;primaryKey" json:"id"`
	Name              string           `gorm:"type:text;not null" json:"name"`
	Description       string           `gorm:"type:text" json:"description"`
	CronExpression    string           `gorm:"type:text;not null" json:"cronExpression"`
	Timezone          string           `gorm:"type:text;default:'UTC'" json:"timezone"`
	TargetType        CronTargetType   `gorm:"type:text" json:"targetType"`
	AppID             *string          `gorm:"type:text" json:"appId"`
	ServiceID         *string          `gorm:"type:text" json:"serviceId"`
	GroupID           *string          `gorm:"type:text" json:"groupId"`
	ScriptPath        string           `gorm:"type:text" json:"scriptPath"`
	Action            CronAction       `gorm:"type:text" json:"action"`
	WaitForCompletion bool             `gorm:"default:false" json:"waitForCompletion"`
	TimeoutSeconds    int              `gorm:"default:300" json:"timeoutSeconds"`
	MissedPolicy      CronMissedPolicy `gorm:"type:text;default:'Skip'" json:"missedPolicy"`
	DependsOnJobID    *string          `gorm:"type:text" json:"dependsOnJobId"`
	IsEnabled         bool             `gorm:"default:true" json:"isEnabled"`
	LastRun           *time.Time       `json:"lastRun"`
	NextRun           *time.Time       `json:"nextRun"`
	LastRunStatus     string           `gorm:"type:text" json:"lastRunStatus"`
	LastRunError      string           `gorm:"type:text" json:"lastRunError"`
	TotalRuns         int              `gorm:"default:0" json:"totalRuns"`
	FailedRuns        int              `gorm:"default:0" json:"failedRuns"`
	CreatedAt         time.Time        `json:"createdAt"`
	ModifiedAt        time.Time        `json:"modifiedAt"`
	Runs              []CronJobRun     `gorm:"foreignKey:CronJobID" json:"runs,omitempty"`
}

type CronJobRun struct {
	ID         string     `gorm:"type:text;primaryKey" json:"id"`
	CronJobID  string     `gorm:"type:text;not null;index" json:"cronJobId"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt"`
	Status     string     `gorm:"type:text" json:"status"`
	Error      string     `gorm:"type:text" json:"error"`
	Output     string     `gorm:"type:text" json:"output"`
}

// ─── Proxy ─────────────────────────────────────────────────────────────────

type ProxyAccessMethod string

const (
	ProxyPathPrefix ProxyAccessMethod = "PathPrefix"
	ProxySubdomain  ProxyAccessMethod = "Subdomain"
	ProxyPort       ProxyAccessMethod = "Port"
	ProxyIframe     ProxyAccessMethod = "Iframe"
)

type ProxyRoute struct {
	ID                 string     `gorm:"type:text;primaryKey" json:"id"`
	Name               string     `gorm:"type:text;not null" json:"name"`
	Description        string     `gorm:"type:text" json:"description"`
	Icon               string     `gorm:"type:text" json:"icon"`
	TargetUrl          string     `gorm:"type:text;not null" json:"targetUrl"`
	PathPrefix         string     `gorm:"type:text" json:"pathPrefix"`
	Subdomain          string     `gorm:"type:text" json:"subdomain"`
	ProxyPort          *int       `json:"proxyPort"`
	IframeUrl          string     `gorm:"type:text" json:"iframeUrl"`
	RequireAuth        bool       `gorm:"default:false" json:"requireAuth"`
	AllowedRoles       string     `gorm:"type:text" json:"allowedRoles"` // JSON array
	ApiKey             string     `gorm:"type:text" json:"apiKey"`
	TimeoutSeconds     int        `gorm:"default:30" json:"timeoutSeconds"`
	PreserveHostHeader bool       `gorm:"default:false" json:"preserveHostHeader"`
	CustomHeaders      string     `gorm:"type:text" json:"customHeaders"` // JSON
	IsHealthy          bool       `gorm:"default:true" json:"isHealthy"`
	LastHealthCheck    *time.Time `json:"lastHealthCheck"`
	IsEnabled          bool       `gorm:"default:true" json:"isEnabled"`
	CreatedAt          time.Time  `json:"createdAt"`
	UpdatedAt          time.Time  `json:"updatedAt"`
}

type ProxySetting struct {
	ID                 string    `gorm:"type:text;primaryKey" json:"id"`
	BaseDomainType     string    `gorm:"type:text;default:'ip'" json:"baseDomainType"`
	CustomBaseDomain   string    `gorm:"type:text" json:"customBaseDomain"`
	PortRangeStart     int       `gorm:"default:8100" json:"portRangeStart"`
	PortRangeEnd       int       `gorm:"default:8200" json:"portRangeEnd"`
	DefaultRequireAuth bool      `gorm:"default:false" json:"defaultRequireAuth"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

// ─── Service Groups ────────────────────────────────────────────────────────

type ServiceGroup struct {
	ID          string          `gorm:"type:text;primaryKey" json:"id"`
	Name        string          `gorm:"type:text;not null" json:"name"`
	Description string          `gorm:"type:text" json:"description"`
	Icon        string          `gorm:"type:text" json:"icon"`
	Color       string          `gorm:"type:text" json:"color"`
	ParentID    *string         `gorm:"type:text;index" json:"parentId"`
	SortOrder   int             `gorm:"default:0" json:"sortOrder"`
	CreatedAt   time.Time       `json:"createdAt"`
	Variables   []GroupVariable `gorm:"foreignKey:GroupID" json:"variables,omitempty"`
}

type ServiceGroupAssignment struct {
	ID        string `gorm:"type:text;primaryKey" json:"id"`
	GroupID   string `gorm:"type:text;not null;index" json:"groupId"`
	ServiceID string `gorm:"type:text;not null;index" json:"serviceId"`
}

type GroupVariable struct {
	ID      string `gorm:"type:text;primaryKey" json:"id"`
	GroupID string `gorm:"type:text;not null;index" json:"groupId"`
	Key     string `gorm:"type:text;not null" json:"key"`
	Value   string `gorm:"type:text" json:"value"`
}

// ─── Settings ──────────────────────────────────────────────────────────────

type AppSettings struct {
	ID                       string    `gorm:"type:text;primaryKey" json:"id"`
	MetricsCollectionEnabled bool      `gorm:"default:true" json:"metricsCollectionEnabled"`
	MetricsIntervalSeconds   int       `gorm:"default:5" json:"metricsIntervalSeconds"`
	Theme                    string    `gorm:"type:text;default:'dark'" json:"theme"`
	UpdatedAt                time.Time `json:"updatedAt"`
}

// ─── Service Versions ──────────────────────────────────────────────────────

type ServiceVersion struct {
	ID            string    `gorm:"type:text;primaryKey" json:"id"`
	ServiceID     string    `gorm:"type:text;not null;index" json:"serviceId"`
	VersionNumber int       `gorm:"not null" json:"versionNumber"`
	Snapshot      string    `gorm:"type:text" json:"snapshot"` // JSON of service state
	ChangeNote    string    `gorm:"type:text" json:"changeNote"`
	CreatedAt     time.Time `json:"createdAt"`
	CreatedBy     string    `gorm:"type:text" json:"createdBy"`
}

// ─── Service Files ─────────────────────────────────────────────────────────

type ServiceFile struct {
	ID        string    `gorm:"type:text;primaryKey;column:id" json:"id"`
	ServiceID string    `gorm:"type:text;not null;index;column:service_id" json:"serviceId"`
	FilePath  string    `gorm:"type:text;not null;column:file_path" json:"filePath"`
	FileType  string    `gorm:"type:text;column:file_type" json:"fileType"`
	CreatedAt time.Time `json:"createdAt"`
}

func (ServiceFile) TableName() string { return "app_files" }
