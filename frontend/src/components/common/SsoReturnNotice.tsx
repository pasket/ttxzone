import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { useToast } from '../../hooks/useToast'
import { ssoErrorKey } from '../../lib/sso'

/** Back from the single sign-on provider anywhere but the sign-in page
 * (a step-up, linking the account): says how it went and takes the
 * outcome off the URL. The sign-in page explains its own. Mounted once. */
export function SsoReturnNotice() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname === '/login') return
    const params = new URLSearchParams(location.search)
    const error = params.get('sso_error')
    const linked = params.get('sso_linked')
    const confirmed = params.get('sso_confirmed')
    if (error === null && linked === null && confirmed === null) return
    if (error !== null) showToast(t(ssoErrorKey(error)), { variant: 'error' })
    else if (linked !== null) showToast(t('auth.sso.linked'))
    else showToast(t('auth.sso.confirmed'))
    params.delete('sso_error')
    params.delete('sso_linked')
    params.delete('sso_confirmed')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true })
  }, [location.pathname, location.search, navigate, showToast, t])

  return null
}
