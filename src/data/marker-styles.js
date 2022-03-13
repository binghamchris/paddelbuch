import EinsteigAufsteigMarker2x from "assets/images/markers/marker-2x-startingspots-entryexit.png";
import EinsteigMarker2x from "assets/images/markers/marker-2x-startingspots-entry.png";
import AufsteigMarker2x from "assets/images/markers/marker-2x-otherspots-exit.png";
import NotauswasserungMarker2x from "assets/images/markers/marker-2x-otherspots-emergency.png";
import RasthalteMarker2x from "assets/images/markers/marker-2x-otherspots-rest.png";
import EinsteigAufsteigMarker from "assets/images/markers/marker-startingspots-entryexit.png";
import EinsteigMarker from "assets/images/markers/marker-startingspots-entry.png";
import AufsteigMarker from "assets/images/markers/marker-otherspots-exit.png";
import NotauswasserungMarker from "assets/images/markers/marker-otherspots-emergency.png";
import RasthalteMarker from "assets/images/markers/marker-otherspots-rest.png";

export const markerStyles = {
  spotEinsteigAufsteigIcon: {
    iconRetinaUrl: EinsteigAufsteigMarker2x,
    iconUrl: EinsteigAufsteigMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
    iconSize: [25, 41],
  },
  spotNurEinsteigIcon: {
  iconRetinaUrl: EinsteigMarker2x,
  iconUrl: EinsteigMarker,  
  shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
  iconSize: [25, 41],
  },
  spotNurAufsteigIcon: {
    iconRetinaUrl: AufsteigMarker2x,
    iconUrl: AufsteigMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
    iconSize: [25, 41],
  },
  spotRasthalteIcon: {
    iconRetinaUrl: RasthalteMarker2x,
    iconUrl: RasthalteMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
    iconSize: [25, 41],
  },
  spotNotauswasserungIcon: {
    iconRetinaUrl: NotauswasserungMarker2x,
    iconUrl: NotauswasserungMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
    iconSize: [25, 41],
  },
  obstacleIcon: {
    iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
    iconSize: [25, 41],
  }
}
