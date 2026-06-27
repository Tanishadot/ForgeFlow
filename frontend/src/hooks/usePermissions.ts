import { useAuth } from '../context/AuthContext'

export interface Permissions {
  // ── AI & operational — every authenticated user ──────────────────────────
  canRunScheduler:     boolean
  canExplainSchedule:  boolean
  canViewShiftLogs:    boolean
  canAccessHandover:   boolean
  canSubmitShiftNotes: boolean
  canUpdateStatus:     boolean
  canAccessCopilot:    boolean
  canRunWhatIf:        boolean
  canViewWorkforce:    boolean
  // ── Management — admin only ───────────────────────────────────────────────
  canEditWorkforce:    boolean
  canAssignEmployees:  boolean
  canUploadCSV:        boolean
  canManageInventory:  boolean
  canManageMachines:   boolean
  canManageEmployees:  boolean
  canViewAdminPanel:   boolean
  canEditSchedule:     boolean
  canLockSchedule:     boolean
  canOverrideAI:       boolean
}

export function usePermissions(): Permissions {
  const { role } = useAuth()
  const isAdmin         = role === 'admin'
  const isAuthenticated = role !== null

  return {
    // AI & operational
    canRunScheduler:     isAuthenticated,
    canExplainSchedule:  isAuthenticated,
    canViewShiftLogs:    isAuthenticated,
    canAccessHandover:   isAuthenticated,
    canSubmitShiftNotes: isAuthenticated,
    canUpdateStatus:     isAuthenticated,
    canAccessCopilot:    isAuthenticated,
    canRunWhatIf:        isAuthenticated,
    canViewWorkforce:    isAuthenticated,
    // Admin-only
    canEditWorkforce:    isAdmin,
    canAssignEmployees:  isAdmin,
    canUploadCSV:        isAdmin,
    canManageInventory:  isAdmin,
    canManageMachines:   isAdmin,
    canManageEmployees:  isAdmin,
    canViewAdminPanel:   isAdmin,
    canEditSchedule:     isAdmin,
    canLockSchedule:     isAdmin,
    canOverrideAI:       isAdmin,
  }
}
