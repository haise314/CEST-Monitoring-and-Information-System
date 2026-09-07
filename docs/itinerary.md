# Itinerary feature — what's here and what's left

## Files (drop into your repo at these paths)

```
src/lib/geo.js                          new
src/lib/officeLocation.js               new — placeholder, needs real coords or leave null
src/lib/beneficiaryFilters.js           new — optional future reuse, see note in file
src/hooks/useMergedBeneficiaries.js     new — optional future reuse, see note in file
src/hooks/useItineraries.js             new
src/pages/itinerary/Itinerary.jsx       new
src/pages/itinerary/CandidatePool.jsx   new
src/pages/itinerary/StopList.jsx        new
```

**Nothing existing was edited.** Map.jsx, map/filterBar.jsx, and everything
else are untouched — `useMergedBeneficiaries.js` and `beneficiaryFilters.js`
duplicate logic that already lives inline in Map.jsx rather than refactor a
working page. Each file has a comment explaining the optional later swap if
you want to de-duplicate.

`Itinerary.jsx` imports `MapFilterBar` directly from
`../map/filterBar` (i.e. `src/pages/map/filterBar.jsx`) — reused as-is, no
changes needed to it.

## Wiring it in (I don't have your current App.jsx/Navbar.jsx)

Same situation as when `/map` was added — I don't want to guess-edit files I
haven't seen and risk reintroducing something already fixed. In `App.jsx`:

```jsx
import ItineraryPage from './pages/itinerary/Itinerary'
// ...inside your routes array, alongside the /map route:
{ path: '/itinerary', element: <ItineraryPage /> }
```

And a link in `Navbar.jsx` alongside the existing route links.

If you upload the current `App.jsx` and `Navbar.jsx`, I can make this edit
directly instead.

## Things that need your input

1. **`OFFICE_LOCATION`** in `src/lib/officeLocation.js` is `null`. Set it to
   your actual office lat/lng if you want auto-order to start from there;
   otherwise it starts from the first stop you add, which is a fine default
   too.
2. **`saveStops` is not transactional** (delete-then-insert, two calls — see
   comment in `useItineraries.js`). Fine for a low-traffic internal tool;
   flagging it rather than silently letting it slide.
3. **One itinerary = one day.** If you actually want several days grouped
   under one saved plan (vs. separate itinerary records you flip between),
   that needs a schema change (e.g. a `day_number` or `group_id` column) —
   tell me and I'll design that instead.

## Try it

1. Open `/itinerary`, pick filters (same filter bar as `/map`), add a few
   pinned beneficiaries to the stop list.
2. Hit "Auto-order" to see the nearest-neighbor sequence; drag-free reorder
   via the ▲▼ buttons.
3. Name it, optionally set a visit date, "Create & save."
4. Reopen it from the dropdown at the top to confirm stops persisted in the
   right order.