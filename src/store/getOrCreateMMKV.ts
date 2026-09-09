
import { createMMKV, type MMKV } from 'react-native-mmkv';
import pathConst from '@/store/pathConst'

const _mmkvCache: Record<string, MMKV> = {};

global.mmkv = _mmkvCache;

// Internal Method
const getOrCreateMMKV = (dbName: string, cachePath = false) => {
    if (_mmkvCache[dbName]) {
        return _mmkvCache[dbName];
    }

    const newStore = createMMKV({
        id: dbName,
        path: cachePath ? pathConst.mmkvCachePath : pathConst.mmkvPath,
    });

    _mmkvCache[dbName] = newStore;
    return newStore;
};

export default getOrCreateMMKV;
