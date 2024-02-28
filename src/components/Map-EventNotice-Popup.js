import React from "react";
import { Link, Trans } from 'gatsby-plugin-react-i18next';
import { Popup } from "react-leaflet";

const MapEventNoticePopup = (props) => {

  return(
    <Popup key={props.slug}>
      <span class="popup-title">
        <h1>{props.name}</h1>
      </span>
      <table class="popup-details-table popup-eventnotice-table">
        <tbody>
          <tr>
            <th><Trans>Approx. Start Date</Trans>:</th>
            <td>                    
              {props.startDate}
            </td>
          </tr>
          <tr>
            <th><Trans>Approx. End Date</Trans>:</th>
            <td>
              {props.endDate}
            </td>
          </tr>
        </tbody>
      </table>
      <button class="popup-btn popup-btn-right">
        <Link to={`/gewaesserereignisse/${props.slug}`} class="popup-btn-right">
          <Trans>More details</Trans>
        </Link>
      </button>
    </Popup>
  )
}

export default MapEventNoticePopup;