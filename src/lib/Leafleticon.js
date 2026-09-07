import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Leaflet's default L.Icon.Default looks for marker images at hardcoded
// relative paths that don't survive Vite's asset bundling — markers render
// as broken images without this fix. Importing the images directly lets
// Vite resolve them to real URLs, then we point Leaflet's default at those.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})