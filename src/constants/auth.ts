export function loginIdToAuthEmail(loginId:string) {
  const id = String(loginId ?? '').trim()
  if (!id) {
    throw new Error('Email or PAN is required.')
  }
  if (id.includes('@')) {
    return id
  }
  return id
}