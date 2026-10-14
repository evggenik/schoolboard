import type { TLAssetStore } from 'tldraw'

// onError: функция, которой сообщаем человеку о проблеме
export function createAssetStore(
  roomId: string,
  onError: (message: string) => void,
): TLAssetStore {
  return {
    async upload(_asset, file) {
      try {
        const res = await fetch(`/api/boards/${roomId}/assets`, {
          method: 'POST',
          body: file,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? `Не удалось загрузить файл (${res.status})`)
        }
        const { src } = await res.json()
        return { src }
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Не удалось загрузить файл')
        throw e // пробрасываем дальше, чтобы tldraw понял, что загрузка не удалась
      }
    },
    resolve(asset) {
      return asset.props.src
    },
  }
}