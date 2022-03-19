import EinsteigAufsteigMarker from "assets/images/markers/startingspots-entryexit.svg";
import EinsteigMarker from "assets/images/markers/startingspots-entry.svg";
import AufsteigMarker from "assets/images/markers/otherspots-exit.svg";
import NotauswasserungMarker from "assets/images/markers/otherspots-emergency.svg";
import RasthalteMarker from "assets/images/markers/otherspots-rest.svg";


export const markerStyles = {
  spotEinsteigAufsteigIcon: {
    iconRetinaUrl: EinsteigAufsteigMarker,
    iconUrl: EinsteigAufsteigMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  },
  spotNurEinsteigIcon: {
  iconRetinaUrl: EinsteigMarker,
  iconUrl: EinsteigMarker,  
  shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
  iconAnchor: [16, 53],
  popupAnchor: [0, -53],
  iconSize: [32, 53],
  },
  spotNurAufsteigIcon: {
    iconRetinaUrl: AufsteigMarker,
    iconUrl: AufsteigMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  },
  spotRasthalteIcon: {
    iconRetinaUrl: RasthalteMarker,
    iconUrl: RasthalteMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  },
  spotNotauswasserungIcon: {
    iconRetinaUrl: NotauswasserungMarker,
    iconUrl: NotauswasserungMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  },
  obstacleIcon: {
    iconRetinaUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  }
}
