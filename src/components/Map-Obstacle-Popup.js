import React from "react";
import { Link, Trans } from 'gatsby-plugin-react-i18next';
import { Popup } from "react-leaflet";

const MapObstaclePopup = (props) => {

  var portageResult

  if (props.isPortagePossible) {
    portageResult = "Yes"
  }
  else if (props.isPortagePossible === null) {
    portageResult = "Unknown"
  }
  else {
    portageResult = "No"
  }

  return(
    <Popup>
      <span className="popup-title">
        <h1>{props.name}</h1>
      </span>
      <table>
        <tbody>
          <tr>
            <th>
              <Trans>Portage Possible</Trans>:</th>
            <td>
              <Trans>{portageResult}</Trans>            
            </td>
          </tr>
          </tbody>
      </table>
      <button className="popup-btn popup-btn-right obstacle-details-btn">
        <Link to={`/hindernisse/${props.slug}`} className="popup-btn-right">
          <Trans>More details</Trans>
        </Link>
      </button>                   
    </Popup>
  )
}

export default MapObstaclePopup;