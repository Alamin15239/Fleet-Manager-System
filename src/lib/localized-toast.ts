import { toast as sonnerToast } from 'sonner'
import { translateText } from '@/contexts/language-context'

type Language = 'en' | 'ar'

function currentLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  try {
    return window.localStorage.getItem('language') === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

function localizeToastArguments(args: unknown[]): unknown[] {
  const language = currentLanguage()
  if (typeof args[0] === 'string') args[0] = translateText(args[0], language)

  if (typeof args[1] === 'object' && args[1] !== null) {
    const options = { ...(args[1] as Record<string, unknown>) }
    for (const key of ['loading', 'success', 'error']) {
      if (typeof options[key] === 'string') {
        options[key] = translateText(options[key] as string, language)
      }
    }
    args[1] = options
  }
  return args
}

const translatedMethods = new Set<PropertyKey>([
  'success',
  'error',
  'warning',
  'info',
  'message',
  'loading',
  'promise',
])

export const toast = new Proxy(sonnerToast, {
  get(target, property, receiver) {
    const method = Reflect.get(target, property, receiver)
    if (!translatedMethods.has(property) || typeof method !== 'function') return method

    return (...args: unknown[]) => Reflect.apply(method, target, localizeToastArguments(args))
  },
  apply(target, thisArg, args) {
    return Reflect.apply(target, thisArg, localizeToastArguments([...args]))
  },
}) as typeof sonnerToast
