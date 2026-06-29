import { useCallback, useEffect, useRef, useState } from 'react'
import { Newspaper, PlusCircle, RefreshCw, Target } from 'lucide-react'
import { Dropzone } from '../components/Dropzone'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { BADGE_COLORS } from '../lib/constants'
import { apiDetail } from '../lib/api'
import type { Offer, PromoFormData, Promotion } from '../lib/types'

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
  }
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
  const [previewText, setPreviewText] = useState('')
  const [previewVisible, setPreviewVisible] = useState(false)

  const [countries, setCountries] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [zips, setZips] = useState<string[]>([])

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
    )

  const loadOffers = useCallback(async () => {
    setOffersLoading(true)
    setOffersErr(false)
    try {
      const d = await adminFetch('/admin/offers')
      setOffers((d.offers as Offer[]) || [])
    } catch {
      setOffersErr(true)
    } finally {
      setOffersLoading(false)
    }
  }, [adminFetch])

  const loadPromotions = useCallback(async () => {
    setPromosLoading(true)
    setPromosErr(false)
    try {
      const d = await adminFetch('/admin/promotions')
      setPromotions((d.promotions as Promotion[]) || [])
    } catch {
      setPromosErr(true)
    } finally {
      setPromosLoading(false)
    }
  }, [adminFetch])

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

  useEffect(() => {
    void loadOffers()
    void loadPromotions()
    void loadAudience()
  }, [loadOffers, loadPromotions, loadAudience])

  const createOffer = async () => {
    const body = {
      title: oTitle.trim(),
      body: oBody.trim(),
      badge: oBadge || null,
      lang: oLang.trim() || 'all',
      link: oLink.trim() || null,
      expires_at: oExpires || null,
      image_key: oImageKey || null,
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
    if (!confirm('Delete this offer?')) return
    try {
      await adminFetch(`/admin/offers/${id}`, { method: 'DELETE' })
      void loadOffers()
    } catch {
      /* ignore */
    }
  }

  const delPromotion = async (id: string) => {
    if (!confirm('Delete this promotion?')) return
    try {
      await adminFetch(`/admin/promotions/${id}`, { method: 'DELETE' })
      void loadPromotions()
    } catch {
      /* ignore */
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
              <Newspaper size={16} className="h-icon" /> Active Offers
            </h2>
            <button type="button" className="sec sm" onClick={() => void loadOffers()}>
              <RefreshCw size={14} />
            </button>
          </div>
          {offersLoading && <div className="empty">Loading…</div>}
          {offersErr && <div className="msg err">Failed to load</div>}
          {!offersLoading && !offersErr && offers.length === 0 && <div className="empty">No active offers.</div>}
          {!offersLoading &&
            !offersErr &&
            offers.map((x) => {
              const exp = x.expires_at ? ` · expires ${x.expires_at}` : ''
              return (
                <div key={x.id} className={`list-item${x.image_url ? ' with-thumb' : ''}`}>
                  {x.image_url && <img className="list-thumb" src={x.image_url} alt="" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">
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
                        {exp}
                      </span>
                      <button type="button" className="del" onClick={() => void delOffer(x.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <Target size={16} className="h-icon" /> Active Promotions
            </h2>
            <button type="button" className="sec sm" onClick={() => void loadPromotions()}>
              <RefreshCw size={14} />
            </button>
          </div>
          {promosLoading && <div className="empty">Loading…</div>}
          {promosErr && <div className="msg err">Failed to load</div>}
          {!promosLoading && !promosErr && promotions.length === 0 && (
            <div className="empty">No active promotions.</div>
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
              const exp = x.expires_at ? ` · expires ${x.expires_at}` : ''
              return (
                <div key={x.id} className={`list-item${x.image_url ? ' with-thumb' : ''}`}>
                  {x.image_url && <img className="list-thumb" src={x.image_url} alt="" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">
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
                      <span className="meta">{exp}</span>
                      <button type="button" className="del" onClick={() => void delPromotion(x.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </>
  )
}
