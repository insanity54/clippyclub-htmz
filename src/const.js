import { join } from 'path'
import { homedir } from 'os'

export const dataPath = join(homedir(), '.local/share/applications/clippyclub')
export const statePath = join(homedir(), '.local/state/clippyclub')
export const dbPath = join(dataPath, 'clippyclub.sql')