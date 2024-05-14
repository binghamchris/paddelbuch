import { useEffect } from "react"
import { useMap } from "react-leaflet"
import Locate from "leaflet.locatecontrol"
import "leaflet.locatecontrol/dist/L.Control.Locate.min.css"

const AddLocateLogic = () => {
  // Access the map context with the useMap hook
  const map = useMap()

  // Add locate control once the map loads
  useEffect(() => {
    const locateOptions = {
      position: "bottomright",
      initialZoomLevel: "14",
      flyTo: false,
      showPopup: false,
      enableHighAccuracy: true,
      locateOptions: {
        maxZoom: "14",
      },
      markerStyle: {
        color: "#1b1e43",
        fillColor: "#606589",
      },
      compassStyle: {
        color: "#1b1e43",
        fillColor: "#1b1e43",
        radius: 11,
      },
      circleStyle: {
        color: "#606589",
        fillColor: "#606589",
        fillOpacity: 0.35,
      },
    }
    const locateControl = new Locate(locateOptions)
    locateControl.addTo(map)
  }, [map])

  return null
}

export default AddLocateLogic