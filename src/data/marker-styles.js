import EinstiegAusstiegMarker from "assets/images/markers/startingspots-entryexit.svg";
import EinstiegMarker from "assets/images/markers/startingspots-entry.svg";
import AusstiegMarker from "assets/images/markers/otherspots-exit.svg";
import NotauswasserungMarker from "assets/images/markers/otherspots-emergency.svg";
import RasthalteMarker from "assets/images/markers/otherspots-rest.svg";
import NoEntryMarker from "assets/images/markers/otherspots-noentry.svg";
import WaterwayEventMarker from "assets/images/markers/waterwayevent.svg";

export const markerStyles = {
  spotEinstiegAusstiegIcon: {
    iconRetinaUrl: EinstiegAusstiegMarker,
    iconUrl: EinstiegAusstiegMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  },
  spotNurEinstiegIcon: {
  iconRetinaUrl: EinstiegMarker,
  iconUrl: EinstiegMarker,  
  shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
  iconAnchor: [16, 53],
  popupAnchor: [0, -53],
  iconSize: [32, 53],
  },
  spotNurAusstiegIcon: {
    iconRetinaUrl: AusstiegMarker,
    iconUrl: AusstiegMarker,  
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
  },
  waterwayEventNoticeIcon: {
    iconRetinaUrl: WaterwayEventMarker,
    iconUrl: WaterwayEventMarker,  
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  },
  rejectedSpotIcon: {
    iconRetinaUrl: NoEntryMarker,
    iconUrl: NoEntryMarker,
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
    iconAnchor: [16, 53],
    popupAnchor: [0, -53],
    iconSize: [32, 53],
  }
}
