import { saveDataMultiple } from '@/helpers/storage'
import { storageDataPrefix } from '@/constants/constant'

const INFO_NAMES = {
  name: 24,
  description: 36,
  author: 56,
  homepage: 1024,
  version: 36,
} as const
type INFO_NAMES_Type = typeof INFO_NAMES

const userApis: LX.UserApi.UserApiInfo[] = []
const userApiPrefix = storageDataPrefix.userApi


export const addUserApi = async(script: string): Promise<LX.UserApi.UserApiInfo> => {
  const result = /^\/\*[\S|\s]+?\*\//.exec(script);
  if (!result) throw new Error('user_api_add_failed_tip');

  const scriptInfo = matchInfo(result[0]);

  scriptInfo.name ||= `user_api_${new Date().toLocaleString()}`;
  const apiInfo = {
    id: `user_api_${Math.random().toString().substring(2, 5)}_${Date.now()}`,
    ...scriptInfo,
    script,
    allowShowUpdateAlert: true,
  };
  userApis.length = 0;

  userApis.push(apiInfo);
  await saveDataMultiple([
    [userApiPrefix, userApis],
    [`${userApiPrefix}${apiInfo.id}`, script],
  ]);
  return apiInfo;
};

const matchInfo = (scriptInfo: string) => {
  const infoArr = scriptInfo.split(/\r?\n/)
  const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
  const infos: Partial<Record<keyof typeof INFO_NAMES, string>> = {}
  for (const info of infoArr) {
    const result = rxp.exec(info)
    if (!result) continue
    const key = result[1] as keyof typeof INFO_NAMES
    if (INFO_NAMES[key] == null) continue
    infos[key] = result[2].trim()
  }

  for (const [key, len] of Object.entries(INFO_NAMES) as Array<{ [K in keyof INFO_NAMES_Type]: [K, INFO_NAMES_Type[K]] }[keyof INFO_NAMES_Type]>) {
    infos[key] ||= ''
    if (infos[key] == null) infos[key] = ''
    else if (infos[key]!.length > len) infos[key] = infos[key]!.substring(0, len) + '...'
  }

  return infos as Record<keyof typeof INFO_NAMES, string>
}
