import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Newspaper, Pencil, PlusCircle, RefreshCw, RotateCcw, Target, X } from 'lucide-react'
import { Dropzone } from '../components/Dropzone'
import { MultiSelectSearch } from '../components/MultiSelectSearch'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { BADGE_COLORS } from '../lib/constants'
import { apiDetail } from '../lib/api'
import type { Offer, PromoFormData, Promotion, RegionRow } from '../lib/types'

function buildPromoForm(
  title: string,
  body: string,
  link: string,
  expires: string,
  countries: string,
  cities: string,
  zips: string,
  childMin: string,
  childMax: string,
  ageMin: string,
  ageMax: string,
  pregnant: boolean,
  notPregnant: boolean,
  imageKey: string,
  regionIds: string[],
): PromoFormData {
  const selVal = (v: string) => (v ? [v] : null)
  const target_pregnancy = pregnant && !notPregnant ? true : !pregnant && notPregnant ? false : null
  return {
    title: title.trim(),
    body: body.trim(),
    link: link.trim() || null,
    expires_at: expires || null,
    target_countries: selVal(countries),
    target_cities: selVal(cities),
    target_zips: selVal(zips),
    child_count_min: childMin !== '' ? parseInt(childMin, 10) : null,
    child_count_max: childMax !== '' ? parseInt(childMax, 10) : null,
    target_pregnancy,
    child_age_min_months: ageMin !== '' ? parseInt(ageMin, 10) : null,
    child_age_max_months: ageMax !== '' ? parseInt(ageMax, 10) : null,
    image_key: imageKey || null,
    region_ids: regionIds.length ? regionIds : null,
  }
}

function dateInputValue(v?: string | null) {
  if (!v) return ''
  return v.slice(0, 10)
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="content-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ContentTab() {
  const { adminFetch } = useAdmin()
  const offerMsg = useFlashMessage()
  const promoMsg = useFlashMessage()

  const [offers, setOffers] = useState<Offer[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [offersLoading, setOffersLoading] = useState(true)
  const [promosLoading, setPromosLoading] = useState(true)
  const [offersErr, setOffersErr] = useState(false)
  const [promosErr, setPromosErr] = useState(false)

  const [oTitle, setOTitle] = useState('')
  const [oBody, setOBody] = useState('')
  const [oBadge, setOBadge] = useState('')
  const [oLang, setOLang] = useState('all')
  const [oLink, setOLink] = useState('')
  const [oExpires, setOExpires] = useState('')
  const [oImageKey, setOImageKey] = useState('')
  const [oPreview, setOPreview] = useState('')
  const [oRegionIds, setORegionIds] = useState<string[]>([])

  const [pTitle, setPTitle] = useState('')
  const [pBody, setPBody] = useState('')
  const [pLink, setPLink] = useState('')
  const [pExpires, setPExpires] = useState('')
  const [pCountries, setPCountries] = useState('')
  const [pCities, setPCities] = useState('')
  const [pZips, setPZips] = useState('')
  const [pChildMin, setPChildMin] = useState('')
  const [pChildMax, setPChildMax] = useState('')
  const [pAgeMin, setPAgeMin] = useState('')
  const [pAgeMax, setPAgeMax] = useState('')
  const [pPregnant, setPPregnant] = useState(false)
  const [pNotPregnant, setPNotPregnant] = useState(false)
  const [pImageKey, setPImageKey] = useState('')
  const [pPreview, setPPreview] = useState('')
  const [pRegionIds, setPRegionIds] = useState<string[]>([])
  const [previewText, setPreviewText] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)

  const [countries, setCountries] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [zips, setZips] = useState<string[]>([])
  const [regions, setRegions] = useState<RegionRow[]>([])

  const [editOfferId, setEditOfferId] = useState<string | null>(null)
  const [eOTitle, setEOTitle] = useState('')
  const [eOBody, setEOBody] = useState('')
  const [eOBadge, setEOBadge] = useState('')
  const [eOLang, setEOLang] = useState('all')
  const [eOLink, setEOLink] = useState('')
  const [eOExpires, setEOExpires] = useState('')
  const [eOImageKey, setEOImageKey] = useState('')
  const [eOPreview, setEOPreview] = useState('')
  const [eORegionIds, setEORegionIds] = useState<string[]>([])
  const [savingOfferEdit, setSavingOfferEdit] = useState(false)

  const [editPromoId, setEditPromoId] = useState<string | null>(null)
  const [ePTitle, setEPTitle] = useState('')
  const [ePBody, setEPBody] = useState('')
  const [ePLink, setEPLink] = useState('')
  const [ePExpires, setEPExpires] = useState('')
  const [ePCountries, setEPCountries] = useState('')
  const [ePCities, setEPCities] = useState('')
  const [ePZips, setEPZips] = useState('')
  const [ePChildMin, setEPChildMin] = useState('')
  const [ePChildMax, setEPChildMax] = useState('')
  const [ePAgeMin, setEPAgeMin] = useState('')
  const [ePAgeMax, setEPAgeMax] = useState('')
  const [ePPregnant, setEPPregnant] = useState(false)
  const [ePNotPregnant, setEPNotPregnant] = useState(false)
  const [ePImageKey, setEPImageKey] = useState('')
  const [ePPreview, setEPPreview] = useState('')
  const [ePRegionIds, setEPRegionIds] = useState<string[]>([])
  const [savingPromoEdit, setSavingPromoEdit] = useState(false)
  const [showDeletedOffers, setShowDeletedOffers] = useState(false)
  const [showDeletedPromos, setShowDeletedPromos] = useState(false)
  const [restoringOfferId, setRestoringOfferId] = useState<string | null>(null)
  const [restoringPromoId, setRestoringPromoId] = useState<string | null>(null)

  const pvTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const promoData = () =>
    buildPromoForm(
      pTitle,
      pBody,
      pLink,
      pExpires,
      pCountries,
      pCities,
      pZips,
      pChildMin,
      pChildMax,
      pAgeMin,
      pAgeMax,
      pPregnant,
      pNotPregnant,
      pImageKey,
      pRegionIds,
    )

  const loadOffers = useCallback(async () => {
    setOffersLoading(true)
    setOffersErr(false)
    try {
      const qs = showDeletedOffers ? '?deleted_only=true' : ''
      const d = await adminFetch(`/admin/offers${qs}`)
      setOffers((d.offers as Offer[]) || [])
    } catch {
      setOffersErr(true)
    } finally {
      setOffersLoading(false)
    }
  }, [adminFetch, showDeletedOffers])

  const loadPromotions = useCallback(async () => {
    setPromosLoading(true)
    setPromosErr(false)
    try {
      const qs = showDeletedPromos ? '?deleted_only=true' : ''
      const d = await adminFetch(`/admin/promotions${qs}`)
      setPromotions((d.promotions as Promotion[]) || [])
    } catch {
      setPromosErr(true)
    } finally {
      setPromosLoading(false)
    }
  }, [adminFetch, showDeletedPromos])

  const loadAudience = useCallback(async () => {
    try {
      const d = await adminFetch('/admin/promotions/audience')
      setCountries((d.countries as string[]) || [])
      setCities((d.cities as string[]) || [])
      setZips((d.zips as string[]) || [])
    } catch {
      /* ignore */
    }
  }, [adminFetch])

  const loadRegions = useCallback(async () => {
    try {
      const d = await adminFetch('/admin/regions')
      setRegions((d.regions as RegionRow[]) || [])
    } catch {
      /* ignore */
    }
  }, [adminFetch])

  useEffect(() => {
    void loadOffers()
    void loadPromotions()
    void loadAudience()
    void loadRegions()
  }, [loadOffers, loadPromotions, loadAudience, loadRegions])

  const regionOptions = regions
    .filter((r) => r.active !== false && !r.is_deleted)
    .map((r) => ({
      value: r.id,
      label: r.name,
      hint: (r.languages || []).join(', '),
    }))

  const regionSummary = (ids?: string[], linked?: RegionRow[]) => {
    const names =
      linked?.map((r) => r.name) ||
      (ids || []).map((id) => regions.find((r) => r.id === id)?.name).filter(Boolean)
    return names.length ? names.join(', ') : 'All regions'
  }

  const createOffer = async () => {
    const body = {
      title: oTitle.trim(),
      body: oBody.trim(),
      badge: oBadge || null,
      lang: oLang.trim() || 'all',
      link: oLink.trim() || null,
      expires_at: oExpires || null,
      image_key: oImageKey || null,
      region_ids: oRegionIds.length ? oRegionIds : null,
    }
    if (!body.title || !body.body) {
      offerMsg.show('Title and body required', 'err')
      return
    }
    try {
      const d = await adminFetch('/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (d.ok) {
        offerMsg.show('Offer published ✓', 'ok')
        setOTitle('')
        setOBody('')
        setOLink('')
        setOExpires('')
        setOBadge('')
        setOImageKey('')
        setOPreview('')
        setORegionIds([])
        void loadOffers()
      } else {
        offerMsg.show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      offerMsg.show(e instanceof Error ? e.message : 'Failed', 'err')
    }
  }

  const createPromotion = async () => {
    const body = promoData()
    if (!body.title || !body.body) {
      promoMsg.show('Title and body required', 'err')
      return
    }
    try {
      const d = await adminFetch('/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (d.ok) {
        promoMsg.show('Promotion published ✓', 'ok')
        setPTitle('')
        setPBody('')
        setPLink('')
        setPExpires('')
        setPCountries('')
        setPCities('')
        setPZips('')
        setPChildMin('')
        setPChildMax('')
        setPAgeMin('')
        setPAgeMax('')
        setPPregnant(false)
        setPNotPregnant(false)
        setPImageKey('')
        setPPreview('')
        setPRegionIds([])
        setPreviewVisible(false)
        void loadPromotions()
      } else {
        promoMsg.show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      promoMsg.show(e instanceof Error ? e.message : 'Failed', 'err')
    }
  }

  const runPreview = async (data: PromoFormData) => {
    setPreviewVisible(true)
    setPreviewText('Checking…')
    try {
      const d = await adminFetch('/admin/promotions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (d.error) setPreviewText(`Error: ${d.error}`)
      else setPreviewText(`✅ ${d.count} users match (of ${d.total} with consent)`)
    } catch {
      setPreviewText('Network error')
    }
  }

  const schedulePreview = () => {
    if (pvTimer.current) clearTimeout(pvTimer.current)
    pvTimer.current = setTimeout(() => {
      const d = promoData()
      const hasFilter =
        d.target_countries ||
        d.target_cities ||
        d.target_zips ||
        d.child_count_min != null ||
        d.child_count_max != null ||
        d.child_age_min_months != null ||
        d.child_age_max_months != null ||
        d.target_pregnancy != null
      if (!hasFilter) return
      setPreviewVisible(true)
      setPreviewText('Checking…')
      void adminFetch('/admin/promotions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      })
        .then((r) => {
          if (r.error) setPreviewText(`Error: ${r.error}`)
          else setPreviewText(`👥 ${r.count} match (of ${r.total} consenting)`)
        })
        .catch(() => setPreviewText('Preview failed'))
    }, 600)
  }

  const delOffer = async (id: string) => {
    if (!confirm('Soft-delete this offer? You can restore it later from the deleted list.')) return
    try {
      await adminFetch(`/admin/offers/${id}`, { method: 'DELETE' })
      offerMsg.show('Offer soft-deleted', 'ok')
      void loadOffers()
    } catch {
      offerMsg.show('Delete failed', 'err')
    }
  }

  const delPromotion = async (id: string) => {
    if (!confirm('Soft-delete this promotion? You can restore it later from the deleted list.')) return
    try {
      await adminFetch(`/admin/promotions/${id}`, { method: 'DELETE' })
      promoMsg.show('Promotion soft-deleted', 'ok')
      void loadPromotions()
    } catch {
      promoMsg.show('Delete failed', 'err')
    }
  }

  const restoreOffer = async (id: string) => {
    setRestoringOfferId(id)
    try {
      const d = await adminFetch(`/admin/offers/${id}/restore`, { method: 'POST' })
      if (d.ok) {
        offerMsg.show('Offer restored', 'ok')
        void loadOffers()
      } else {
        offerMsg.show(apiDetail(d) || 'Restore failed', 'err')
      }
    } catch (e) {
      offerMsg.show(e instanceof Error ? e.message : 'Restore failed', 'err')
    } finally {
      setRestoringOfferId(null)
    }
  }

  const restorePromotion = async (id: string) => {
    setRestoringPromoId(id)
    try {
      const d = await adminFetch(`/admin/promotions/${id}/restore`, { method: 'POST' })
      if (d.ok) {
        promoMsg.show('Promotion restored', 'ok')
        void loadPromotions()
      } else {
        promoMsg.show(apiDetail(d) || 'Restore failed', 'err')
      }
    } catch (e) {
      promoMsg.show(e instanceof Error ? e.message : 'Restore failed', 'err')
    } finally {
      setRestoringPromoId(null)
    }
  }

  const openEditOffer = (o: Offer) => {
    setEditOfferId(o.id)
    setEOTitle(o.title || '')
    setEOBody(o.body || '')
    setEOBadge(o.badge || '')
    setEOLang(o.lang || 'all')
    setEOLink(o.link || '')
    setEOExpires(dateInputValue(o.expires_at))
    setEOImageKey(o.image_key || '')
    setEOPreview(o.image_url || '')
    setEORegionIds(o.region_ids || o.regions?.map((r) => r.id) || [])
  }

  const closeEditOffer = () => {
    if (savingOfferEdit) return
    setEditOfferId(null)
  }

  const saveEditOffer = async () => {
    if (!editOfferId) return
    const body = {
      title: eOTitle.trim(),
      body: eOBody.trim(),
      badge: eOBadge || null,
      lang: eOLang.trim() || 'all',
      link: eOLink.trim() || null,
      expires_at: eOExpires || null,
      image_key: eOImageKey || null,
      region_ids: eORegionIds.length ? eORegionIds : null,
    }
    if (!body.title || !body.body) {
      offerMsg.show('Title and body required', 'err')
      return
    }
    setSavingOfferEdit(true)
    try {
      const d = await adminFetch(`/admin/offers/${editOfferId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (d.ok) {
        offerMsg.show('Offer updated ✓', 'ok')
        setEditOfferId(null)
        void loadOffers()
      } else {
        offerMsg.show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      offerMsg.show(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setSavingOfferEdit(false)
    }
  }

  const openEditPromo = (p: Promotion) => {
    setEditPromoId(p.id)
    setEPTitle(p.title || '')
    setEPBody(p.body || '')
    setEPLink(p.link || '')
    setEPExpires(dateInputValue(p.expires_at))
    setEPCountries(p.target_countries?.[0] || '')
    setEPCities(p.target_cities?.[0] || '')
    setEPZips(p.target_zips?.[0] || '')
    setEPChildMin(p.child_count_min != null ? String(p.child_count_min) : '')
    setEPChildMax(p.child_count_max != null ? String(p.child_count_max) : '')
    setEPAgeMin(p.child_age_min_months != null ? String(p.child_age_min_months) : '')
    setEPAgeMax(p.child_age_max_months != null ? String(p.child_age_max_months) : '')
    setEPPregnant(p.target_pregnancy === true)
    setEPNotPregnant(p.target_pregnancy === false)
    setEPImageKey(p.image_key || '')
    setEPPreview(p.image_url || '')
    setEPRegionIds(p.region_ids || p.regions?.map((r) => r.id) || [])
  }

  const closeEditPromo = () => {
    if (savingPromoEdit) return
    setEditPromoId(null)
  }

  const editPromoPayload = (): PromoFormData =>
    buildPromoForm(
      ePTitle,
      ePBody,
      ePLink,
      ePExpires,
      ePCountries,
      ePCities,
      ePZips,
      ePChildMin,
      ePChildMax,
      ePAgeMin,
      ePAgeMax,
      ePPregnant,
      ePNotPregnant,
      ePImageKey,
      ePRegionIds,
    )

  const saveEditPromo = async () => {
    if (!editPromoId) return
    const body = editPromoPayload()
    if (!body.title || !body.body) {
      promoMsg.show('Title and body required', 'err')
      return
    }
    setSavingPromoEdit(true)
    try {
      const d = await adminFetch(`/admin/promotions/${editPromoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (d.ok) {
        promoMsg.show('Promotion updated ✓', 'ok')
        setEditPromoId(null)
        void loadPromotions()
      } else {
        promoMsg.show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      promoMsg.show(e instanceof Error ? e.message : 'Failed', 'err')
    } finally {
      setSavingPromoEdit(false)
    }
  }

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <PlusCircle size={16} className="h-icon" /> New Offer / News
            </h2>
          </div>
          {offerMsg.Message}
          <FieldLabel required>Title</FieldLabel>
          <input value={oTitle} onChange={(e) => setOTitle(e.target.value)} placeholder="Offer title" />
          <FieldLabel required>Message</FieldLabel>
          <textarea value={oBody} onChange={(e) => setOBody(e.target.value)} placeholder="Message body" />
          <FieldLabel>Image (optional)</FieldLabel>
          <Dropzone
            bucket="offers"
            imageKey={oImageKey}
            previewUrl={oPreview}
            onUploaded={(key, url) => {
              setOImageKey(key)
              setOPreview(url)
            }}
            onClear={() => {
              setOImageKey('')
              setOPreview('')
            }}
            onError={(m) => offerMsg.show(m, 'err')}
          />
          <div className="row">
            <div className="field-wrap">
              <FieldLabel>Badge</FieldLabel>
              <select value={oBadge} onChange={(e) => setOBadge(e.target.value)}>
                <option value="">No badge</option>
                <option value="news">news</option>
                <option value="promo">promo</option>
                <option value="sponsored">sponsored</option>
              </select>
            </div>
            <div className="field-wrap">
              <FieldLabel>Language</FieldLabel>
              <input value={oLang} onChange={(e) => setOLang(e.target.value)} placeholder="all / el / en…" />
            </div>
          </div>
          <FieldLabel>Link (optional)</FieldLabel>
          <input value={oLink} onChange={(e) => setOLink(e.target.value)} placeholder="https://…" />
          <FieldLabel>Expiry (optional)</FieldLabel>
          <input type="date" value={oExpires} onChange={(e) => setOExpires(e.target.value)} />
          <FieldLabel>Regions (optional)</FieldLabel>
          <MultiSelectSearch
            options={regionOptions}
            value={oRegionIds}
            onChange={setORegionIds}
            placeholder="Search regions…"
            emptyLabel="No regions — create some in the Regions tab"
          />
          <p className="field" style={{ marginTop: -4 }}>
            Blank = visible in all regions
          </p>
          <button
            type="button"
            style={{ width: '100%' }}
            disabled={!oTitle.trim() || !oBody.trim()}
            onClick={() => void createOffer()}
          >
            Publish offer →
          </button>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <Target size={16} className="h-icon" /> New Promotion
            </h2>
          </div>
          <p className="card-desc">Targeted · consent users only</p>
          {promoMsg.Message}
          <FieldLabel required>Title</FieldLabel>
          <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="Promotion title" />
          <FieldLabel required>Message</FieldLabel>
          <textarea value={pBody} onChange={(e) => setPBody(e.target.value)} placeholder="Message body" />
          <FieldLabel>Image (optional)</FieldLabel>
          <Dropzone
            bucket="promotions"
            imageKey={pImageKey}
            previewUrl={pPreview}
            onUploaded={(key, url) => {
              setPImageKey(key)
              setPPreview(url)
            }}
            onClear={() => {
              setPImageKey('')
              setPPreview('')
            }}
            onError={(m) => promoMsg.show(m, 'err')}
          />
          <FieldLabel>Link (optional)</FieldLabel>
          <input value={pLink} onChange={(e) => setPLink(e.target.value)} placeholder="https://…" />
          <FieldLabel>Expiry</FieldLabel>
          <input type="date" value={pExpires} onChange={(e) => setPExpires(e.target.value)} />
          <FieldLabel>Regions (optional)</FieldLabel>
          <MultiSelectSearch
            options={regionOptions}
            value={pRegionIds}
            onChange={setPRegionIds}
            placeholder="Search regions…"
            emptyLabel="No regions — create some in the Regions tab"
          />
          <p className="field" style={{ marginTop: -4 }}>
            Blank = visible in all regions
          </p>
          <p className="field" style={{ marginTop: 4 }}>
            📍 GEO (blank = all)
          </p>
          <div className="row">
            <select
              value={pCountries}
              onChange={(e) => {
                setPCountries(e.target.value)
                schedulePreview()
              }}
            >
              <option value="">All countries</option>
              {countries.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={pCities}
              onChange={(e) => {
                setPCities(e.target.value)
                schedulePreview()
              }}
            >
              <option value="">All cities</option>
              {cities.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={pZips}
              onChange={(e) => {
                setPZips(e.target.value)
                schedulePreview()
              }}
            >
              <option value="">All ZIPs</option>
              {zips.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <p className="field" style={{ marginTop: 4 }}>
            👶 Demographic (blank = all)
          </p>
          <div className="row">
            <input
              type="number"
              placeholder="Child min"
              min={0}
              value={pChildMin}
              onChange={(e) => {
                setPChildMin(e.target.value)
                schedulePreview()
              }}
            />
            <input
              type="number"
              placeholder="Child max"
              min={0}
              value={pChildMax}
              onChange={(e) => {
                setPChildMax(e.target.value)
                schedulePreview()
              }}
            />
            <input
              type="number"
              placeholder="Age min (mo)"
              min={0}
              value={pAgeMin}
              onChange={(e) => {
                setPAgeMin(e.target.value)
                schedulePreview()
              }}
            />
            <input
              type="number"
              placeholder="Age max (mo)"
              min={0}
              value={pAgeMax}
              onChange={(e) => {
                setPAgeMax(e.target.value)
                schedulePreview()
              }}
            />
          </div>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={pPregnant}
                onChange={(e) => {
                  setPPregnant(e.target.checked)
                  schedulePreview()
                }}
              />{' '}
              🤰 Pregnant only
            </label>
            <label>
              <input
                type="checkbox"
                checked={pNotPregnant}
                onChange={(e) => {
                  setPNotPregnant(e.target.checked)
                  schedulePreview()
                }}
              />{' '}
              👶 Non-pregnant only
            </label>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <button type="button" className="sec" onClick={() => void runPreview(promoData())}>
              👁 Preview match
            </button>
            <button type="button" disabled={!pTitle.trim() || !pBody.trim()} onClick={() => void createPromotion()}>
              Publish →
            </button>
          </div>
          {previewVisible && <div className="preview-box">{previewText}</div>}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <Newspaper size={16} className="h-icon" /> {showDeletedOffers ? 'Deleted Offers' : 'Active Offers'}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="show-deleted-toggle">
                <input
                  type="checkbox"
                  checked={showDeletedOffers}
                  onChange={(e) => setShowDeletedOffers(e.target.checked)}
                />
                Show deleted
              </label>
              <button type="button" className="sec sm" onClick={() => void loadOffers()}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          {offersLoading && <div className="empty">Loading…</div>}
          {offersErr && <div className="msg err">Failed to load</div>}
          {!offersLoading && !offersErr && offers.length === 0 && (
            <div className="empty">{showDeletedOffers ? 'No deleted offers.' : 'No active offers.'}</div>
          )}
          {!offersLoading &&
            !offersErr &&
            offers.map((x) => {
              const exp = x.expires_at ? ` · expires ${x.expires_at}` : ''
              const deleted = x.is_deleted || showDeletedOffers
              return (
                <div key={x.id} className={`list-item${x.image_url ? ' with-thumb' : ''}${deleted ? ' is-deleted' : ''}`}>
                  {x.image_url && <img className="list-thumb" src={x.image_url} alt="" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">
                      {deleted && <span className="badge badge-warn">deleted</span>}
                      {x.badge && (
                        <span className="badge" style={{ background: BADGE_COLORS[x.badge] || '#999' }}>
                          {x.badge}
                        </span>
                      )}
                      {x.title}
                    </div>
                    <div className="b">{x.body || ''}</div>
                    <div className="foot">
                      <span className="meta">
                        {x.lang || 'all'}
                        {' · '}
                        {regionSummary(x.region_ids, x.regions)}
                        {exp}
                        {x.created_by_name ? ` · by ${x.created_by_name}` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {deleted ? (
                          <button
                            type="button"
                            className="sec sm"
                            disabled={restoringOfferId === x.id}
                            onClick={() => void restoreOffer(x.id)}
                            title="Restore"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="sec sm"
                              onClick={() => openEditOffer(x)}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="del" onClick={() => void delOffer(x.id)}>
                              Soft delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <Target size={16} className="h-icon" /> {showDeletedPromos ? 'Deleted Promotions' : 'Active Promotions'}
            </h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="show-deleted-toggle">
                <input
                  type="checkbox"
                  checked={showDeletedPromos}
                  onChange={(e) => setShowDeletedPromos(e.target.checked)}
                />
                Show deleted
              </label>
              <button type="button" className="sec sm" onClick={() => void loadPromotions()}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          {promosLoading && <div className="empty">Loading…</div>}
          {promosErr && <div className="msg err">Failed to load</div>}
          {!promosLoading && !promosErr && promotions.length === 0 && (
            <div className="empty">{showDeletedPromos ? 'No deleted promotions.' : 'No active promotions.'}</div>
          )}
          {!promosLoading &&
            !promosErr &&
            promotions.map((x) => {
              const geo: string[] = []
              const demo: string[] = []
              if (x.target_countries?.length) geo.push(`🌍 ${x.target_countries.join(', ')}`)
              if (x.target_cities?.length) geo.push(`🏙 ${x.target_cities.join(', ')}`)
              if (x.target_zips?.length) geo.push(`📮 ${x.target_zips.join(', ')}`)
              if (x.child_count_min != null || x.child_count_max != null)
                demo.push(`👶 ${x.child_count_min ?? 0}–${x.child_count_max ?? '∞'}`)
              if (x.target_pregnancy === true) demo.push('🤰 pregnant')
              if (x.target_pregnancy === false) demo.push('non-pregnant')
              if (x.child_age_min_months != null || x.child_age_max_months != null)
                demo.push(`🗓 ${x.child_age_min_months ?? 0}–${x.child_age_max_months ?? '∞'}mo`)
              const chips = [...geo, ...demo]
              const regionLine = regionSummary(x.region_ids, x.regions)
              const exp = x.expires_at ? ` · expires ${x.expires_at}` : ''
              const deleted = x.is_deleted || showDeletedPromos
              return (
                <div key={x.id} className={`list-item${x.image_url ? ' with-thumb' : ''}${deleted ? ' is-deleted' : ''}`}>
                  {x.image_url && <img className="list-thumb" src={x.image_url} alt="" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">
                      {deleted && <span className="badge badge-warn">deleted</span>}
                      <span className="badge" style={{ background: '#7C5CBF' }}>
                        sponsored
                      </span>
                      {x.title}
                    </div>
                    <div className="b">{x.body}</div>
                    <div style={{ margin: '8px 0' }}>
                      {chips.length
                        ? chips.map((t) => (
                            <span key={t} className="chip">
                              {t}
                            </span>
                          ))
                        : <span className="meta">All consenting users</span>}
                    </div>
                    <div className="foot">
                      <span className="meta">
                        🌐 {regionLine}
                        {exp}
                        {x.created_by_name ? ` · by ${x.created_by_name}` : ''}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {deleted ? (
                          <button
                            type="button"
                            className="sec sm"
                            disabled={restoringPromoId === x.id}
                            onClick={() => void restorePromotion(x.id)}
                            title="Restore"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="sec sm"
                              onClick={() => openEditPromo(x)}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button type="button" className="del" onClick={() => void delPromotion(x.id)}>
                              Soft delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {editOfferId && (
        <Modal title="Edit offer" onClose={closeEditOffer}>
          {offerMsg.Message}
          <FieldLabel required>Title</FieldLabel>
          <input value={eOTitle} onChange={(e) => setEOTitle(e.target.value)} />
          <FieldLabel required>Message</FieldLabel>
          <textarea value={eOBody} onChange={(e) => setEOBody(e.target.value)} rows={4} />
          <FieldLabel>Image</FieldLabel>
          <Dropzone
            bucket="offers"
            imageKey={eOImageKey}
            previewUrl={eOPreview}
            onUploaded={(key, url) => {
              setEOImageKey(key)
              setEOPreview(url)
            }}
            onClear={() => {
              setEOImageKey('')
              setEOPreview('')
            }}
            onError={(m) => offerMsg.show(m, 'err')}
          />
          <div className="row">
            <div className="field-wrap">
              <FieldLabel>Badge</FieldLabel>
              <select value={eOBadge} onChange={(e) => setEOBadge(e.target.value)}>
                <option value="">No badge</option>
                <option value="news">news</option>
                <option value="promo">promo</option>
                <option value="sponsored">sponsored</option>
              </select>
            </div>
            <div className="field-wrap">
              <FieldLabel>Language</FieldLabel>
              <input value={eOLang} onChange={(e) => setEOLang(e.target.value)} placeholder="all / el / en…" />
            </div>
          </div>
          <FieldLabel>Link (optional)</FieldLabel>
          <input value={eOLink} onChange={(e) => setEOLink(e.target.value)} placeholder="https://…" />
          <FieldLabel>Expiry (optional)</FieldLabel>
          <input type="date" value={eOExpires} onChange={(e) => setEOExpires(e.target.value)} />
          <FieldLabel>Regions (optional)</FieldLabel>
          <MultiSelectSearch
            options={regionOptions}
            value={eORegionIds}
            onChange={setEORegionIds}
            placeholder="Search regions…"
          />
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={closeEditOffer} disabled={savingOfferEdit}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveEditOffer()} disabled={savingOfferEdit}>
              {savingOfferEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}

      {editPromoId && (
        <Modal title="Edit promotion" onClose={closeEditPromo}>
          {promoMsg.Message}
          <FieldLabel required>Title</FieldLabel>
          <input value={ePTitle} onChange={(e) => setEPTitle(e.target.value)} />
          <FieldLabel required>Message</FieldLabel>
          <textarea value={ePBody} onChange={(e) => setEPBody(e.target.value)} rows={4} />
          <FieldLabel>Image</FieldLabel>
          <Dropzone
            bucket="promotions"
            imageKey={ePImageKey}
            previewUrl={ePPreview}
            onUploaded={(key, url) => {
              setEPImageKey(key)
              setEPPreview(url)
            }}
            onClear={() => {
              setEPImageKey('')
              setEPPreview('')
            }}
            onError={(m) => promoMsg.show(m, 'err')}
          />
          <FieldLabel>Link (optional)</FieldLabel>
          <input value={ePLink} onChange={(e) => setEPLink(e.target.value)} />
          <FieldLabel>Expiry</FieldLabel>
          <input type="date" value={ePExpires} onChange={(e) => setEPExpires(e.target.value)} />
          <FieldLabel>Regions (optional)</FieldLabel>
          <MultiSelectSearch
            options={regionOptions}
            value={ePRegionIds}
            onChange={setEPRegionIds}
            placeholder="Search regions…"
          />
          <p className="field" style={{ marginTop: 4 }}>
            📍 GEO (blank = all)
          </p>
          <div className="row">
            <select value={ePCountries} onChange={(e) => setEPCountries(e.target.value)}>
              <option value="">All countries</option>
              {countries.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select value={ePCities} onChange={(e) => setEPCities(e.target.value)}>
              <option value="">All cities</option>
              {cities.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select value={ePZips} onChange={(e) => setEPZips(e.target.value)}>
              <option value="">All ZIPs</option>
              {zips.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <p className="field" style={{ marginTop: 4 }}>
            👶 Demographic (blank = all)
          </p>
          <div className="row">
            <input
              type="number"
              placeholder="Child min"
              min={0}
              value={ePChildMin}
              onChange={(e) => setEPChildMin(e.target.value)}
            />
            <input
              type="number"
              placeholder="Child max"
              min={0}
              value={ePChildMax}
              onChange={(e) => setEPChildMax(e.target.value)}
            />
            <input
              type="number"
              placeholder="Age min (mo)"
              min={0}
              value={ePAgeMin}
              onChange={(e) => setEPAgeMin(e.target.value)}
            />
            <input
              type="number"
              placeholder="Age max (mo)"
              min={0}
              value={ePAgeMax}
              onChange={(e) => setEPAgeMax(e.target.value)}
            />
          </div>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={ePPregnant}
                onChange={(e) => setEPPregnant(e.target.checked)}
              />{' '}
              🤰 Pregnant only
            </label>
            <label>
              <input
                type="checkbox"
                checked={ePNotPregnant}
                onChange={(e) => setEPNotPregnant(e.target.checked)}
              />{' '}
              👶 Non-pregnant only
            </label>
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={closeEditPromo} disabled={savingPromoEdit}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveEditPromo()} disabled={savingPromoEdit}>
              {savingPromoEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
