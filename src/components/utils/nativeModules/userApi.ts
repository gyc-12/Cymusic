import UserApiModule from '../../../../modules/cymusic-native/userApi'

let loadScriptInfo: LX.UserApi.UserApiInfo | null = null
let generation: string | null = null
let disposeScript: (() => void) | null = null

const retireScript = () => {
  const dispose = disposeScript
  disposeScript = null
  generation = null
  loadScriptInfo = null
  dispose?.()
}

export const loadScript = (
  info: LX.UserApi.UserApiInfo & { script: string },
  onDispose?: () => void,
): void => {
  retireScript()
  loadScriptInfo = info
  // The existing LX owner supplies one cleanup callback for this load. Keeping it
  // here also pairs a direct facade destroy with its outstanding host requests.
  disposeScript = onDispose ?? null
  try {
    generation = UserApiModule.loadScript({
      id: info.id,
      name: info.name,
      description: info.description,
      version: info.version ?? '',
      author: info.author ?? '',
      homepage: info.homepage ?? '',
      script: info.script,
    })
  } catch (error) {
    retireScript()
    throw error
  }
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T]) => {
  if (!generation) return
  UserApiModule.sendAction(action, JSON.stringify(data), generation)
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  parentRequestKey?: string
  requestType?: 'current' | 'preload'
  url: string
  options: {
    method: string
    data?: any
    body?: any
    form?: Record<string, any>
    formData?: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K] } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  const eventListener = UserApiModule.addListener('api-action', rawEvent => {
    const { generation: eventGeneration, ...payload } = rawEvent
    // This is the final delivery boundary: native/Expo may already have queued
    // an event when another script is loaded. Never parse or enrich stale data.
    if (!generation || eventGeneration !== generation) return
    const event: { action: string, data?: any, type?: string, log?: string } = { ...payload }
    if (event.data) event.data = JSON.parse(event.data as string)
    if (event.action == 'init') {
      if (event.data.info) event.data.info = { ...loadScriptInfo, ...event.data.info }
      else event.data.info = { ...loadScriptInfo }
    } else if (event.action == 'showUpdateAlert') {
      if (!loadScriptInfo?.allowShowUpdateAlert) return
    }
    handler(event as ActionsEvent)
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = () => {
  retireScript()
  UserApiModule.destroy()
}
